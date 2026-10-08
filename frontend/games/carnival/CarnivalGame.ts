import * as THREE from 'three'
import { BaseGame } from '../BaseGame'
import { SATQuestion, CarnivalGameState, QuestionAttempt, GameAnalytics } from './types'
import { satQuestions } from './questions'

interface Target {
  mesh: THREE.Group
  answerIndex: number
  label: string
  velocityY: number
  hit: boolean
}

interface Bullet {
  mesh: THREE.Mesh
  velocity: THREE.Vector3
  active: boolean
}

export class CarnivalGame extends BaseGame {
  // Three.js core
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  
  // Game objects
  private targets: Target[] = []
  private bullets: Bullet[] = []
  private crosshair: THREE.Mesh | null = null
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private mouse: THREE.Vector2 = new THREE.Vector2()
  
  // Game state
  private gameState: CarnivalGameState
  private questions: SATQuestion[]
  private currentQuestion: SATQuestion | null = null
  private questionStartTime: number = 0
  private attempts: QuestionAttempt[] = []
  private selectedAnswer: number | null = null
  
  // Callbacks
  public onQuestionChange?: (question: SATQuestion) => void
  public onGameStateChange?: (state: CarnivalGameState) => void
  public onGameOver?: (analytics: GameAnalytics) => void

  constructor(width: number, height: number, canvas: HTMLCanvasElement, questions?: SATQuestion[]) {
    super(width, height, canvas)
    this.questions = questions && questions.length > 0 ? [...questions] : [...satQuestions]
    
    this.gameState = {
      score: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      currentQuestionIndex: 0,
      totalQuestions: this.questions.length,
      streak: 0,
      maxStreak: 0,
      bulletsRemaining: 3,
      isGameOver: false
    }
  }

