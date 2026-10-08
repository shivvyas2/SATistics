import * as THREE from 'three'
import { LANE_COLORS, LANE_LETTERS } from '@/games/subway-surfers/types/game'
import { ZombieConfig, ZombieFeedback, ZombieHudState, ZombiePhase, ZombieReviewItem } from './types'
import type { SATQuestion } from '@/lib/api/questions'
import type { GameAnalytics, QuestionAttempt } from '@/games/whackamole/types'

type Difficulty = SATQuestion['difficulty']

interface Zombie {
  lane: number
  group: THREE.Group
  leftLeg: THREE.Mesh
  rightLeg: THREE.Mesh
  walkOffset: number
  state: 'walking' | 'hit' | 'sinking'
  // Meshes a shot can land on
  hitMeshes: THREE.Mesh[]
}

interface Particle {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  secondsLeft: number
}

const SPAWN_Z = -26
// Zombies stop this close to the player; arriving here means time is up
const ARRIVE_Z = 1.5
const ZOMBIE_SPACING = 4.2
const PLAYER_EYE = new THREE.Vector3(0, 1.7, 6)
const MAX_HEALTH = 4
const CORRECT_FEEDBACK_SECONDS = 1.6
const WRONG_FEEDBACK_SECONDS = 7
const DIFFICULTY_POINTS: Record<Difficulty, number> = { easy: 100, medium: 150, hard: 200 }
// Share of a question's points kept for each zombie a hint removes
const HINT_POINTS_FACTOR = 0.6
// How far the view turns toward the edges of the screen, in radians
const AIM_YAW = 0.22
const AIM_PITCH = 0.1
const PARTICLE_SECONDS = 0.9
const HUD_UPDATE_INTERVAL_MS = 100

// Framerate-independent smoothing factor
function damp(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt)
}

/**
 * Zombie Apocalypse
 * Each zombie carries one answer. Shoot the one with the right answer before
 * the horde reaches you. A wrong shot or running out of time costs health.
 */
