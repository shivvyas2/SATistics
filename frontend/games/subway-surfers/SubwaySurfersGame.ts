import { BaseGame } from '../BaseGame'
import {
  LANE_COLORS,
  LANE_LETTERS,
  RunnerConfig,
  RunnerFeedback,
  RunnerHudState,
  RunnerModuleInfo,
  RunnerPhase,
  RunnerReviewItem,
} from '@/games/subway-surfers/types/game'
import type { SATQuestion } from '@/lib/api/questions'
import type { GameAnalytics, QuestionAttempt } from '@/games/whackamole/types'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { AnimationMixer } from 'three'

type Difficulty = SATQuestion['difficulty']

interface Gate {
  lane: number
  panel: THREE.Mesh
  frame: THREE.LineSegments
  label: THREE.Sprite
}

const CRUISE_SPEED = 14 // m/s
const STREAK_SPEED_BONUS = 1.2 // m/s per correct answer in a row
const MAX_STREAK_SPEED_STEPS = 5
const DIVE_SPEED = 60 // m/s once the player commits to an answer
const LANE_SPACING = 2.5
const LANE_CENTER_X = -1
// Gates hover this far ahead until the question's time is nearly up
const GATE_HOLD_DISTANCE = 26
// A question may take this many times the exam pace before its gates arrive
const QUESTION_TIME_CAP = 1.5
const CORRECT_FEEDBACK_SECONDS = 1.6
const WRONG_FEEDBACK_SECONDS = 7
const MODULE_BREAK_SECONDS = 4
// Module 2 gets harder when at least this share of module 1 was correct
const HARDER_MODULE_ACCURACY = 0.6
const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 100, medium: 150, hard: 200 }
const HUD_UPDATE_INTERVAL_MS = 100
const HORIZON_COLOR = 0xd6eeff
const MAP_TILE_COUNT = 3
// How far the bridge at the end of one tile tucks under the start of the next
const MAP_TILE_OVERLAP = 8
// A tile is moved to the front once it is this far behind the runner
const MAP_RECYCLE_MARGIN = 60
// Meshes narrower than this sit on the rails (trains, barriers) rather than beside them
const MAX_OBSTACLE_MESH_WIDTH = 40
const OBSTACLES_GROUP_NAME = 'obstacles'
const OBSTACLE_HIDE_CHANCE = 0.4
// Obstacles only trade places with others of similar length: barriers, single wagons, coupled trains
const OBSTACLE_LENGTH_CLASSES = [8, 20]
// Geometry closer together than this belongs to the same train or barrier
const ISLAND_CELL_SIZE = 0.6
// The world shifts back by this much whenever the runner gets this far out, keeping coordinates small
const REBASE_DISTANCE = 3000

function shuffle<T>(items: T[]): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Subway Surfers Game
 * A timed exam run: the runner flies down the tracks, each answer choice is a
 * lane, and the lane the runner is in when they reach the gates is their answer.
 * Questions come in two modules like the real exams; the second module gets
 * harder or easier depending on how the first one went.
 */
export class SubwaySurfersGame extends BaseGame {
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private renderer: THREE.WebGLRenderer | null = null
  private gltfLoader = new GLTFLoader()
  private fbxLoader = new FBXLoader()
  private disposed = false

  // World
  private mapTiles: THREE.Group[] = []
  private ground: THREE.Mesh | null = null
  // Distance between the starts of consecutive tiles
  private tilePeriod = 0
  // Where a tile's track ends, relative to the tile's position
  private tileFrontZ = 0
  private trackSurfaceY = 0
  private flightAltitude = 21.0 // meters above track surface
  private characterVerticalOffset = -3.0 // lowers only the character relative to flightAltitude

  // Runner
  private characterModel: THREE.Group | null = null
  private animationMixer: AnimationMixer | null = null
  private flyingFBX: THREE.Group | null = null
  private fallingFBX: THREE.Group | null = null
  private fallingFlatFBX: THREE.Group | null = null
  private characterHeight = 2
  private characterZ = -140 // start deep in the map for a broad track view
  private characterX = LANE_CENTER_X
  private speed = CRUISE_SPEED
  private cruiseSpeed = CRUISE_SPEED
  private cameraX = LANE_CENTER_X
  private viewShiftPx = 0
  // Wrong-answer tumble: falling, then impact, then back to flying
  private fail: { stage: 'falling' | 'impact'; secondsLeft: number } | null = null
  private cameraDip = 0