  init(): void {
    // Setup Three.js
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(75, this.width / this.height, 0.1, 1000)
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: this.canvas,
      antialias: true 
    })
    
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0x87CEEB) // Bright sky blue
    
    this.camera.position.set(0, 1.5, 5)
    this.camera.lookAt(0, 2, 0)
    
    // Bright lights for vibrant colors
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    this.scene.add(ambientLight)
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.2)
    directionalLight1.position.set(5, 10, 5)
    this.scene.add(directionalLight1)
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight2.position.set(-5, 5, 5)
    this.scene.add(directionalLight2)
    
    // Create carnival backdrop
    this.createBackdrop()
    this.createCrosshair()
    
    // Add mouse/click listeners
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    
    // Show first question
    this.showNextQuestion()
  }

  private createBackdrop(): void {
    // Carnival wall (red and white stripes)
    const wallGeometry = new THREE.BoxGeometry(15, 8, 0.5)
    const wallTexture = this.createStripedTexture()
    const wallMaterial = new THREE.MeshPhongMaterial({ map: wallTexture })
    const wall = new THREE.Mesh(wallGeometry, wallMaterial)
    wall.position.z = -5
    wall.position.y = 3
    this.scene.add(wall)
    
    // Add carnival lights (decorative spheres) - bright and glowing!
    for (let i = 0; i < 8; i++) {
      const lightGeometry = new THREE.SphereGeometry(0.2, 16, 16)
      const lightColor = i % 2 === 0 ? 0xFFD700 : 0xFF1493
      const lightMaterial = new THREE.MeshBasicMaterial({
        color: lightColor
      })
      const light = new THREE.Mesh(lightGeometry, lightMaterial)
      light.position.set(-6 + i * 1.7, 6.5, -4.8)
      this.scene.add(light)
    }
    
    // Prize booth frame
    const frameGeometry = new THREE.BoxGeometry(0.3, 8, 0.3)
    const frameMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    
    const leftFrame = new THREE.Mesh(frameGeometry, frameMaterial)
    leftFrame.position.set(-7, 3, -4.9)
    this.scene.add(leftFrame)
    
    const rightFrame = new THREE.Mesh(frameGeometry, frameMaterial)
    rightFrame.position.set(7, 3, -4.9)
    this.scene.add(rightFrame)
    
    // Floor (bright wooden planks look)
    const floorGeometry = new THREE.PlaneGeometry(20, 20)
    const floorMaterial = new THREE.MeshPhongMaterial({ color: 0xD2691E })
    const floor = new THREE.Mesh(floorGeometry, floorMaterial)
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.5
    this.scene.add(floor)
    
    // Add counter (brighter)
    const counterGeometry = new THREE.BoxGeometry(8, 1, 1)
    const counterMaterial = new THREE.MeshPhongMaterial({ color: 0xCD853F })
    const counter = new THREE.Mesh(counterGeometry, counterMaterial)
    counter.position.set(0, 0, 3)
    this.scene.add(counter)
  }

  private createStripedTexture(): THREE.Texture {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')!
    
    const stripeWidth = 32
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#FF0000' : '#FFFFFF'
      ctx.fillRect(i * stripeWidth, 0, stripeWidth, 256)
    }
    
    const texture = new THREE.Texture(canvas)
    texture.needsUpdate = true
    return texture
  }

  private createTarget(x: number, y: number, answerIndex: number, label: string): Target {
    const targetGroup = new THREE.Group()
    
    // Make 3D balloons instead of flat targets!
    // Same color per answer as the answer list on screen
    const colors = [0x3b82f6, 0xf59e0b, 0xec4899, 0x10b981]
    const targetColor = colors[answerIndex]
    
    // Balloon body (sphere)
    const balloonGeometry = new THREE.SphereGeometry(0.5, 32, 32)
    const balloonMaterial = new THREE.MeshPhongMaterial({ 
      color: targetColor,
      shininess: 150,
      specular: 0xffffff,
      // MeshBasicMaterial doesn't support emissive
    })
    const balloon = new THREE.Mesh(balloonGeometry, balloonMaterial)
    balloon.scale.y = 1.2 // Make it more balloon-shaped
    targetGroup.add(balloon)
    
    // Balloon knot (bottom)
    const knotGeometry = new THREE.ConeGeometry(0.1, 0.2, 8)
    const knotMaterial = new THREE.MeshPhongMaterial({ color: targetColor })
    const knot = new THREE.Mesh(knotGeometry, knotMaterial)
    knot.position.y = -0.7
    targetGroup.add(knot)
    
    // String
    const stringGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8)
    const stringMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF })
    const string = new THREE.Mesh(stringGeometry, stringMaterial)
    string.position.y = -1.15
    targetGroup.add(string)
    
    // Shine/highlight on balloon (brighter)
    const shineGeometry = new THREE.SphereGeometry(0.15, 16, 16)
    const shineMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.9
    })
    const shine = new THREE.Mesh(shineGeometry, shineMaterial)
    shine.position.set(-0.2, 0.2, 0.4)
    targetGroup.add(shine)
    
    // Label badge (3D)
    const labelBgGeometry = new THREE.CircleGeometry(0.25, 16)
    const labelBgMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const labelBg = new THREE.Mesh(labelBgGeometry, labelBgMaterial)
    labelBg.position.z = 0.51
    targetGroup.add(labelBg)
    
    const labelTextGeometry = new THREE.CircleGeometry(0.18, 16)
    const labelTextMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF })
    const labelText = new THREE.Mesh(labelTextGeometry, labelTextMaterial)
    labelText.position.z = 0.52
    targetGroup.add(labelText)
    
    targetGroup.position.set(x, y, -4.5)
    this.scene.add(targetGroup)
    
    return {
      mesh: targetGroup,
      answerIndex,
      label,
      velocityY: (Math.random() - 0.5) * 0.015, // Slightly faster float
      hit: false
    }
  }

  private createCrosshair(): void {
    const crosshairGeometry = new THREE.RingGeometry(0.02, 0.03, 16)
    const crosshairMaterial = new THREE.MeshBasicMaterial({ color: 0xFF0000, side: THREE.DoubleSide })
    this.crosshair = new THREE.Mesh(crosshairGeometry, crosshairMaterial)
    this.crosshair.position.z = 4.9
    this.camera.add(this.crosshair)
    this.scene.add(this.camera)
  }

  handleInput(key: string): void {
    // CarnivalGame uses mouse input, not keyboard
    // This method is required by BaseGame but not used
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  private handleClick(event: MouseEvent): void {
    if (this.selectedAnswer !== null || !this.currentQuestion || this.gameState.bulletsRemaining <= 0) return
    
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    this.raycaster.setFromCamera(this.mouse, this.camera)
    
    // Shoot bullet
    this.shootBullet()
    this.gameState.bulletsRemaining--
    
    // Check if we hit a target
    for (const target of this.targets) {
      if (target.hit) continue
      
      const intersects = this.raycaster.intersectObject(target.mesh, true)
      if (intersects.length > 0) {
        console.log(`Hit target ${target.label}!`)
        target.hit = true
        
        // POP! Visual feedback - balloon pops
        this.createPopEffect(target.mesh.position.x, target.mesh.position.y, target.mesh.position.z)
        
        // Make balloon "deflate"
        const deflateAnimation = () => {
          if (target.mesh.scale.x > 0.1) {
            target.mesh.scale.multiplyScalar(0.95)
            target.mesh.rotation.z += 0.1
            requestAnimationFrame(deflateAnimation)
          } else {
            target.mesh.visible = false
          }
        }
        deflateAnimation()
        
        this.submitAnswer(target.answerIndex)
        break
      }
    }
    
    // Update UI
    if (this.onGameStateChange) {
      this.onGameStateChange({ ...this.gameState })
    }
  }

  private shootBullet(): void {
    // Make bullets more visible - bright glowing spheres
    const bulletGeometry = new THREE.SphereGeometry(0.1, 16, 16)
    const bulletMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFF00
    })
    const bulletMesh = new THREE.Mesh(bulletGeometry, bulletMaterial)
    
    // Add glow effect (brighter)
    const glowGeometry = new THREE.SphereGeometry(0.15, 16, 16)
    const glowMaterial = new THREE.MeshBasicMaterial({ 
      color: 0xFFFF00,
      transparent: true,
      opacity: 0.5
    })
    const glow = new THREE.Mesh(glowGeometry, glowMaterial)
    bulletMesh.add(glow)
    
    const direction = new THREE.Vector3()
    this.raycaster.setFromCamera(this.mouse, this.camera)
    this.raycaster.ray.direction.normalize()
    direction.copy(this.raycaster.ray.direction)
    
    bulletMesh.position.copy(this.camera.position)
    this.scene.add(bulletMesh)
    
    this.bullets.push({
      mesh: bulletMesh,
      velocity: direction.multiplyScalar(0.5),
      active: true
    })
  }

  private createPopEffect(x: number, y: number, z: number): void {
    // Create particle explosion effect when balloon pops
    const particleCount = 20
    const particles: THREE.Mesh[] = []
    
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.05, 8, 8)
      const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3, 0xFFFFFF]
      const particleMaterial = new THREE.MeshBasicMaterial({ 
        color: colors[Math.floor(Math.random() * colors.length)]
      })
      const particle = new THREE.Mesh(particleGeometry, particleMaterial)
      
      particle.position.set(x, y, z)
      this.scene.add(particle)
      particles.push(particle)
      
      // Animate particles outward
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2,
        (Math.random() - 0.5) * 0.2
      )
      
      const animateParticle = () => {
        particle.position.add(velocity)
        velocity.multiplyScalar(0.95) // Slow down
        particle.scale.multiplyScalar(0.95) // Shrink
        
        if (particle.scale.x > 0.01) {
          requestAnimationFrame(animateParticle)
        } else {
          this.scene.remove(particle)
        }
      }
      animateParticle()
    }
  }

  private showNextQuestion(): void {
    if (this.gameState.currentQuestionIndex >= this.questions.length) {
      this.endGame()
      return
    }
    
    this.currentQuestion = this.questions[this.gameState.currentQuestionIndex]
    this.questionStartTime = Date.now()
    this.selectedAnswer = null
    this.gameState.bulletsRemaining = 3
    
    // Clear old targets
    this.targets.forEach(t => this.scene.remove(t.mesh))
    this.targets = []
    
    // Create new targets
    const positions = [
      { x: -4, y: 4 },
      { x: -1.5, y: 2.5 },
      { x: 1.5, y: 3.5 },
      { x: 4, y: 2 }
    ]
    const labels = ['A', 'B', 'C', 'D']
    
    for (let i = 0; i < 4; i++) {
      const target = this.createTarget(positions[i].x, positions[i].y, i, labels[i])
      this.targets.push(target)
    }
    
    // Notify UI
    if (this.onQuestionChange) {
      this.onQuestionChange(this.currentQuestion)
    }
    
    if (this.onGameStateChange) {
      this.onGameStateChange({ ...this.gameState })
    }
    
    console.log('Question:', this.currentQuestion.question)
  }

  public submitAnswer(answerIndex: number): void {
    if (!this.currentQuestion || this.selectedAnswer !== null) return
    
    this.selectedAnswer = answerIndex
    const timeSpent = Date.now() - this.questionStartTime
    const isCorrect = answerIndex === this.currentQuestion.correctAnswer
    
    // Record attempt
    this.attempts.push({
      questionId: this.currentQuestion.id,
      topic: this.currentQuestion.topic,
      difficulty: this.currentQuestion.difficulty,
      isCorrect,
      timeSpent,
      question: this.currentQuestion,
      selected: answerIndex,
    })
    
    if (isCorrect) {
      console.log('✅ CORRECT!')
      this.gameState.correctAnswers++
      this.gameState.streak++
      this.gameState.score += 100 + (this.gameState.streak * 10)
      
      if (this.gameState.streak > this.gameState.maxStreak) {
        this.gameState.maxStreak = this.gameState.streak
      }
    } else {
      console.log('❌ WRONG!')
      this.gameState.wrongAnswers++
      this.gameState.streak = 0
    }
    
    this.gameState.currentQuestionIndex++
    
    // Update UI
    if (this.onGameStateChange) {
      this.onGameStateChange({ ...this.gameState })
    }
    
    // Next question after delay
    setTimeout(() => {
      if (!this.gameState.isGameOver) {
        this.showNextQuestion()
      }
    }, 2000)
  }

  update(deltaTime: number): void {
    if (this.gameState.isGameOver) return
    
    // Move targets (bob up and down like balloons)
    for (const target of this.targets) {
      if (!target.hit) {
        target.mesh.position.y += target.velocityY
        if (target.mesh.position.y > 4.5 || target.mesh.position.y < 1.5) {
          target.velocityY *= -1
        }
        
        // Add gentle swaying motion
        target.mesh.rotation.z = Math.sin(Date.now() * 0.001 + target.answerIndex) * 0.1
        target.mesh.position.x += Math.sin(Date.now() * 0.0015 + target.answerIndex) * 0.001
      }
    }
    
    // Update bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const bullet = this.bullets[i]
      if (bullet.active) {
        bullet.mesh.position.add(bullet.velocity)
        
        // Remove if too far
        if (bullet.mesh.position.z < -10 || bullet.mesh.position.z > 10) {
          this.scene.remove(bullet.mesh)
          this.bullets.splice(i, 1)
        }
      }
    }
    
    // Check if ran out of bullets
    if (this.gameState.bulletsRemaining <= 0 && this.selectedAnswer === null) {
      console.log('Out of bullets! Moving to next question...')
      this.submitAnswer(-1) // -1 means no answer
    }
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderer.render(this.scene, this.camera)
  }

  private endGame(): void {
    this.gameState.isGameOver = true
    const analytics = this.generateAnalytics()
    
    if (this.onGameOver) {
      this.onGameOver(analytics)
    }
    
    console.log('🎮 Game Over! Final Score:', this.gameState.score)
  }

  private generateAnalytics(): GameAnalytics {
    const topicPerformance: { [topic: string]: { correct: number; total: number; accuracy: number } } = {}
    
    this.attempts.forEach(attempt => {
      if (!topicPerformance[attempt.topic]) {
        topicPerformance[attempt.topic] = { correct: 0, total: 0, accuracy: 0 }
      }
      topicPerformance[attempt.topic].total++
      if (attempt.isCorrect) {
        topicPerformance[attempt.topic].correct++
      }
    })
    
    Object.keys(topicPerformance).forEach(topic => {
      const perf = topicPerformance[topic]
      perf.accuracy = (perf.correct / perf.total) * 100
    })
    
    const totalTime = this.attempts.reduce((sum, att) => sum + att.timeSpent, 0)
    const avgResponseTime = this.attempts.length > 0 ? totalTime / this.attempts.length : 0
    
    return {
      gameId: 'carnival',
      score: this.gameState.score,
      accuracy: (this.gameState.correctAnswers / (this.gameState.correctAnswers + this.gameState.wrongAnswers)) * 100 || 0,
      correctAnswers: this.gameState.correctAnswers,
      wrongAnswers: this.gameState.wrongAnswers,
      questionAttempts: this.attempts,
      topicPerformance,
      streakInfo: {
        maxStreak: this.gameState.maxStreak
      },
      averageResponseTime: avgResponseTime
    }
  }

  cleanup(): void {
    this.canvas.removeEventListener('click', this.handleClick.bind(this))
    this.canvas.removeEventListener('mousemove', this.handleMouseMove.bind(this))
    this.scene.clear()
    this.renderer.dispose()
  }

  public getCurrentAnalytics(): GameAnalytics {
    return this.generateAnalytics()
  }
}

