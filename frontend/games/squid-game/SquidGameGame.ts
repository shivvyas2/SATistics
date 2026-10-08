import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { BaseGame } from '../BaseGame'
import { PAINTING_ASPECT, createWallPainting } from './wallPainting'
import { SquidConfig, SquidFeedback, SquidHudState, SquidOutcome, SquidPhase, SquidReviewItem } from './types'
import type { SATQuestion } from '@/lib/api/questions'
import type { GameAnalytics, QuestionAttempt } from '@/games/whackamole/types'
import { LANE_COLORS, LANE_LETTERS } from '@/games/subway-surfers/types/game'

type Difficulty = SATQuestion['difficulty']
type AnimationName = 'idle' | 'run' | 'die'

interface Character {
  // Pivot the game moves and turns; the animated model sits inside it
  model: THREE.Object3D
  mixer: THREE.AnimationMixer
  actions: Partial<Record<AnimationName, THREE.AnimationAction>>
  animation: AnimationName
  velocity: THREE.Vector2 // x, z
  yaw: number
  isAlive: boolean
}

// Guards are a static model, so their aiming and shooting is animated in code
interface Guard {
  pivot: THREE.Group
  model: THREE.Object3D
  flash: THREE.Sprite
  tracer: THREE.Line
  swayOffset: number
  yaw: number
  // 1 right after a shot, easing back to 0
  recoil: number
  shotsLeft: number
  secondsToNextShot: number
  tracerSecondsLeft: number
}

// A circle on the sand the player stands on to choose an answer
interface AnswerPad {
  option: number
  disc: THREE.Mesh
  label: THREE.Sprite
}

interface Npc extends Character {
  maxSpeed: number
  // Seconds this contestant keeps moving after the doll starts to turn
  stopDelay: number
  hasFinished: boolean
}

const ASSETS = '/games/squid-game/assets'
const AUDIO = '/games/squid-game/audio'

const FIELD_HALF_WIDTH = 13.5
const START_Z = 50
const FINISH_Z = -44
const DOLL_Z = -52
const NPC_COUNT = 24

const PLAYER_HEIGHT = 1.8
const GUARD_HEIGHT = 2.0
const DOLL_HEIGHT = 7
// Tall enough that the arena feels like an enclosed hall
const WALL_HEIGHT = 14
// The painted sky's blue, shown until the wall painting has loaded
const PAINTED_SKY = 0x3a9cff
// Chase camera: how high and far behind the player it sits, and where it aims
const CAMERA_HEIGHT = 5.6
const CAMERA_BEHIND = 10.5
const CAMERA_LOOK_HEIGHT = 1.4
const CAMERA_LOOK_AHEAD = 22
// Share of the player's sideways movement the camera follows
const CAMERA_SIDE_FOLLOW = 0.75

const FIRST_GREEN_SECONDS = 4
const GREEN_SECONDS_CORRECT = 4
const GREEN_SECONDS_WRONG = 1.5
// The doll finishes turning this long after the song stops
const TURN_SECONDS = 0.7
// Moving faster than this when the doll is looking gets you shot
const CAUGHT_SPEED = 0.6
const CORRECT_FEEDBACK_SECONDS = 1.8
const WRONG_FEEDBACK_SECONDS = 8
const END_DELAY_SECONDS = 2.5
// Share of questions a player is expected to get right, used to pace the run
const EXPECTED_ACCURACY = 0.7
const MIN_RUN_SPEED = 2.2
const MAX_RUN_SPEED = 5
// Run speed the running animation was authored for
const RUN_ANIMATION_SPEED = 4
// Chance per red light that a contestant fails to stop in time
const NPC_CARELESS_CHANCE = 0.05
const ANIMATION_FADE_SECONDS = 0.2
const PAD_RADIUS = 1.0
const PAD_SPACING = 2.6
// How far ahead of the player the answer pads appear
const PAD_DISTANCE = 3.5
// Standing on a pad this long locks the answer in
const PAD_LOCK_SECONDS = 2.5
const SHOTS_PER_BURST = 3
const SECONDS_BETWEEN_SHOTS = 0.13
const TRACER_SECONDS = 0.07
// Where the rifle muzzle sits relative to a guard's feet
const MUZZLE_OFFSET = new THREE.Vector3(0, GUARD_HEIGHT * 0.42, 0.55)
// Emissive tints that lighten the contestants' black hair
const HAIR_TINTS = [0x000000, 0x000000, 0x2b1a0e, 0x4a3214, 0x5c5c5c, 0x6b1f12]
// Multiplied into the tracksuit texture
const SUIT_TINTS = [0xffffff, 0xffffff, 0xd9f2e4, 0xe6e0ff, 0xfff0d6, 0xcfe8ff]
const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 100, medium: 150, hard: 200 }
const FINISH_BONUS = 500
// Every run starts with the same number of lives, however many questions it has
const STARTING_LIVES = 5
// Share of a question's points kept for each hint taken
const HINT_POINTS_FACTOR = 0.6
const HUD_UPDATE_INTERVAL_MS = 100

// Framerate-independent smoothing factor
function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

function dampAngle(current: number, target: number, rate: number, dt: number): number {
  const difference = Math.atan2(Math.sin(target - current), Math.cos(target - current))
  return current + difference * damp(rate, dt)
}

/**
 * Squid Game - Red Light Green Light
 * Run for the finish line while the doll sings. When she turns, freeze and
 * answer an exam question at real exam pace. Correct answers earn a long green
 * light; wrong answers and moving on red cost a life.
 */