export class ZombieGame {
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private raycaster = new THREE.Raycaster()
  private gun = new THREE.Group()
  private muzzleLight = new THREE.PointLight(0xffc266, 0, 12)
  private zombies: Zombie[] = []
  private particles: Particle[] = []
  private particleGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12)
  // Where the player is aiming, -1 to 1 across and up the screen
  private aim = new THREE.Vector2()
  private recoil = 0
  private viewShift = { x: 0, y: 0 }
  private elapsed = 0

  // Game state
  private phase: ZombiePhase = 'ready'
  private queue: SATQuestion[]
  private totalQuestions: number
  private currentQuestion: SATQuestion | null = null
  private retriedIds = new Set<number>()
  private questionElapsed = 0
  private phaseSecondsLeft = 0
  private hintsUsed = 0
  private score = 0
  private streak = 0
  private maxStreak = 0
  private health = MAX_HEALTH
  private correctAnswers = 0
  private wrongAnswers = 0
  private attempts: QuestionAttempt[] = []
  private review: ZombieReviewItem[] = []
  private isPaused = false

  // Audio
  private audioContext: AudioContext | null = null
  private isMuted = false

  private lastHudUpdateMs = 0

  // Callbacks
  public onHudChange?: (state: ZombieHudState) => void
  public onQuestionChange?: (question: SATQuestion | null) => void
  public onFeedback?: (feedback: ZombieFeedback | null) => void
  public onGameOver?: (analytics: GameAnalytics, review: ZombieReviewItem[], survived: boolean) => void

  constructor(
    private width: number,
    private height: number,
    canvas: HTMLCanvasElement,
    questions: SATQuestion[],
    private config: ZombieConfig
  ) {
    this.queue = questions.slice(0, config.questionCount)
    this.totalQuestions = this.queue.length

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(width, height, false)

    this.camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 200)
    this.camera.position.copy(PLAYER_EYE)
    this.scene.add(this.camera)

    this.buildGraveyard()
    this.buildGun()
    this.emitHud(true)
  }

  // ---------- Scene ----------

  private buildGraveyard(): void {
    const night = 0x0b1030
    this.scene.background = new THREE.Color(night)
    this.scene.fog = new THREE.Fog(night, 18, 60)

    this.scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x2a3a2a, 2.4))
    const moonlight = new THREE.DirectionalLight(0xbfd0ff, 1.8)
    moonlight.position.set(-12, 20, -10)
    this.scene.add(moonlight)

    const moon = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 24), new THREE.MeshBasicMaterial({ color: 0xfdf6d8, fog: false }))
    moon.position.set(-22, 26, -70)
    this.scene.add(moon)

    const starPositions: number[] = []
    for (let i = 0; i < 300; i++) {
      starPositions.push((Math.random() - 0.5) * 240, 12 + Math.random() * 60, -90 + Math.random() * 20)
    }
    const starGeometry = new THREE.BufferGeometry()
    starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3))
    this.scene.add(new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, fog: false })))

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: 0x1f3d2b }))
    ground.rotation.x = -Math.PI / 2
    this.scene.add(ground)

    // Dirt path the horde walks down
    const path = new THREE.Mesh(new THREE.PlaneGeometry(22, 60), new THREE.MeshLambertMaterial({ color: 0x3b3326 }))
    path.rotation.x = -Math.PI / 2
    path.position.set(0, 0.01, -18)
    this.scene.add(path)

    const stone = new THREE.MeshLambertMaterial({ color: 0x8b8f9c })
    const wood = new THREE.MeshLambertMaterial({ color: 0x2a1c12 })
    for (let i = 0; i < 26; i++) {
      // Tombstones and dead trees line both sides of the path
      const side = i % 2 === 0 ? 1 : -1
      const x = side * (13 + Math.random() * 16)
      const z = -42 + Math.random() * 44
      if (i % 3 === 0) {
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.45, 5, 6), wood)
        trunk.position.set(x, 2.5, z)
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 2.6, 5), wood)
        branch.position.set(0.8, 1.2, 0)
        branch.rotation.z = -0.9
        trunk.add(branch)
        this.scene.add(trunk)
      } else {
        const tombstone = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 0.3), stone)
        tombstone.position.set(x, 0.75, z)
        tombstone.rotation.y = (Math.random() - 0.5) * 0.5
        tombstone.rotation.z = (Math.random() - 0.5) * 0.15
        this.scene.add(tombstone)
      }
    }
  }

  private buildGun(): void {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2c2f38, metalness: 0.7, roughness: 0.35 })
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.6), metal)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.5, 10), metal)
    barrel.rotation.x = Math.PI / 2
    barrel.position.set(0, 0.04, -0.5)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.26, 0.14), new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 0.8 }))
    grip.position.set(0, -0.2, 0.14)
    grip.rotation.x = -0.3
    this.gun.add(body, barrel, grip)
    this.muzzleLight.position.set(0, 0.04, -0.8)
    this.gun.add(this.muzzleLight)
    this.gun.scale.setScalar(0.35)
    this.gun.position.set(0.3, -0.26, -0.7)
    this.camera.add(this.gun)
  }

  private createZombie(lane: number, laneCount: number): Zombie {
    const group = new THREE.Group()
    const skin = new THREE.MeshLambertMaterial({ color: 0x7fae6c })
    const shirt = new THREE.MeshLambertMaterial({ color: LANE_COLORS[lane] })
    const trousers = new THREE.MeshLambertMaterial({ color: 0x2f3440 })
    const part = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(x, y, z)
      group.add(mesh)
      return mesh
    }

    const torso = part(new THREE.BoxGeometry(0.95, 1.1, 0.5), shirt, 0, 1.45, 0)
    const head = part(new THREE.BoxGeometry(0.6, 0.6, 0.6), skin, 0, 2.35, 0)
    const armGeometry = new THREE.BoxGeometry(0.24, 0.24, 0.95)
    const leftArm = part(armGeometry, skin, -0.6, 1.75, 0.45)
    const rightArm = part(armGeometry, skin, 0.6, 1.75, 0.45)
    // Legs pivot at the hip so they can swing
    const legGeometry = new THREE.BoxGeometry(0.34, 0.9, 0.36).translate(0, -0.45, 0)
    const leftLeg = part(legGeometry, trousers, -0.24, 0.9, 0)
    const rightLeg = part(legGeometry, trousers, 0.24, 0.9, 0)

    const eyes = new THREE.MeshBasicMaterial({ color: 0xff3b30 })
    part(new THREE.SphereGeometry(0.07, 8, 8), eyes, -0.15, 2.42, 0.31)
    part(new THREE.SphereGeometry(0.07, 8, 8), eyes, 0.15, 2.42, 0.31)

    // Answer letter on a sign above the head
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.createSignTexture(lane), depthTest: false }))
    sign.position.y = 3.35
    sign.scale.set(1.5, 1.5, 1)
    sign.renderOrder = 10
    group.add(sign)

    group.position.set((lane - (laneCount - 1) / 2) * ZOMBIE_SPACING, 0, SPAWN_Z - Math.random() * 2)
    this.scene.add(group)
    return {
      lane,
      group,
      leftLeg,
      rightLeg,
      walkOffset: Math.random() * Math.PI * 2,
      state: 'walking',
      hitMeshes: [torso, head, leftArm, rightArm, leftLeg, rightLeg],
    }
  }

  private createSignTexture(lane: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = LANE_COLORS[lane]
      ctx.beginPath()
      ctx.arc(64, 64, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 8
      ctx.strokeStyle = '#ffffff'
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 84px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(LANE_LETTERS[lane], 64, 70)
    }
    return new THREE.CanvasTexture(canvas)
  }

  private clearZombies(): void {
    for (const zombie of this.zombies) {
      this.scene.remove(zombie.group)
      zombie.group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose()
        if (child instanceof THREE.Sprite) {
          child.material.map?.dispose()
          child.material.dispose()
        }
      })
    }
    this.zombies = []
  }

  // ---------- Game flow ----------

  start(): void {
    if (this.phase !== 'ready') return
    try {
      this.audioContext = new AudioContext()
    } catch {}
    this.nextQuestion()
  }

  private nextQuestion(): void {
    this.clearZombies()
    this.onFeedback?.(null)
    const question = this.queue.shift()
    if (!question || this.health <= 0) {
      this.finish()
      return
    }
    this.currentQuestion = question
    this.questionElapsed = 0
    this.hintsUsed = 0
    for (let lane = 0; lane < question.options.length; lane++) {
      this.zombies.push(this.createZombie(lane, question.options.length))
    }
    this.phase = 'question'
    this.onQuestionChange?.(question)
    this.emitHud(true)
  }

  // Fires at a point on the screen, in pixels from the top left of the canvas
  shootAt(x: number, y: number): void {
    if (this.phase !== 'question' || this.isPaused) return
    this.setAim(x, y)
    this.fireEffects()

    const pointer = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1)
    this.camera.updateMatrixWorld()
    this.raycaster.setFromCamera(pointer, this.camera)
    const targets = this.zombies.filter((z) => z.state === 'walking').flatMap((z) => z.hitMeshes)
    const hit = this.raycaster.intersectObjects(targets, false)[0]
    if (!hit) return
    const zombie = this.zombies.find((z) => z.hitMeshes.includes(hit.object as THREE.Mesh))
    if (zombie) this.resolveAnswer(zombie.lane)
  }

  // Shoots the zombie carrying an answer, for players who pick from the answer list
  shootZombie(lane: number): void {
    const zombie = this.zombies.find((z) => z.lane === lane && z.state === 'walking')
    if (this.phase !== 'question' || this.isPaused || !zombie) return
    this.fireEffects()
    this.resolveAnswer(lane)
  }

  // A hint removed this answer: its zombie sinks back into the ground
  eliminateZombie(lane: number): void {
    const zombie = this.zombies.find((z) => z.lane === lane)
    if (this.phase !== 'question' || !zombie) return
    zombie.state = 'sinking'
    this.hintsUsed++
  }

  private resolveAnswer(selected: number | null): void {
    const question = this.currentQuestion
    if (!question || this.phase !== 'question') return

    const isCorrect = selected === question.correctAnswer
    const timeSpent = Math.round(this.questionElapsed * 1000)
    this.attempts.push({ questionId: question.id, topic: question.topic, difficulty: question.difficulty, isCorrect, timeSpent, question, selected })
    this.review.push({ question, selected, isCorrect, timeSpent })

    let points = 0
    if (isCorrect) {
      this.correctAnswers++
      this.streak++
      this.maxStreak = Math.max(this.maxStreak, this.streak)
      const timeLeftShare = Math.max(0, 1 - this.questionElapsed / this.config.secondsPerQuestion)
      const base = DIFFICULTY_POINTS[question.difficulty] + 50 * timeLeftShare + 10 * Math.min(this.streak, 5)
      points = Math.round(base * Math.pow(HINT_POINTS_FACTOR, this.hintsUsed))
      this.score += points
      this.playTone([660, 880, 1320])
    } else {
      this.wrongAnswers++
      this.streak = 0
      this.health--
      this.playTone([180, 120])
    }

    // A first miss goes to the back of the line instead of showing the answer
    const willRetry = !isCorrect && this.health > 0 && !this.retriedIds.has(question.id)
    if (willRetry) {
      this.retriedIds.add(question.id)
      this.queue.push(question)
      this.totalQuestions++
    }

    for (const zombie of this.zombies) {
      if (zombie.state !== 'walking') continue
      if (zombie.lane === selected) {
        // A right shot blows the zombie apart; a wrong one only makes it flinch
        zombie.state = isCorrect ? 'hit' : 'walking'
        this.spawnParticles(zombie.group.position, isCorrect ? 0x7fae6c : 0xff3b30, isCorrect ? 40 : 12)
        if (isCorrect) zombie.group.visible = false
      } else if (isCorrect) {
        zombie.state = 'sinking'
      }
    }

    this.phase = 'feedback'
    this.phaseSecondsLeft = isCorrect ? CORRECT_FEEDBACK_SECONDS : WRONG_FEEDBACK_SECONDS
    this.onFeedback?.({ isCorrect, selected, correctAnswer: question.correctAnswer, points, willRetry })
    this.emitHud(true)
  }

  skipFeedback(): void {
    if (this.phase === 'feedback') this.phaseSecondsLeft = 0
  }

  private finish(): void {
    this.phase = 'done'
    this.currentQuestion = null
    this.onQuestionChange?.(null)
    this.emitHud(true)
    this.onGameOver?.(this.generateAnalytics(), this.review, this.health > 0)
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
      gameId: 'zombie',
      score: this.score,
      accuracy: (this.correctAnswers / (this.correctAnswers + this.wrongAnswers)) * 100 || 0,
      correctAnswers: this.correctAnswers,
      wrongAnswers: this.wrongAnswers,
      questionAttempts: this.attempts,
      topicPerformance,
      streakInfo: { maxStreak: this.maxStreak },
      averageResponseTime: this.attempts.length > 0 ? Math.round(totalTime / this.attempts.length) : 0,
    }
  }

  // ---------- Effects ----------

  private fireEffects(): void {
    this.recoil = 1
    this.muzzleLight.intensity = 6
    this.playGunshot()
  }

  private spawnParticles(at: THREE.Vector3, color: number, count: number): void {
    const material = new THREE.MeshBasicMaterial({ color })
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeometry, material)
      mesh.position.copy(at).setY(0.6 + Math.random() * 1.8)
      this.scene.add(mesh)
      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 7, 2 + Math.random() * 5, (Math.random() - 0.5) * 7),
        secondsLeft: PARTICLE_SECONDS,
      })
    }
  }

  private updateParticles(dt: number): void {
    for (const particle of this.particles) {
      particle.secondsLeft -= dt
      particle.velocity.y -= 14 * dt
      particle.mesh.position.addScaledVector(particle.velocity, dt)
      particle.mesh.scale.setScalar(Math.max(0, particle.secondsLeft / PARTICLE_SECONDS))
      if (particle.secondsLeft <= 0) this.scene.remove(particle.mesh)
    }
    this.particles = this.particles.filter((particle) => particle.secondsLeft > 0)
  }

  // ---------- Frame update ----------

  update(deltaTime: number): void {
    if (this.isPaused) return
    const dt = deltaTime / 1000
    this.elapsed += dt

    if (this.phase === 'question') {
      this.questionElapsed += dt
      if (this.questionElapsed >= this.config.secondsPerQuestion) this.resolveAnswer(null)
    } else if (this.phase === 'feedback') {
      this.phaseSecondsLeft -= dt
      if (this.phaseSecondsLeft <= 0) this.nextQuestion()
    }

    this.updateZombies(dt)
    this.updateParticles(dt)

    // Turn the view and the gun toward where the player is aiming
    const yaw = -this.aim.x * AIM_YAW
    const pitch = this.aim.y * AIM_PITCH
    this.camera.rotation.order = 'YXZ'
    this.camera.rotation.y += (yaw - this.camera.rotation.y) * damp(6, dt)
    this.camera.rotation.x += (pitch - this.camera.rotation.x) * damp(6, dt)
    this.recoil = Math.max(0, this.recoil - 6 * dt)
    this.muzzleLight.intensity = Math.max(0, this.muzzleLight.intensity - 40 * dt)
    this.gun.position.z = -0.7 + 0.08 * this.recoil
    this.gun.rotation.x = 0.25 * this.recoil + Math.sin(this.elapsed * 1.2) * 0.01

    this.emitHud(false)
  }

  private updateZombies(dt: number): void {
    // The horde covers the path in exactly the time the question allows
    const speed = (ARRIVE_Z - SPAWN_Z) / this.config.secondsPerQuestion
    for (const zombie of this.zombies) {
      const { group } = zombie
      if (zombie.state === 'sinking') {
        group.position.y -= 2.2 * dt
        if (group.position.y < -3.6) group.visible = false
        continue
      }
      if (zombie.state !== 'walking') continue

      const swing = Math.sin(this.elapsed * 5 + zombie.walkOffset)
      if (this.phase === 'question') {
        group.position.z = Math.min(ARRIVE_Z, group.position.z + speed * dt)
        // Drift toward the player as they close in
        group.position.x += -group.position.x * 0.012 * speed * dt
        zombie.leftLeg.rotation.x = swing * 0.6
        zombie.rightLeg.rotation.x = -swing * 0.6
      }
      group.position.y = Math.abs(swing) * 0.06
      group.rotation.z = swing * 0.05
      group.lookAt(PLAYER_EYE.x, group.position.y, PLAYER_EYE.z)
    }
  }

  private emitHud(force: boolean): void {
    const nowMs = performance.now()
    if (!force && nowMs - this.lastHudUpdateMs < HUD_UPDATE_INTERVAL_MS) return
    this.lastHudUpdateMs = nowMs
    this.onHudChange?.({
      phase: this.phase,
      score: this.score,
      streak: this.streak,
      health: this.health,
      maxHealth: MAX_HEALTH,
      questionNumber: Math.min(this.review.length + (this.phase === 'question' ? 1 : 0), this.totalQuestions),
      totalQuestions: this.totalQuestions,
      secondsLeft: Math.max(0, this.config.secondsPerQuestion - this.questionElapsed),
      secondsTotal: this.config.secondsPerQuestion,
      isPaused: this.isPaused,
      isMuted: this.isMuted,
    })
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.renderer.setSize(width, height, false)
    this.applyViewShift()
  }

  // Shifts the scene so the horde stays clear of the question panel
  setViewShift(x: number, y = 0): void {
    this.viewShift = { x, y }
    this.applyViewShift()
  }

  private applyViewShift(): void {
    this.camera.aspect = this.width / this.height
    if (this.viewShift.x || this.viewShift.y) {
      this.camera.setViewOffset(this.width, this.height, -this.viewShift.x, -this.viewShift.y, this.width, this.height)
    } else {
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }

  // ---------- Input ----------

  // Points the gun at a spot on the screen, in pixels from the top left of the canvas
  setAim(x: number, y: number): void {
    this.aim.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1)
  }

  setPaused(paused: boolean): void {
    if (this.phase === 'ready' || this.phase === 'done') return
    this.isPaused = paused
    this.emitHud(true)
  }

  // ---------- Audio ----------

  setMuted(muted: boolean): void {
    this.isMuted = muted
    this.emitHud(true)
  }

  // Short synthesized chime, one note after another
  private playTone(frequencies: number[]): void {
    const ctx = this.audioContext
    if (!ctx || this.isMuted) return
    frequencies.forEach((frequency, i) => {
      const startAt = ctx.currentTime + i * 0.09
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      // Square waves for the old arcade sound
      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.08, startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.16)
      oscillator.connect(gain).connect(ctx.destination)
      oscillator.start(startAt)
      oscillator.stop(startAt + 0.18)
    })
  }

  // Burst of decaying noise
  private playGunshot(): void {
    const ctx = this.audioContext
    if (!ctx || this.isMuted) return
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate)
    const samples = buffer.getChannelData(0)
    for (let i = 0; i < samples.length; i++) {
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / samples.length, 4)
    }
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    gain.gain.value = 0.35
    source.buffer = buffer
    source.connect(gain).connect(ctx.destination)
    source.start()
  }

  cleanup(): void {
    this.audioContext?.close().catch(() => {})
    this.audioContext = null
    this.clearZombies()
    this.scene.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose()
        const materials = Array.isArray(object.material) ? object.material : [object.material]
        materials.forEach((material) => material.dispose())
      }
    })
    this.renderer.dispose()
  }
}