  // Exam state
  private pool: SATQuestion[]
  private usedIds = new Set<number>()
  private totalQuestions: number
  private moduleSizes: number[]
  private moduleIndex = 0
  private moduleQuestions: SATQuestion[] = []
  private moduleQuestionIndex = 0
  private currentQuestion: SATQuestion | null = null
  private phase: RunnerPhase = 'loading'
  private loadProgress = 0
  private sectionSecondsLeft = 0
  private questionElapsed = 0
  private gateSecondsTotal = 0
  private phaseSecondsLeft = 0
  private isDiving = false
  private currentLane = 1
  private streak = 0
  private maxStreak = 0
  private correctAnswers = 0
  private wrongAnswers = 0
  private attempts: QuestionAttempt[] = []
  private review: RunnerReviewItem[] = []

  // Answer gates
  private gateGroup: THREE.Group | null = null
  private gates: Gate[] = []
  private gateZ = 0

  // Audio
  private bgAudio: HTMLAudioElement | null = null
  private fallingSfx: HTMLAudioElement | null = null
  private dyingSfx: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private isMuted = false

  private lastHudUpdateMs = 0

  // Callbacks
  public onQuestionChange?: (question: SATQuestion | null) => void
  public onHudChange?: (state: RunnerHudState) => void
  public onFeedback?: (feedback: RunnerFeedback | null) => void
  public onModuleChange?: (info: RunnerModuleInfo) => void
  public onGameOver?: (analytics: GameAnalytics, review: RunnerReviewItem[]) => void

  constructor(
    width: number,
    height: number,
    canvas: HTMLCanvasElement,
    questions: SATQuestion[],
    private config: RunnerConfig
  ) {
    super(width, height, canvas)
    this.pool = shuffle(questions)
    this.totalQuestions = Math.min(config.questionCount, this.pool.length)
    const firstModule = Math.ceil(this.totalQuestions / 2)
    this.moduleSizes = [firstModule, this.totalQuestions - firstModule].filter((size) => size > 0)
  }

  init(): void {
    this.setState({ score: 0, level: 1, lives: 3, isPaused: false, isGameOver: false })
    this.setupScene()
    this.preloadSfx()
    this.loadAssets()
  }