export class SquidGameGame extends BaseGame {
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private disposed = false
  private viewShift = { x: 0, y: 0 }

  // Characters
  private player: Character | null = null
  private npcs: Npc[] = []
  private guards: Guard[] = []
  private playerMarker: THREE.Mesh | null = null
  private shotTarget = new THREE.Vector3()
  private elapsed = 0
  private doll: THREE.Object3D | null = null
  private dollYaw = Math.PI // facing away from the contestants
  private runSpeed = MAX_RUN_SPEED
  private keysDown = new Set<string>()

  // Game state
  private phase: SquidPhase = 'loading'
  private loadProgress = 0
  private phaseSecondsLeft = 0
  private greenSecondsTotal = 0
  private turnElapsed = 0
  private wasCaughtMoving = false
  private lives: number
  private maxLives: number
  private outcome: SquidOutcome | null = null

  // Questions
  private pool: SATQuestion[]
  private totalQuestions: number
  private difficultyLevel = 1
  // Missed questions waiting for a second try, and those that already had one
  private retryQueue: SATQuestion[] = []
  private retriedIds = new Set<number>()
  private hintsUsed = 0
  private pads: AnswerPad[] = []
  private standingPad: number | null = null
  private standingSeconds = 0
  private currentQuestion: SATQuestion | null = null
  private questionElapsed = 0
  private nextGreenSeconds = FIRST_GREEN_SECONDS
  private correctAnswers = 0
  private wrongAnswers = 0
  private streak = 0
  private maxStreak = 0
  private attempts: QuestionAttempt[] = []
  private review: SquidReviewItem[] = []

  // Audio
  private songAudio: HTMLAudioElement | null = null
  private redLightAudio: HTMLAudioElement | null = null
  private audioContext: AudioContext | null = null
  private isMuted = false

  private lastHudUpdateMs = 0

  // Callbacks
  public onHudChange?: (state: SquidHudState) => void
  public onQuestionChange?: (question: SATQuestion | null) => void
  public onFeedback?: (feedback: SquidFeedback | null) => void
  public onGameOver?: (analytics: GameAnalytics, review: SquidReviewItem[], outcome: SquidOutcome) => void

  constructor(
    width: number,
    height: number,
    canvas: HTMLCanvasElement,
    questions: SATQuestion[],
    private config: SquidConfig
  ) {
    super(width, height, canvas)
    this.pool = [...questions]
    this.totalQuestions = Math.min(config.questionCount, this.pool.length)
    this.maxLives = STARTING_LIVES
    this.lives = this.maxLives

    // Pace the run so a player answering at the expected accuracy reaches the finish
    const expectedRunSeconds =
      FIRST_GREEN_SECONDS +
      this.totalQuestions * (EXPECTED_ACCURACY * GREEN_SECONDS_CORRECT + (1 - EXPECTED_ACCURACY) * GREEN_SECONDS_WRONG)
    this.runSpeed = THREE.MathUtils.clamp((START_Z - FINISH_Z) / expectedRunSeconds, MIN_RUN_SPEED, MAX_RUN_SPEED)
  }

  init(): void {
    this.setState({ score: 0, level: 1, lives: this.maxLives, isPaused: false, isGameOver: false })
    this.setupScene()
    this.loadAssets().catch((error) => console.error('Failed to load squid game assets:', error))
  }