  private setupScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = this.createSkyTexture()
    // Fog matches the horizon so the far end of the map fades out instead of popping in
    this.scene.fog = new THREE.Fog(HORIZON_COLOR, 140, 620)

    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000)

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.width, this.height, false)

    // Bright daylight: sky/ground bounce light plus a warm sun
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb9d6a3, 2.2))
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.0))
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6)
    sun.position.set(30, 60, 20)
    this.scene.add(sun)

    this.gateGroup = new THREE.Group()
    this.scene.add(this.gateGroup)
  }

  // Vertical gradient from deep blue overhead to a pale horizon
  private createSkyTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 2
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createLinearGradient(0, 0, 0, 256)
      gradient.addColorStop(0, '#3fa0f0')
      gradient.addColorStop(0.55, '#a8dcff')
      gradient.addColorStop(1, '#e3f4ff')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 2, 256)
    }
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    return texture
  }

  private async loadAssets(): Promise<void> {
    await this.loadSubwayModel()
    this.setLoadProgress(0.6)
    await this.loadCharacter()
    if (this.disposed) return
    this.setLoadProgress(1)
    this.phase = 'ready'
    this.emitHud(true)
  }

  private setLoadProgress(progress: number): void {
    this.loadProgress = progress
    this.emitHud(true)
  }

  private async loadSubwayModel(): Promise<void> {
    try {
      const gltf = await this.gltfLoader.loadAsync('/games/subway-surfers/assets/subway_surfers_maps/scene.gltf')
      if (this.disposed || !this.scene) return
      const subwayModel = gltf.scene

      // The map ends in an untextured wall; without it the bridge runs straight into the next tile
      const endCaps: THREE.Object3D[] = []
      subwayModel.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && !(mesh.material as THREE.MeshStandardMaterial).map) endCaps.push(mesh)
      })
      endCaps.forEach((mesh) => mesh.removeFromParent())

      // Rotate the model so the tracks extend along -Z
      subwayModel.rotation.y = -Math.PI / 2

      // Calculate bounding box AFTER rotation to get accurate center
      const box = new THREE.Box3().setFromObject(subwayModel)
      const center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      subwayModel.position.set(-center.x, -center.y, 0)
      const groundY = -size.y / 2
      // Estimate the actual running surface a bit above the absolute minimum
      this.trackSurfaceY = groundY + size.y * 0.33
      this.tileFrontZ = box.min.z
      this.tilePeriod = size.z - MAP_TILE_OVERLAP

      // Each tile is the map plus its own set of movable trains and barriers
      const tile = new THREE.Group()
      tile.add(subwayModel)
      tile.updateMatrixWorld(true)
      const obstacles = new THREE.Group()
      obstacles.name = OBSTACLES_GROUP_NAME
      tile.add(obstacles)
      const obstacleMeshes: THREE.Mesh[] = []
      subwayModel.traverse((child) => {
        const mesh = child as THREE.Mesh
        if (mesh.isMesh && new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).x < MAX_OBSTACLE_MESH_WIDTH) {
          obstacleMeshes.push(mesh)
        }
      })
      for (const mesh of obstacleMeshes) {
        this.splitIntoIslands(mesh).forEach((island) => obstacles.add(island))
        mesh.removeFromParent()
        mesh.geometry.dispose()
      }

      // Tiles sit end to end ahead of the runner (negative Z)
      for (let i = 0; i < MAP_TILE_COUNT; i++) {
        const copy = i === 0 ? tile : tile.clone(true)
        copy.position.z = -i * this.tilePeriod
        this.randomizeObstacles(copy)
        this.scene.add(copy)
        this.mapTiles.push(copy)
      }

      // Grass around the map so there is no dark void beyond its edges
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(4000, 4000),
        new THREE.MeshLambertMaterial({ color: 0x7fb069 })
      )
      ground.rotation.x = -Math.PI / 2
      ground.position.y = groundY - 0.5
      this.scene.add(ground)
      this.ground = ground
    } catch (error) {
      console.error('Failed to load subway surfers model:', error)
    }
  }

  /**
   * The map's trains and barriers are merged into a few big meshes. This cuts a
   * mesh into its separate pieces (one per train or barrier) so each can be
   * moved on its own. Pieces are positioned in world space, ready to go in a tile.
   */
  private splitIntoIslands(mesh: THREE.Mesh): THREE.Mesh[] {
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry
    const positions = geometry.getAttribute('position')
    const triangleCount = positions.count / 3

    // Sort vertices into a coarse world-space grid; anything in the same or a
    // neighboring cell is part of the same piece (body, wheels, coupled wagons)
    const parent = new Int32Array(positions.count).map((_, i) => i)
    const find = (i: number): number => {
      while (parent[i] !== i) i = parent[i] = parent[parent[i]]
      return i
    }
    const union = (a: number, b: number) => {
      parent[find(a)] = find(b)
    }
    const worldPositions: THREE.Vector3[] = []
    const cells = new Map<string, number>()
    for (let i = 0; i < positions.count; i++) {
      const position = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld)
      worldPositions.push(position)
      const key = position.clone().divideScalar(ISLAND_CELL_SIZE).floor().toArray().join(',')
      const first = cells.get(key)
      if (first === undefined) cells.set(key, i)
      else union(i, first)
    }
    for (const [key, vertex] of cells) {
      const [x, y, z] = key.split(',').map(Number)
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dz = -1; dz <= 1; dz++) {
            const neighbor = cells.get(`${x + dx},${y + dy},${z + dz}`)
            if (neighbor !== undefined) union(vertex, neighbor)
          }
        }
      }
    }
    for (let t = 0; t < triangleCount; t++) {
      union(t * 3 + 1, t * 3)
      union(t * 3 + 2, t * 3)
    }

    const pieces = new Map<number, { triangles: number[]; box: THREE.Box3 }>()
    for (let t = 0; t < triangleCount; t++) {
      const root = find(t * 3)
      let piece = pieces.get(root)
      if (!piece) pieces.set(root, (piece = { triangles: [], box: new THREE.Box3() }))
      piece.triangles.push(t)
      for (let v = 0; v < 3; v++) piece.box.expandByPoint(worldPositions[t * 3 + v])
    }
    const islands = [...pieces.values()]

    return islands.map(({ triangles, box }) => {
      const center = box.getCenter(new THREE.Vector3())
      const islandGeometry = new THREE.BufferGeometry()
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        const { itemSize } = attribute
        const values = new Float32Array(triangles.length * 3 * itemSize)
        triangles.forEach((t, i) => {
          for (let k = 0; k < 3 * itemSize; k++) values[i * 3 * itemSize + k] = attribute.array[t * 3 * itemSize + k]
        })
        islandGeometry.setAttribute(name, new THREE.BufferAttribute(values, itemSize))
      }
      // Bake the mesh's transform in, then center the piece on its own origin
      islandGeometry.applyMatrix4(mesh.matrixWorld)
      islandGeometry.translate(-center.x, -center.y, -center.z)

      const island = new THREE.Mesh(islandGeometry, mesh.material)
      island.position.copy(center)
      island.userData = {
        length: box.max.z - box.min.z,
        halfHeight: (box.max.y - box.min.y) / 2,
        // The spot on the rails this piece was modeled at
        home: { x: center.x, z: center.z, baseY: box.min.y },
      }
      return island
    })
  }

  /**
   * Gives a tile its own arrangement of trains and barriers, so no two stretches
   * of track look the same. Pieces trade the spots they were modeled at (which
   * keeps them on the rails) and a random share of them is left out.
   */
  private randomizeObstacles(tile: THREE.Group): void {
    const obstacles = tile.getObjectByName(OBSTACLES_GROUP_NAME)?.children || []
    const lengthClass = (obstacle: THREE.Object3D) =>
      OBSTACLE_LENGTH_CLASSES.filter((limit) => obstacle.userData.length >= limit).length

    for (let i = 0; i <= OBSTACLE_LENGTH_CLASSES.length; i++) {
      const group = obstacles.filter((obstacle) => lengthClass(obstacle) === i)
      const homes = shuffle(group.map((obstacle) => obstacle.userData.home))
      group.forEach((obstacle, j) => {
        const home = homes[j]
        obstacle.position.set(home.x, home.baseY + obstacle.userData.halfHeight, home.z)
        obstacle.visible = Math.random() > OBSTACLE_HIDE_CHANCE
      })
    }
  }

  private async loadCharacter(): Promise<void> {
    if (this.disposed || !this.scene) return
    try {
      const fbx = await this.fbxLoader.loadAsync('/Flying.fbx')
      fbx.scale.set(0.28, 0.28, 0.28)
      fbx.rotation.y = Math.PI
      this.flyingFBX = fbx
      this.characterModel = fbx

      // Preload failure animations (non-blocking)
      const loadVariant = (path: string, assign: (model: THREE.Group) => void) => {
        this.fbxLoader.load(path, (model) => {
          model.scale.set(0.28, 0.28, 0.28)
          model.rotation.y = Math.PI
          assign(model)
        })
      }
      loadVariant('/Falling.fbx', (model) => { this.fallingFBX = model })
      loadVariant('/Falling Flat Impact.fbx', (model) => { this.fallingFlatFBX = model })
    } catch (error) {
      console.error('Failed to load flying character:', error)
      // Simple placeholder runner
      const placeholder = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 0.7, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 })
      )
      this.characterModel = new THREE.Group()
      this.characterModel.add(placeholder)
    }
    if (this.disposed || !this.scene) return

    // Fly at altitude above the track surface
    const charBox = new THREE.Box3().setFromObject(this.characterModel)
    this.characterHeight = charBox.getSize(new THREE.Vector3()).y
    const desiredBottomY = this.trackSurfaceY + this.flightAltitude + this.characterVerticalOffset
    this.characterModel.position.set(this.characterX, desiredBottomY - charBox.min.y, this.characterZ)
    this.scene.add(this.characterModel)
    this.playAnimation(this.characterModel, true)
  }

  // Plays a model's first animation clip and returns its duration in seconds
  private playAnimation(model: THREE.Group, loop: boolean): number {
    const clip = model.animations?.[0]
    if (!clip) {
      this.animationMixer = null
      return 0
    }
    this.animationMixer = new AnimationMixer(model)
    const action = this.animationMixer.clipAction(clip)
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1)
    action.clampWhenFinished = !loop
    action.reset().play()
    return clip.duration
  }

  // ---------- Exam flow ----------

  start(): void {
    if (this.phase !== 'ready') return
    this.startBackgroundMusic()
    this.beginModule(0)
  }

  private beginModule(index: number): void {
    this.moduleIndex = index
    this.moduleQuestionIndex = 0
    const size = this.moduleSizes[index]

    if (index === 0) {
      this.moduleQuestions = this.pickQuestions(size, null)
    } else {
      const firstModuleSize = this.moduleSizes[0]
      const firstModuleCorrect = this.review.filter((item) => item.isCorrect).length
      const isHarder = firstModuleCorrect / firstModuleSize >= HARDER_MODULE_ACCURACY
      this.moduleQuestions = this.pickQuestions(size, isHarder ? ['hard', 'medium', 'easy'] : ['easy', 'medium', 'hard'])
      this.onModuleChange?.({
        module: index + 1,
        isHarder,
        previousCorrect: firstModuleCorrect,
        previousTotal: firstModuleSize,
      })
    }
    this.sectionSecondsLeft = this.config.secondsPerQuestion * this.moduleQuestions.length

    if (index === 0) {
      this.nextQuestion()
    } else {
      this.phase = 'module-break'
      this.phaseSecondsLeft = MODULE_BREAK_SECONDS
      this.onQuestionChange?.(null)
      this.emitHud(true)
    }
  }

  // Without a preference the pick is an even mix of difficulties
  private pickQuestions(count: number, preference: Difficulty[] | null): SATQuestion[] {
    const unused = this.pool.filter((q) => !this.usedIds.has(q.id))
    let picked: SATQuestion[]
    if (preference) {
      picked = [...unused].sort((a, b) => preference.indexOf(a.difficulty) - preference.indexOf(b.difficulty)).slice(0, count)
    } else {
      const bands = (['easy', 'medium', 'hard'] as Difficulty[]).map((d) => unused.filter((q) => q.difficulty === d))
      picked = []
      while (picked.length < count && bands.some((band) => band.length > 0)) {
        for (const band of bands) {
          const question = band.pop()
          if (question && picked.length < count) picked.push(question)
        }
      }
    }
    picked.forEach((q) => this.usedIds.add(q.id))
    return shuffle(picked)
  }

  private nextQuestion(): void {
    this.clearGates()
    this.onFeedback?.(null)
    if (this.moduleQuestionIndex >= this.moduleQuestions.length || this.sectionSecondsLeft <= 0) {
      this.endModule()
      return
    }

    const question = this.moduleQuestions[this.moduleQuestionIndex]
    this.currentQuestion = question
    this.currentLane = Math.min(this.currentLane, question.options.length - 1)
    this.questionElapsed = 0
    this.gateSecondsTotal = Math.min(this.config.secondsPerQuestion * QUESTION_TIME_CAP, this.sectionSecondsLeft)
    this.isDiving = false
    this.cruiseSpeed = CRUISE_SPEED + Math.min(this.streak, MAX_STREAK_SPEED_STEPS) * STREAK_SPEED_BONUS
    this.spawnGates(question.options.length)
    this.phase = 'question'
    this.onQuestionChange?.(question)
    this.emitHud(true)
  }

  private endModule(): void {
    // Questions the section clock never reached count as unanswered
    for (const question of this.moduleQuestions.slice(this.moduleQuestionIndex)) {
      this.recordAttempt(question, null, 0)
    }
    if (this.moduleIndex + 1 < this.moduleSizes.length) {
      this.beginModule(this.moduleIndex + 1)
    } else {
      this.finish()
    }
  }

  private recordAttempt(question: SATQuestion, selected: number | null, timeSpent: number): boolean {
    const isCorrect = selected === question.correctAnswer
    if (isCorrect) this.correctAnswers++
    else this.wrongAnswers++
    this.attempts.push({
      questionId: question.id,
      topic: question.topic,
      difficulty: question.difficulty,
      isCorrect,
      timeSpent,
    })
    this.review.push({ question, selected, isCorrect, timeSpent })
    return isCorrect
  }

  private resolveAnswer(): void {
    const question = this.currentQuestion
    if (!question) return
    const selected = this.currentLane
    const isCorrect = this.recordAttempt(question, selected, Math.round(this.questionElapsed * 1000))
    this.moduleQuestionIndex++

    let points = 0
    if (isCorrect) {
      this.streak++
      this.maxStreak = Math.max(this.maxStreak, this.streak)
      const timeLeftShare = Math.max(0, 1 - this.questionElapsed / this.config.secondsPerQuestion)
      points = Math.round(DIFFICULTY_POINTS[question.difficulty] + 50 * timeLeftShare + 10 * Math.min(this.streak, 5))
      this.setState({ score: this.getState().score + points })
      this.playTone([660, 880])
    } else {
      this.streak = 0
      this.startFailSequence()
    }

    for (const gate of this.gates) {
      const material = gate.panel.material as THREE.MeshBasicMaterial
      if (gate.lane === question.correctAnswer) material.color.set(0x16a34a)
      else if (gate.lane === selected) material.color.set(0xdc2626)
      else material.color.set(0x555555)
    }

    this.isDiving = false
    this.phase = 'feedback'
    this.phaseSecondsLeft = isCorrect ? CORRECT_FEEDBACK_SECONDS : WRONG_FEEDBACK_SECONDS
    this.onFeedback?.({ isCorrect, selected, correctAnswer: question.correctAnswer, points })
    this.emitHud(true)
  }

  private finish(): void {
    this.phase = 'done'
    this.setState({ isGameOver: true })
    this.bgAudio?.pause()
    this.onQuestionChange?.(null)
    this.emitHud(true)
    this.onGameOver?.(this.generateAnalytics(), this.review)
  }

  private generateAnalytics(): GameAnalytics {
    const topicPerformance: GameAnalytics['topicPerformance'] = {}
    this.attempts.forEach((attempt) => {
      const perf = (topicPerformance[attempt.topic] ||= { correct: 0, total: 0, accuracy: 0 })
      perf.total++
      if (attempt.isCorrect) perf.correct++
      perf.accuracy = (perf.correct / perf.total) * 100
    })

    const answered = this.attempts.filter((attempt) => attempt.timeSpent > 0)
    const totalTime = answered.reduce((sum, attempt) => sum + attempt.timeSpent, 0)

    return {
      gameId: 'subway-surfers',
      score: this.getState().score,
      accuracy: (this.correctAnswers / (this.correctAnswers + this.wrongAnswers)) * 100 || 0,
      correctAnswers: this.correctAnswers,
      wrongAnswers: this.wrongAnswers,
      questionAttempts: this.attempts,
      topicPerformance,
      streakInfo: { maxStreak: this.maxStreak },
      averageResponseTime: answered.length > 0 ? Math.round(totalTime / answered.length) : 0,
    }
  }

  // ---------- Lanes and gates ----------

  private laneX(lane: number, laneCount: number): number {
    return LANE_CENTER_X + (lane - (laneCount - 1) / 2) * LANE_SPACING
  }

  private get laneCount(): number {
    return this.currentQuestion?.options.length || 4
  }

  setLane(lane: number): void {
    if (this.phase !== 'question' || lane < 0 || lane >= this.laneCount) return
    this.currentLane = lane
    this.emitHud(true)
  }

  // Commit to the current lane and dive for the gates
  dive(): void {
    if (this.phase !== 'question' || this.isDiving) return
    this.isDiving = true
    this.playTone([440])
    this.emitHud(true)
  }

  skipFeedback(): void {
    if (this.phase === 'feedback') this.phaseSecondsLeft = 0
  }

  private spawnGates(laneCount: number): void {
    if (!this.gateGroup) return
    const gateY = this.trackSurfaceY + this.flightAltitude + this.characterVerticalOffset + this.characterHeight / 2
    const panelGeometry = new THREE.PlaneGeometry(2.2, 3)
    const frameGeometry = new THREE.EdgesGeometry(panelGeometry)

    for (let lane = 0; lane < laneCount; lane++) {
      const color = new THREE.Color(LANE_COLORS[lane])
      const panel = new THREE.Mesh(
        panelGeometry,
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
      )
      panel.position.set(this.laneX(lane, laneCount), gateY, 0)
      const frame = new THREE.LineSegments(frameGeometry, new THREE.LineBasicMaterial({ color: 0xffffff }))
      panel.add(frame)

      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.createLetterTexture(LANE_LETTERS[lane], LANE_COLORS[lane]), depthTest: false })
      )
      label.scale.set(1.5, 1.5, 1)
      label.renderOrder = 998
      panel.add(label)

      this.gateGroup.add(panel)
      this.gates.push({ lane, panel, frame, label })
    }
    this.gateZ = this.characterZ - GATE_HOLD_DISTANCE
    this.gateGroup.position.z = this.gateZ
  }

  private createLetterTexture(letter: string, color: string): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.arc(64, 64, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = color
      ctx.font = 'bold 84px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, 64, 70)
    }
    return new THREE.CanvasTexture(canvas)
  }

  private clearGates(): void {
    for (const gate of this.gates) {
      this.gateGroup?.remove(gate.panel)
      ;(gate.panel.material as THREE.Material).dispose()
      ;(gate.frame.material as THREE.Material).dispose()
      gate.label.material.map?.dispose()
      gate.label.material.dispose()
    }
    // Panel and frame geometries are shared by a question's gates
    this.gates[0]?.panel.geometry.dispose()
    this.gates[0]?.frame.geometry.dispose()
    this.gates = []
  }

  private updateGates(nowMs: number): void {
    const isClosing = this.phase === 'question' && this.gateSecondsLeft() < 10
    for (const gate of this.gates) {
      const material = gate.panel.material as THREE.MeshBasicMaterial
      if (this.phase === 'question') {
        const isSelected = gate.lane === this.currentLane
        // The lane the runner is in glows; all gates pulse when time is nearly up
        const pulse = isClosing ? 0.1 * Math.sin(nowMs / 120) : 0
        material.opacity = (isSelected ? 0.75 : 0.3) + pulse
        gate.panel.scale.setScalar(isSelected ? 1.08 : 1)
      } else {
        const isAnswer = gate.lane === this.currentQuestion?.correctAnswer
        material.opacity = isAnswer ? 0.85 : 0.4
      }
    }
  }

  private gateSecondsLeft(): number {
    if (this.isDiving) return Math.max(0, (this.characterZ - this.gateZ) / this.speed)
    return Math.max(0, Math.min(this.gateSecondsTotal - this.questionElapsed, this.sectionSecondsLeft))
  }

  // ---------- Wrong-answer tumble ----------

  private swapCharacter(model: THREE.Group, loop: boolean): number {
    if (!this.scene) return 0
    if (this.characterModel) {
      model.position.copy(this.characterModel.position)
      this.scene.remove(this.characterModel)
    }
    model.rotation.set(0, Math.PI, 0)
    this.characterModel = model
    this.scene.add(model)
    return this.playAnimation(model, loop)
  }

  private startFailSequence(): void {
    this.playSfx(this.fallingSfx)
    if (!this.fallingFBX) return
    const duration = this.swapCharacter(this.fallingFBX, false)
    this.fail = { stage: 'falling', secondsLeft: Math.max(0.6, duration) }
  }

  private updateFailSequence(dt: number): void {
    if (!this.fail) {
      this.cameraDip = Math.max(0, this.cameraDip - 12 * dt)
      return
    }
    this.fail.secondsLeft -= dt
    if (this.fail.stage === 'impact') this.cameraDip = Math.min(6, this.cameraDip + 16 * dt)
    if (this.fail.secondsLeft > 0) return

    if (this.fail.stage === 'falling' && this.fallingFlatFBX) {
      const duration = this.swapCharacter(this.fallingFlatFBX, false)
      this.playSfx(this.dyingSfx)
      this.fail = { stage: 'impact', secondsLeft: Math.max(0.8, duration) }
    } else {
      if (this.flyingFBX) this.swapCharacter(this.flyingFBX, true)
      this.fail = null
    }
  }

  // ---------- Frame update ----------

  update(deltaTime: number): void {
    const state = this.getState()
    if (state.isPaused || this.phase === 'loading' || this.phase === 'done') return
    if (!this.characterModel || !this.camera) return

    const dt = deltaTime / 1000
    const nowMs = performance.now()
    this.animationMixer?.update(dt)
    this.rebaseWorld()

    // Forward flight: cruise, dive for the gates, or stumble after a wrong answer
    const targetSpeed = this.isDiving ? DIVE_SPEED : this.fail ? this.cruiseSpeed * 0.45 : this.cruiseSpeed
    this.speed += (targetSpeed - this.speed) * Math.min(1, 6 * dt)
    this.characterZ -= this.speed * dt

    // Glide toward the chosen lane, banking into the turn
    const targetX = this.laneX(this.currentLane, this.laneCount)
    const offset = targetX - this.characterX
    this.characterX += offset * Math.min(1, 10 * dt)
    this.characterModel.position.x = this.characterX
    this.characterModel.position.z = this.characterZ
    if (!this.fail) this.characterModel.rotation.z = THREE.MathUtils.clamp(offset * 0.25, -0.5, 0.5)

    if (this.phase === 'question') {
      this.questionElapsed += dt
      this.sectionSecondsLeft = Math.max(0, this.sectionSecondsLeft - dt)
      if (!this.isDiving) {
        // Gates hover ahead, then close in as the question's time runs out
        this.gateZ = this.characterZ - Math.min(GATE_HOLD_DISTANCE, this.gateSecondsLeft() * this.cruiseSpeed)
      }
      if (this.gateGroup) this.gateGroup.position.z = this.gateZ
      if (this.characterZ <= this.gateZ + 0.2) this.resolveAnswer()
    } else if (this.phase === 'feedback' || this.phase === 'module-break') {
      this.phaseSecondsLeft -= dt
      // Let the tumble finish before the next question starts
      if (this.phaseSecondsLeft <= 0 && !this.fail) this.nextQuestion()
    }

    this.updateFailSequence(dt)
    this.updateGates(nowMs)
    this.updateCamera(dt)
    this.recycleMapTiles()
    this.emitHud(false)
  }

  private updateCamera(dt: number): void {
    if (!this.camera) return
    // Chase cam: trails the runner sideways and pulls back and widens during a dive
    this.cameraX += (this.characterX - this.cameraX) * Math.min(1, 4 * dt)
    const diveAmount = THREE.MathUtils.clamp((this.speed - this.cruiseSpeed) / (DIVE_SPEED - this.cruiseSpeed), 0, 1)
    const flightY = this.trackSurfaceY + this.flightAltitude
    this.camera.position.set(this.cameraX, flightY + 4 - this.cameraDip, this.characterZ + 9 + diveAmount * 3)
    this.camera.lookAt(this.cameraX, flightY, this.characterZ)
    const fov = 60 + diveAmount * 14
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov
      this.camera.updateProjectionMatrix()
    }
  }

  // Move a map tile the runner has passed to the front for infinite scrolling
  private recycleMapTiles(): void {
    if (this.ground) this.ground.position.z = this.characterZ
    for (const tile of this.mapTiles) {
      if (tile.position.z + this.tileFrontZ < this.characterZ + MAP_RECYCLE_MARGIN) continue
      tile.position.z = Math.min(...this.mapTiles.map((t) => t.position.z)) - this.tilePeriod
      this.randomizeObstacles(tile)
    }
  }

  // Float precision degrades far from the origin, so periodically pull the whole world back
  private rebaseWorld(): void {
    if (this.characterZ > -REBASE_DISTANCE) return
    this.characterZ += REBASE_DISTANCE
    this.gateZ += REBASE_DISTANCE
    if (this.gateGroup) this.gateGroup.position.z += REBASE_DISTANCE
    for (const tile of this.mapTiles) tile.position.z += REBASE_DISTANCE
  }

  private emitHud(force: boolean): void {
    const nowMs = performance.now()
    if (!force && nowMs - this.lastHudUpdateMs < HUD_UPDATE_INTERVAL_MS) return
    this.lastHudUpdateMs = nowMs
    this.onHudChange?.({
      phase: this.phase,
      loadProgress: this.loadProgress,
      score: this.getState().score,
      streak: this.streak,
      correctAnswers: this.correctAnswers,
      wrongAnswers: this.wrongAnswers,
      questionNumber: Math.min(this.review.length + (this.phase === 'question' ? 1 : 0), this.totalQuestions),
      totalQuestions: this.totalQuestions,
      module: this.moduleIndex + 1,
      moduleCount: this.moduleSizes.length,
      sectionSecondsLeft: this.sectionSecondsLeft,
      gateSecondsLeft: this.gateSecondsLeft(),
      gateSecondsTotal: this.gateSecondsTotal,
      currentLane: this.currentLane,
      isDiving: this.isDiving,
      isPaused: this.getState().isPaused,
      isMuted: this.isMuted,
    })
  }

  render(): void {
    if (this.scene && this.camera && this.renderer) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.renderer?.setSize(width, height, false)
    this.applyViewShift()
  }

  // Shifts the scene sideways so the runner stays clear of the question panel
  setViewShift(pixels: number): void {
    this.viewShiftPx = pixels
    this.applyViewShift()
  }

  private applyViewShift(): void {
    if (!this.camera) return
    this.camera.aspect = this.width / this.height
    if (this.viewShiftPx) {
      this.camera.setViewOffset(this.width, this.height, -this.viewShiftPx, 0, this.width, this.height)
    } else {
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }

  // ---------- Input ----------

  handleInput(key: string): void {
    const lower = key.toLowerCase()
    if (lower === 'p' || key === 'Escape') {
      this.setPaused(!this.getState().isPaused)
      return
    }
    if (this.getState().isPaused) return

    if (key === 'ArrowLeft' || lower === 'a') {
      this.setLane(this.currentLane - 1)
    } else if (key === 'ArrowRight' || lower === 'd') {
      this.setLane(this.currentLane + 1)
    } else if (key >= '1' && key <= '5') {
      this.setLane(Number(key) - 1)
    } else if (key === ' ' || key === 'Enter' || key === 'ArrowUp' || lower === 'w') {
      if (this.phase === 'ready') this.start()
      else if (this.phase === 'question') this.dive()
      else this.skipFeedback()
    }
  }

  setPaused(paused: boolean): void {
    if (this.phase === 'loading' || this.phase === 'ready' || this.phase === 'done') return
    this.setState({ isPaused: paused })
    if (paused) this.bgAudio?.pause()
    else this.bgAudio?.play().catch(() => {})
    this.emitHud(true)
  }

  // ---------- Audio ----------

  setMuted(muted: boolean): void {
    this.isMuted = muted
    for (const audio of [this.bgAudio, this.fallingSfx, this.dyingSfx]) {
      if (audio) audio.muted = muted
    }
    this.emitHud(true)
  }

  private startBackgroundMusic(): void {
    try {
      const audio = new Audio('/bg-music.mp3')
      audio.loop = true
      audio.volume = 0.6
      audio.muted = this.isMuted
      audio.play().catch(() => {})
      this.bgAudio = audio
      this.audioContext = new AudioContext()
    } catch {}
  }

  private preloadSfx(): void {
    const load = (path: string) => {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.9
      return audio
    }
    try {
      this.fallingSfx = load('/falling.mp3')
      this.dyingSfx = load('/dying.mp3')
    } catch {}
  }

  private playSfx(audio: HTMLAudioElement | null): void {
    if (!audio) return
    try {
      audio.currentTime = 0
      audio.play().catch(() => {})
    } catch {}
  }

  // Short synthesized chime, one note after another
  private playTone(frequencies: number[]): void {
    const ctx = this.audioContext
    if (!ctx || this.isMuted) return
    frequencies.forEach((frequency, i) => {
      const startAt = ctx.currentTime + i * 0.1
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.15, startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.18)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.2)
    })
  }

  cleanup(): void {
    this.disposed = true
    for (const audio of [this.bgAudio, this.fallingSfx, this.dyingSfx]) {
      if (!audio) continue
      try {
        audio.pause()
        // Unload the source to ensure no lingering playback
        audio.src = ''
        audio.load()
      } catch {}
    }
    this.bgAudio = null
    this.fallingSfx = null
    this.dyingSfx = null
    this.audioContext?.close().catch(() => {})
    this.audioContext = null

    this.clearGates()
    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer?.dispose()
    this.renderer = null
    this.scene = null
    this.camera = null
    this.characterModel = null
    this.animationMixer = null
  }
}