  private setupScene(): void {
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(this.width, this.height, false)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.scene = new THREE.Scene()
    // Replaced by the painted sky's own color once the wall painting is ready
    this.scene.background = new THREE.Color(PAINTED_SKY)
    this.scene.fog = new THREE.Fog(PAINTED_SKY, 110, 220)

    this.camera = new THREE.PerspectiveCamera(45, this.width / this.height, 0.1, 250)
    this.camera.position.set(0, CAMERA_HEIGHT, START_Z + CAMERA_BEHIND)

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xd9c49a, 2.0))
    const sun = new THREE.DirectionalLight(0xfff4e0, 2.4)
    sun.position.set(40, 60, 30)
    sun.castShadow = true
    sun.shadow.bias = -0.0005
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -20
    sun.shadow.camera.right = 20
    sun.shadow.camera.top = 70
    sun.shadow.camera.bottom = -70
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 200
    this.scene.add(sun)

    const textureLoader = new THREE.TextureLoader()
    const sand = textureLoader.load(`${ASSETS}/squid-textures/textures/Sand_baseColor.jpeg`)
    sand.wrapS = sand.wrapT = THREE.RepeatWrapping
    sand.repeat.set(4, 20)
    sand.colorSpace = THREE.SRGBColorSpace
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 150), new THREE.MeshLambertMaterial({ map: sand }))
    ground.rotation.x = -Math.PI / 2
    ground.receiveShadow = true
    this.scene.add(ground)

    // The arena is an enclosed hall: walls painted with sky and hills, one long painting per
    // side, under a ceiling in the same painted sky color
    const walls: { material: THREE.MeshLambertMaterial; length: number; mirrored: boolean }[] = []
    const addWall = (width: number, x: number, z: number, isSide: boolean) => {
      const material = new THREE.MeshLambertMaterial({ color: PAINTED_SKY })
      const wall = new THREE.Mesh(new THREE.BoxGeometry(width, WALL_HEIGHT, 2), material)
      wall.position.set(x, WALL_HEIGHT / 2, z)
      wall.receiveShadow = true
      if (isSide) wall.rotation.y = Math.PI / 2
      this.scene.add(wall)
      // The two side walls show the painting in opposite directions so they don't match
      walls.push({ material, length: width, mirrored: x > 0 })
    }
    addWall(30, 0, -67, false)
    addWall(150, -16, 0, true)
    addWall(150, 16, 0, true)

    const ceilingMaterial = new THREE.MeshBasicMaterial({ color: PAINTED_SKY })
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(34, 150), ceilingMaterial)
    ceiling.rotation.x = Math.PI / 2
    ceiling.position.y = WALL_HEIGHT
    this.scene.add(ceiling)

    createWallPainting(`${ASSETS}/squid-textures/textures/walls_baseColor.png`, this.renderer.capabilities.maxTextureSize)
      .then(({ texture, skyTop }) => {
        if (this.disposed) return texture.dispose()
        for (const wall of walls) {
          const map = texture.clone()
          // Side walls take the whole painting once; the short back wall shows a stretch of it
          const share = Math.min(1, wall.length / WALL_HEIGHT / PAINTING_ASPECT)
          map.wrapS = THREE.RepeatWrapping
          map.repeat.x = wall.mirrored ? -share : share
          map.offset.x = wall.mirrored ? 1 : share < 1 ? 0.3 : 0
          wall.material.map = map
          wall.material.color.set(0xffffff)
          wall.material.needsUpdate = true
        }
        ceilingMaterial.color.copy(skyTop)
        ;(this.scene.background as THREE.Color).copy(skyTop)
        this.scene.fog?.color.copy(skyTop)
      })
      .catch((error) => console.warn('Squid game wall painting failed to load:', error))

    // Finish line
    const finishLine = new THREE.Mesh(new THREE.PlaneGeometry(30, 0.5), new THREE.MeshBasicMaterial({ color: 0xe11d48 }))
    finishLine.rotation.x = -Math.PI / 2
    finishLine.position.set(0, 0.02, FINISH_Z)
    this.scene.add(finishLine)
  }

  // ---------- Assets ----------

  private async loadAssets(): Promise<void> {
    const fbxLoader = new FBXLoader()
    const gltfLoader = new GLTFLoader()
    let loaded = 0
    const track = <T>(promise: Promise<T>): Promise<T | null> =>
      promise
        .catch((error) => {
          console.warn('Squid game asset failed to load:', error)
          return null
        })
        .then((result) => {
          this.loadProgress = ++loaded / 6
          this.emitHud(true)
          return result
        })

    const [playerBase, runFbx, dieFbx, guardGltf, dollGltf, treeGltf] = await Promise.all([
      track(fbxLoader.loadAsync(`${ASSETS}/standingidleplayer.fbx`)),
      track(fbxLoader.loadAsync(`${ASSETS}/Goofy Running.fbx`)),
      track(fbxLoader.loadAsync(`${ASSETS}/Dying.fbx`)),
      track(gltfLoader.loadAsync(`${ASSETS}/red_guy/scene.gltf`)),
      track(gltfLoader.loadAsync(`${ASSETS}/squidgamedoll/scene.gltf`)),
      track(gltfLoader.loadAsync(`${ASSETS}/low_poly_dead_tree/scene.gltf`)),
    ])
    if (this.disposed) return

    if (playerBase) {
      const clips = {
        idle: playerBase.animations[0],
        run: runFbx?.animations[0] && this.removeRootMotion(runFbx.animations[0]),
        die: dieFbx?.animations[0],
      }
      this.fitHeight(playerBase, PLAYER_HEIGHT)

      this.player = this.createCharacter(cloneSkinned(playerBase), clips)
      this.player.model.position.set(0, 0, START_Z)

      // Ring on the ground so the player can find themselves in the crowd
      this.playerMarker = new THREE.Mesh(
        new THREE.RingGeometry(0.55, 0.7, 40),
        new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.9 })
      )
      this.playerMarker.rotation.x = -Math.PI / 2
      this.playerMarker.position.y = 0.03
      this.player.model.add(this.playerMarker)

      for (let i = 0; i < NPC_COUNT; i++) {
        const model = cloneSkinned(playerBase)
        this.varyAppearance(model)
        const npc: Npc = {
          ...this.createCharacter(model, clips),
          maxSpeed: this.runSpeed * (0.75 + Math.random() * 0.35),
          stopDelay: 0,
          hasFinished: false,
        }
        // Spread contestants along the start line, leaving the middle for the player
        const side = i % 2 === 0 ? 1 : -1
        npc.model.position.set(side * (1.5 + Math.random() * (FIELD_HALF_WIDTH - 2)), 0, START_Z - 2 + Math.random() * 4)
        // Offset each loop so the crowd doesn't move in unison
        Object.values(npc.actions).forEach((action) => { action.time = Math.random() * action.getClip().duration })
        this.npcs.push(npc)
      }
    }

    if (guardGltf) {
      this.fitHeight(guardGltf.scene, GUARD_HEIGHT)
      const flashTexture = this.createFlashTexture()
      for (const x of [-7, -3.5, 3.5, 7]) {
        this.guards.push(this.createGuard(guardGltf.scene.clone(), x, flashTexture))
      }
    }

    if (dollGltf) {
      this.doll = dollGltf.scene
      this.fitHeight(this.doll, DOLL_HEIGHT)
      // Stand the doll on the ground whatever the model's origin is
      const box = new THREE.Box3().setFromObject(this.doll)
      this.doll.position.set(0, -box.min.y, DOLL_Z)
      this.doll.rotation.y = this.dollYaw
      this.enableShadows(this.doll)
      this.scene.add(this.doll)
    }

    if (treeGltf) {
      const tree = treeGltf.scene
      tree.scale.setScalar(10)
      tree.position.set(0, 0, -60)
      this.scene.add(tree)
    }

    this.songAudio = this.loadAudio(`${AUDIO}/Cocoma.mp3`)
    this.redLightAudio = this.loadAudio(`${AUDIO}/Redlight.mp3`)

    this.phase = 'ready'
    this.emitHud(true)
  }

  // Scales a model so it stands the given height in world units
  private fitHeight(model: THREE.Object3D, height: number): void {
    model.scale.setScalar(1)
    model.updateMatrixWorld(true)
    const modelHeight = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).y
    if (modelHeight > 0 && Number.isFinite(modelHeight)) model.scale.setScalar(height / modelHeight)
  }

  private enableShadows(model: THREE.Object3D): void {
    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true
        child.receiveShadow = true
        // Skinned meshes animate outside their rest-pose bounds
        child.frustumCulled = false
      }
    })
  }

  /**
   * Run clips carry the hips forward and snap them back every loop, which shows
   * up as jitter. Pin the hips' horizontal position so the game alone moves the character.
   */
  private removeRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
    const inPlace = clip.clone()
    for (const track of inPlace.tracks) {
      if (!/hips\.position$/i.test(track.name)) continue
      for (let i = 0; i < track.values.length; i += 3) {
        track.values[i] = track.values[0]
        track.values[i + 2] = track.values[2]
      }
    }
    return inPlace
  }

  // Gives a contestant their own build, hair, tracksuit shade, and glasses
  private varyAppearance(model: THREE.Object3D): void {
    const pick = (values: number[]) => values[Math.floor(Math.random() * values.length)]
    model.traverse((child) => {
      const mesh = child as THREE.Mesh
      if (!mesh.isMesh || Array.isArray(mesh.material)) return
      // Clones share materials, so tint a private copy
      const material = (mesh.material as THREE.MeshPhongMaterial).clone()
      mesh.material = material
      if (mesh.name === 'Glasses') mesh.visible = Math.random() < 0.5
      if (mesh.name === 'Hair') material.emissive?.setHex(pick(HAIR_TINTS))
      if (mesh.name === 'Body') material.color?.setHex(pick(SUIT_TINTS))
    })
    const height = 0.92 + Math.random() * 0.16
    const build = 0.92 + Math.random() * 0.2
    model.scale.multiply(new THREE.Vector3(build, height, build))
  }

  private createFlashTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      gradient.addColorStop(0, 'rgba(255,255,230,1)')
      gradient.addColorStop(0.35, 'rgba(255,200,60,0.9)')
      gradient.addColorStop(1, 'rgba(255,120,0,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, 64, 64)
    }
    return new THREE.CanvasTexture(canvas)
  }

  private createGuard(model: THREE.Object3D, x: number, flashTexture: THREE.Texture): Guard {
    this.enableShadows(model)
    const pivot = new THREE.Group()
    pivot.add(model)
    pivot.position.set(x, 0, DOLL_Z + 1.5)
    this.scene.add(pivot)

    const flash = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: flashTexture, blending: THREE.AdditiveBlending, depthWrite: false })
    )
    flash.position.copy(MUZZLE_OFFSET)
    flash.visible = false
    pivot.add(flash)

    const tracer = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
      new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 })
    )
    tracer.frustumCulled = false
    tracer.visible = false
    this.scene.add(tracer)

    return {
      pivot, model, flash, tracer,
      swayOffset: Math.random() * Math.PI * 2,
      yaw: 0,
      recoil: 0,
      shotsLeft: 0,
      secondsToNextShot: 0,
      tracerSecondsLeft: 0,
    }
  }

  private createCharacter(
    model: THREE.Object3D,
    clips: Partial<Record<AnimationName, THREE.AnimationClip | undefined>>
  ): Character {
    this.enableShadows(model)
    // Animation clips may drive the model's own root transform, so steer a parent instead
    const pivot = new THREE.Group()
    pivot.add(model)
    this.scene.add(pivot)
    const mixer = new THREE.AnimationMixer(model)
    const actions: Character['actions'] = {}
    for (const [name, clip] of Object.entries(clips) as [AnimationName, THREE.AnimationClip | undefined][]) {
      if (!clip) continue
      const action = mixer.clipAction(clip)
      if (name === 'die') {
        action.setLoop(THREE.LoopOnce, 1)
        action.clampWhenFinished = true
      }
      actions[name] = action
    }
    actions.idle?.play()
    // Contestants face the doll (-Z); models face +Z at zero rotation
    pivot.rotation.y = Math.PI
    return { model: pivot, mixer, actions, animation: 'idle', velocity: new THREE.Vector2(), yaw: Math.PI, isAlive: true }
  }

  private setAnimation(character: Character, name: AnimationName): void {
    const next = character.actions[name]
    if (!next || character.animation === name) return
    character.actions[character.animation]?.fadeOut(ANIMATION_FADE_SECONDS)
    next.reset().fadeIn(ANIMATION_FADE_SECONDS).play()
    character.animation = name
  }

  // ---------- Game flow ----------

  start(): void {
    if (this.phase !== 'ready') return
    try {
      this.audioContext = new AudioContext()
    } catch {}
    this.beginGreen()
  }

  private beginGreen(): void {
    this.phase = 'green'
    this.greenSecondsTotal = this.nextGreenSeconds
    this.phaseSecondsLeft = this.nextGreenSeconds
    this.wasCaughtMoving = false
    this.currentQuestion = null
    this.clearPads()
    this.onQuestionChange?.(null)
    this.onFeedback?.(null)
    this.playAudio(this.songAudio)
    this.emitHud(true)
  }

  private beginTurn(): void {
    this.phase = 'turning'
    this.turnElapsed = 0
    this.songAudio?.pause()
    this.playAudio(this.redLightAudio)
    for (const npc of this.npcs) {
      const isCareless = Math.random() < NPC_CARELESS_CHANCE
      npc.stopDelay = isCareless ? TURN_SECONDS + 1 : Math.random() * TURN_SECONDS * 0.6
    }
    this.emitHud(true)
  }

  // The doll is now looking: anyone still moving is shot
  private checkForMovement(): void {
    let target: THREE.Vector3 | null = null
    for (const npc of this.npcs) {
      if (npc.isAlive && !npc.hasFinished && npc.velocity.length() > CAUGHT_SPEED) {
        this.kill(npc)
        target = npc.model.position
      }
    }
    if (this.player && this.player.velocity.length() > CAUGHT_SPEED) {
      this.wasCaughtMoving = true
      this.player.velocity.set(0, 0)
      this.loseLife()
      target = this.player.model.position
    }
    if (target) this.fireGuards(target)

    if (this.lives <= 0) {
      this.finish('eliminated')
    } else if (this.review.length >= this.totalQuestions) {
      this.finish('short')
    } else {
      this.beginQuestion()
    }
  }

  private beginQuestion(): void {
    // Step difficulty up after a correct answer and down after a wrong one
    const unused = this.pool.filter((q) => !this.review.some((item) => item.question.id === q.id))
    const distance = (q: SATQuestion) => Math.abs(DIFFICULTIES.indexOf(q.difficulty) - this.difficultyLevel)
    // A missed question returns after one other question, or sooner if nothing else is left
    const lastAsked = this.review[this.review.length - 1]?.question
    const retry = this.retryQueue.find((q) => q !== lastAsked) ?? (unused.length === 0 ? this.retryQueue[0] : undefined)
    if (retry) this.retryQueue.splice(this.retryQueue.indexOf(retry), 1)
    const question = retry ?? unused.sort((a, b) => distance(a) - distance(b))[0]
    if (!question) {
      this.finish('short')
      return
    }
    this.currentQuestion = question
    this.questionElapsed = 0
    this.hintsUsed = 0
    this.spawnPads(question.options.length)
    this.phase = 'question'
    this.onQuestionChange?.(question)
    this.emitHud(true)
  }

  // Lays one pad per answer on the sand just ahead of the player
  private spawnPads(count: number): void {
    this.clearPads()
    if (!this.player) return
    const { x, z } = this.player.model.position
    const span = (count - 1) * PAD_SPACING
    const limit = FIELD_HALF_WIDTH - span / 2 - PAD_RADIUS
    const centerX = THREE.MathUtils.clamp(x, -limit, limit)
    const padZ = Math.max(z - PAD_DISTANCE, DOLL_Z + 6)
    const geometry = new THREE.CircleGeometry(PAD_RADIUS, 40)

    for (let option = 0; option < count; option++) {
      const disc = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[option], transparent: true, opacity: 0.7 })
      )
      disc.rotation.x = -Math.PI / 2
      disc.position.set(centerX - span / 2 + option * PAD_SPACING, 0.04, padZ)
      this.scene.add(disc)

      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.createLetterTexture(option), depthTest: false }))
      label.position.set(disc.position.x, 2.7, padZ)
      label.scale.set(1.1, 1.1, 1)
      label.renderOrder = 10
      this.scene.add(label)
      this.pads.push({ option, disc, label })
    }
    this.standingPad = null
    this.standingSeconds = 0
  }

  private createLetterTexture(option: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = LANE_COLORS[option]
      ctx.beginPath()
      ctx.arc(64, 64, 58, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 8
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 80px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(LANE_LETTERS[option], 64, 70)
    }
    return new THREE.CanvasTexture(canvas)
  }

  private clearPads(): void {
    for (const { disc, label } of this.pads) {
      this.scene.remove(disc, label)
      ;(disc.material as THREE.Material).dispose()
      label.material.map?.dispose()
      label.material.dispose()
    }
    // One circle geometry is shared by a question's pads
    this.pads[0]?.disc.geometry.dispose()
    this.pads = []
    this.standingPad = null
    this.standingSeconds = 0
  }

  // A hint ruled this answer out: its pad disappears
  eliminatePad(option: number): void {
    const pad = this.pads.find((p) => p.option === option)
    if (!pad) return
    pad.disc.visible = false
    pad.label.visible = false
  }

  // Locks in the pad the player is standing on, without waiting for the timer
  lockIn(): void {
    if (this.phase === 'question' && this.standingPad !== null) this.answer(this.standingPad)
  }

  // Standing on a pad picks that answer; staying there locks it in
  private updatePads(dt: number): void {
    if (this.phase !== 'question' || !this.player) return
    const position = this.player.model.position
    const pad = this.pads.find(
      (p) => p.disc.visible && Math.hypot(p.disc.position.x - position.x, p.disc.position.z - position.z) < PAD_RADIUS
    )
    const standing = pad ? pad.option : null
    this.standingSeconds = standing !== null && standing === this.standingPad ? this.standingSeconds + dt : 0
    this.standingPad = standing

    for (const p of this.pads) {
      const material = p.disc.material as THREE.MeshBasicMaterial
      material.opacity = p.option === standing ? 0.95 : 0.55
      p.disc.scale.setScalar(p.option === standing ? 1 + 0.06 * Math.sin(this.elapsed * 8) : 1)
    }
    if (standing !== null && this.standingSeconds >= PAD_LOCK_SECONDS) this.answer(standing)
  }

  answer(selected: number | null): void {
    const question = this.currentQuestion
    if (this.phase !== 'question' || !question) return

    const isCorrect = selected === question.correctAnswer
    const timeSpent = Math.round(this.questionElapsed * 1000)
    this.attempts.push({ questionId: question.id, topic: question.topic, difficulty: question.difficulty, isCorrect, timeSpent, question, selected })
    this.review.push({ question, selected, isCorrect, timeSpent })

    let points = 0
    if (isCorrect) {
      this.correctAnswers++
      this.streak++
      this.maxStreak = Math.max(this.maxStreak, this.streak)
      this.difficultyLevel = Math.min(DIFFICULTIES.length - 1, this.difficultyLevel + 1)
      const timeLeftShare = Math.max(0, 1 - this.questionElapsed / this.config.secondsPerQuestion)
      // Each hint makes the question worth less
      points = Math.round((DIFFICULTY_POINTS[question.difficulty] + 50 * timeLeftShare) * Math.pow(HINT_POINTS_FACTOR, this.hintsUsed))
      this.setState({ score: this.getState().score + points })
      this.playTone([660, 880])
    } else {
      this.wrongAnswers++
      this.streak = 0
      this.difficultyLevel = Math.max(0, this.difficultyLevel - 1)
      if (this.player) this.fireGuards(this.player.model.position)
      this.loseLife()
    }

    // A first miss comes back later instead of showing the answer
    const willRetry = !isCorrect && !this.retriedIds.has(question.id)
    if (willRetry) {
      this.retriedIds.add(question.id)
      this.retryQueue.push(question)
    }

    // The chosen pad turns green or red; the right one stays hidden if the question will return
    for (const pad of this.pads) {
      const material = pad.disc.material as THREE.MeshBasicMaterial
      if (pad.option === selected) material.color.set(isCorrect ? 0x16a34a : 0xdc2626)
      else if (pad.option === question.correctAnswer && !willRetry) material.color.set(0x16a34a)
      else material.color.set(0x6b7280)
    }

    this.nextGreenSeconds = isCorrect ? GREEN_SECONDS_CORRECT : GREEN_SECONDS_WRONG
    this.phase = 'feedback'
    this.phaseSecondsLeft = isCorrect ? CORRECT_FEEDBACK_SECONDS : WRONG_FEEDBACK_SECONDS
    this.onFeedback?.({ isCorrect, selected, correctAnswer: question.correctAnswer, points, willRetry })
    this.emitHud(true)
  }

  // Called each time the player takes a hint on the current question
  registerHint(): void {
    this.hintsUsed++
  }

  skipFeedback(): void {
    if (this.phase === 'feedback') this.phaseSecondsLeft = 0
  }

  private loseLife(): void {
    this.lives = Math.max(0, this.lives - 1)
    this.setState({ lives: this.lives })
  }

  private kill(character: Character): void {
    character.isAlive = false
    character.velocity.set(0, 0)
    this.setAnimation(character, 'die')
  }

  // Each guard fires a short burst at the target
  private fireGuards(target: THREE.Vector3): void {
    this.shotTarget.copy(target).setY(1.1)
    this.guards.forEach((guard, i) => {
      guard.shotsLeft = SHOTS_PER_BURST
      // Stagger the guards so the volley doesn't land on a single frame
      guard.secondsToNextShot = i * 0.04
    })
  }

  private finish(outcome: SquidOutcome): void {
    if (this.outcome) return
    this.outcome = outcome
    this.songAudio?.pause()
    this.currentQuestion = null
    this.clearPads()
    this.onQuestionChange?.(null)
    this.onFeedback?.(null)
    if (this.player) {
      this.player.velocity.set(0, 0)
      if (outcome === 'eliminated') this.kill(this.player)
      else this.setAnimation(this.player, 'idle')
    }
    if (outcome === 'victory') {
      this.setState({ score: this.getState().score + FINISH_BONUS + this.lives * 100 })
      this.playTone([523, 659, 784, 1047])
    }
    // Hold on the scene for a moment before the results appear
    this.phase = 'done'
    this.phaseSecondsLeft = END_DELAY_SECONDS
    this.emitHud(true)
  }

  private generateAnalytics(): GameAnalytics {
    const topicPerformance: GameAnalytics['topicPerformance'] = {}
    this.attempts.forEach((attempt) => {
      const perf = (topicPerformance[attempt.topic] ||= { correct: 0, total: 0, accuracy: 0 })
      perf.total++
      if (attempt.isCorrect) perf.correct++
      perf.accuracy = (perf.correct / perf.total) * 100
    })
    const totalTime = this.attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0)

    return {
      gameId: 'squid-game',
      score: this.getState().score,
      accuracy: (this.correctAnswers / (this.correctAnswers + this.wrongAnswers)) * 100 || 0,
      correctAnswers: this.correctAnswers,
      wrongAnswers: this.wrongAnswers,
      questionAttempts: this.attempts,
      topicPerformance,
      streakInfo: { maxStreak: this.maxStreak },
      averageResponseTime: this.attempts.length > 0 ? Math.round(totalTime / this.attempts.length) : 0,
    }
  }

  // ---------- Frame update ----------

  update(deltaTime: number): void {
    if (this.getState().isPaused || this.phase === 'loading') return
    const dt = deltaTime / 1000
    this.elapsed += dt

    if (this.phase === 'green') {
      this.phaseSecondsLeft -= dt
      if (this.phaseSecondsLeft <= 0) this.beginTurn()
    } else if (this.phase === 'turning') {
      this.turnElapsed += dt
      if (this.turnElapsed >= TURN_SECONDS) this.checkForMovement()
    } else if (this.phase === 'question') {
      this.questionElapsed += dt
      if (this.questionElapsed >= this.config.secondsPerQuestion) this.answer(null)
    } else if (this.phase === 'feedback') {
      this.phaseSecondsLeft -= dt
      if (this.phaseSecondsLeft <= 0) {
        if (this.lives <= 0) this.finish('eliminated')
        else this.beginGreen()
      }
    } else if (this.phase === 'done' && this.phaseSecondsLeft > 0) {
      this.phaseSecondsLeft -= dt
      if (this.phaseSecondsLeft <= 0 && this.outcome) {
        this.setState({ isGameOver: true })
        this.onGameOver?.(this.generateAnalytics(), this.review, this.outcome)
      }
    }

    this.updatePlayer(dt)
    this.updatePads(dt)
    this.updateNpcs(dt)
    this.updateDoll(dt)
    this.updateGuards(dt)
    this.updateCamera(dt)
    this.emitHud(false)
  }

  private updatePlayer(dt: number): void {
    const player = this.player
    if (!player) return
    player.mixer.update(dt)
    if (!player.isAlive) return

    // The player runs on green, and walks to an answer pad when a question is up
    const canMove = this.phase === 'green' || this.phase === 'turning' || this.phase === 'question'
    const target = new THREE.Vector2()
    if (canMove) {
      const has = (...keys: string[]) => keys.some((key) => this.keysDown.has(key))
      target.set(
        Number(has('d', 'arrowright')) - Number(has('a', 'arrowleft')),
        Number(has('s', 'arrowdown')) - Number(has('w', 'arrowup'))
      )
      if (target.lengthSq() > 0) target.normalize().multiplyScalar(this.runSpeed)
    }
    this.moveCharacter(player, target, dt)
    // Answering is not a way to gain ground: the player can't walk past the pads
    const padZ = this.pads[0]?.disc.position.z
    if (this.phase === 'question' && padZ !== undefined) {
      player.model.position.z = Math.max(player.model.position.z, padZ - PAD_RADIUS)
    }

    if (this.phase === 'green' && player.model.position.z <= FINISH_Z) this.finish('victory')
  }

  private updateNpcs(dt: number): void {
    for (const npc of this.npcs) {
      npc.mixer.update(dt)
      if (!npc.isAlive) continue

      const isRunning =
        !npc.hasFinished && (this.phase === 'green' || (this.phase === 'turning' && this.turnElapsed < npc.stopDelay))
      this.moveCharacter(npc, new THREE.Vector2(0, isRunning ? -npc.maxSpeed : 0), dt)
      if (npc.model.position.z <= FINISH_Z - 1) npc.hasFinished = true
    }
  }

  // Eases a character toward a target velocity and keeps its animation and facing in step
  private moveCharacter(character: Character, targetVelocity: THREE.Vector2, dt: number): void {
    // Stopping is quicker than starting so a freeze reads as a freeze
    const rate = targetVelocity.lengthSq() > 0 ? 8 : 14
    character.velocity.lerp(targetVelocity, damp(rate, dt))
    const speed = character.velocity.length()

    const position = character.model.position
    position.x = THREE.MathUtils.clamp(position.x + character.velocity.x * dt, -FIELD_HALF_WIDTH, FIELD_HALF_WIDTH)
    position.z = THREE.MathUtils.clamp(position.z + character.velocity.y * dt, DOLL_Z + 4, START_Z + 2)

    if (speed > 0.3) {
      character.yaw = dampAngle(character.yaw, Math.atan2(character.velocity.x, character.velocity.y), 12, dt)
      character.model.rotation.y = character.yaw
      this.setAnimation(character, 'run')
      // Match stride to ground speed so feet don't slide
      character.actions.run?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / RUN_ANIMATION_SPEED, 0.6, 1.3))
    } else {
      this.setAnimation(character, 'idle')
    }
  }

  private updateGuards(dt: number): void {
    const aimAt = this.player?.model.position
    for (const guard of this.guards) {
      // Keep the rifle trained on the player, with a slight idle sway
      if (aimAt) {
        const targetYaw = Math.atan2(aimAt.x - guard.pivot.position.x, aimAt.z - guard.pivot.position.z)
        guard.yaw = dampAngle(guard.yaw, targetYaw, 3, dt)
      }
      const sway = Math.sin(this.elapsed * 1.3 + guard.swayOffset)
      guard.pivot.rotation.set(-0.1 * guard.recoil, guard.yaw + sway * 0.02, sway * 0.012)
      guard.pivot.position.y = Math.sin(this.elapsed * 2 + guard.swayOffset) * 0.012

      guard.secondsToNextShot -= dt
      if (guard.shotsLeft > 0 && guard.secondsToNextShot <= 0) {
        guard.shotsLeft--
        guard.secondsToNextShot = SECONDS_BETWEEN_SHOTS
        guard.recoil = 1
        guard.tracerSecondsLeft = TRACER_SECONDS
        const muzzle = guard.pivot.localToWorld(MUZZLE_OFFSET.clone())
        guard.tracer.geometry.setFromPoints([muzzle, this.shotTarget])
        if (guard === this.guards[0]) this.playGunshot()
      }

      guard.recoil = Math.max(0, guard.recoil - 7 * dt)
      guard.model.position.z = -0.12 * guard.recoil
      guard.flash.visible = guard.recoil > 0.5
      guard.flash.scale.setScalar(0.6 + guard.recoil * 0.5)
      guard.tracerSecondsLeft -= dt
      guard.tracer.visible = guard.tracerSecondsLeft > 0
    }

    if (this.playerMarker) {
      this.playerMarker.scale.setScalar(1 + 0.08 * Math.sin(this.elapsed * 4))
    }
  }

  private updateDoll(dt: number): void {
    if (!this.doll) return
    // She watches the field from the moment she starts turning until the next green light
    const isWatching = this.phase !== 'green' && this.phase !== 'ready'
    this.dollYaw = dampAngle(this.dollYaw, isWatching ? 0 : Math.PI, 5 / TURN_SECONDS, dt)
    this.doll.rotation.y = this.dollYaw
  }

  private updateCamera(dt: number): void {
    if (!this.player) return
    const { x, z } = this.player.model.position
    // Trail behind the player, drifting sideways less than they do, so the field stays centered
    const target = new THREE.Vector3(x * CAMERA_SIDE_FOLLOW, CAMERA_HEIGHT, z + CAMERA_BEHIND)
    this.camera.position.lerp(target, damp(4, dt))
    this.camera.lookAt(this.camera.position.x * 0.5, CAMERA_LOOK_HEIGHT, this.camera.position.z - CAMERA_LOOK_AHEAD)
  }

  private emitHud(force: boolean): void {
    const nowMs = performance.now()
    if (!force && nowMs - this.lastHudUpdateMs < HUD_UPDATE_INTERVAL_MS) return
    this.lastHudUpdateMs = nowMs
    const playerZ = this.player?.model.position.z ?? START_Z
    this.onHudChange?.({
      phase: this.phase,
      loadProgress: this.loadProgress,
      score: this.getState().score,
      lives: this.lives,
      maxLives: this.maxLives,
      progress: THREE.MathUtils.clamp((START_Z - playerZ) / (START_Z - FINISH_Z), 0, 1),
      questionNumber: Math.min(this.review.length + (this.phase === 'question' ? 1 : 0), this.totalQuestions),
      totalQuestions: this.totalQuestions,
      correctAnswers: this.correctAnswers,
      questionSecondsLeft: Math.max(0, this.config.secondsPerQuestion - this.questionElapsed),
      questionSecondsTotal: this.config.secondsPerQuestion,
      greenSecondsLeft: this.phase === 'green' ? Math.max(0, this.phaseSecondsLeft) : 0,
      greenSecondsTotal: this.greenSecondsTotal,
      standingPad: this.standingPad,
      lockProgress: Math.min(1, this.standingSeconds / PAD_LOCK_SECONDS),
      wasCaughtMoving: this.wasCaughtMoving,
      isPaused: this.getState().isPaused,
      isMuted: this.isMuted,
    })
  }

  render(): void {
    if (this.renderer) this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.renderer?.setSize(width, height, false)
    this.applyViewShift()
  }

  // Shifts the scene sideways so the player stays clear of the question panel
  setViewShift(x: number, y = 0): void {
    this.viewShift = { x, y }
    this.applyViewShift()
  }

  private applyViewShift(): void {
    if (!this.camera) return
    this.camera.aspect = this.width / this.height
    if (this.viewShift.x || this.viewShift.y) {
      this.camera.setViewOffset(this.width, this.height, -this.viewShift.x, -this.viewShift.y, this.width, this.height)
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
    if (this.phase === 'ready' && (key === ' ' || key === 'Enter')) {
      this.start()
    } else if (this.phase === 'feedback' && (key === ' ' || key === 'Enter')) {
      this.skipFeedback()
    } else if (this.phase === 'question' && key === ' ') {
      this.lockIn()
    }
    this.keysDown.add(lower)
  }

  handleKeyRelease(key: string): void {
    this.keysDown.delete(key.toLowerCase())
  }

  setPaused(paused: boolean): void {
    if (this.phase === 'loading' || this.phase === 'ready' || this.phase === 'done') return
    this.setState({ isPaused: paused })
    this.keysDown.clear()
    if (paused) this.songAudio?.pause()
    else if (this.phase === 'green') this.songAudio?.play().catch(() => {})
    this.emitHud(true)
  }

  // ---------- Audio ----------

  setMuted(muted: boolean): void {
    this.isMuted = muted
    for (const audio of [this.songAudio, this.redLightAudio]) {
      if (audio) audio.muted = muted
    }
    this.emitHud(true)
  }

  private loadAudio(path: string): HTMLAudioElement | null {
    try {
      const audio = new Audio(path)
      audio.preload = 'auto'
      audio.volume = 0.7
      return audio
    } catch {
      return null
    }
  }

  private playAudio(audio: HTMLAudioElement | null): void {
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

  // Burst of decaying noise
  private playGunshot(): void {
    const ctx = this.audioContext
    if (!ctx || this.isMuted) return
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 4)
    }
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = 0.4
    source.buffer = buffer
    source.connect(gain).connect(ctx.destination)
    source.start()
  }

  cleanup(): void {
    this.disposed = true
    for (const audio of [this.songAudio, this.redLightAudio]) {
      if (!audio) continue
      try {
        audio.pause()
        audio.src = ''
        audio.load()
      } catch {}
    }
    this.songAudio = null
    this.redLightAudio = null
    this.audioContext?.close().catch(() => {})
    this.audioContext = null

    this.scene?.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer?.dispose()
  }
}
