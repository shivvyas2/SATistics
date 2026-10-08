import * as THREE from 'three'
import { BaseGame } from '../BaseGame'
import { SATQuestion, WhackAMoleGameState, QuestionAttempt, GameAnalytics } from './types'
import { satQuestions } from './questions'
import { QUICK_SECONDS_PER_QUESTION } from '@/lib/exam'

interface Mole {
  mesh: THREE.Group
  answerIndex: number
  isUp: boolean
  targetY: number
  label: string
  holeY: number
}

export class WhackAMoleGame extends BaseGame {
  // Three.js core
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  
  // Game objects
  private moles: Mole[] = []
  private hammer: THREE.Group | null = null
  private raycaster: THREE.Raycaster = new THREE.Raycaster()
  private mouse: THREE.Vector2 = new THREE.Vector2()
  
  // Game state
  private gameState: WhackAMoleGameState
  private questions: SATQuestion[]
  private currentQuestion: SATQuestion | null = null
  private questionStartTime: number = 0
  private attempts: QuestionAttempt[] = []
  private selectedAnswer: number | null = null
  private popTimer: number = 0
  // Moles stay up long enough to read and answer a quick question
  private popDuration: number = QUICK_SECONDS_PER_QUESTION * 1000
  
  // Callbacks
  public onQuestionChange?: (question: SATQuestion) => void
  public onGameStateChange?: (state: WhackAMoleGameState) => void
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
      timeRemaining: 60,
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
    this.renderer.setClearColor(0x87CEEB) // Sky blue
    
    this.camera.position.set(0, 5, 8)
    this.camera.lookAt(0, 0, 0)
    
    // Bright lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
    this.scene.add(ambientLight)
    
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 1.0)
    directionalLight1.position.set(5, 10, 5)
    this.scene.add(directionalLight1)
    
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.6)
    directionalLight2.position.set(-5, 5, 5)
    this.scene.add(directionalLight2)
    
    // Create game board
    this.createBoard()
    this.createMoles()
    this.createHammer()
    
    // Add mouse click listener
    this.canvas.addEventListener('click', this.handleClick.bind(this))
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this))
    
    // Show first question
    this.showNextQuestion()
  }

  private createBoard(): void {
    // Green grass platform
    const grassGeometry = new THREE.BoxGeometry(10, 0.5, 6)
    const grassMaterial = new THREE.MeshPhongMaterial({ color: 0x2ECC71 })
    const grass = new THREE.Mesh(grassGeometry, grassMaterial)
    grass.position.y = -0.25
    this.scene.add(grass)
    
    // Dirt platform (below grass)
    const dirtGeometry = new THREE.BoxGeometry(10, 1, 6)
    const dirtMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    const dirt = new THREE.Mesh(dirtGeometry, dirtMaterial)
    dirt.position.y = -0.75
    this.scene.add(dirt)
  }

  private createMole(x: number, z: number, answerIndex: number, label: string): Mole {
    const moleGroup = new THREE.Group()
    
    // Mole body (brown cylinder)
    const bodyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 0.8, 16)
    const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x654321 })
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial)
    body.position.y = 0.4
    moleGroup.add(body)
    
    // Mole head
    const headGeometry = new THREE.SphereGeometry(0.45, 16, 16)
    const headMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 })
    const head = new THREE.Mesh(headGeometry, headMaterial)
    head.position.y = 0.9
    head.scale.y = 0.8
    moleGroup.add(head)
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.08, 8, 8)
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    leftEye.position.set(-0.15, 1, 0.35)
    moleGroup.add(leftEye)
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial)
    rightEye.position.set(0.15, 1, 0.35)
    moleGroup.add(rightEye)
    
    // Nose (pink)
    const noseGeometry = new THREE.SphereGeometry(0.1, 8, 8)
    const noseMaterial = new THREE.MeshPhongMaterial({ color: 0xFFB6C1 })
    const nose = new THREE.Mesh(noseGeometry, noseMaterial)
    nose.position.set(0, 0.85, 0.42)
    moleGroup.add(nose)
    
    // Label background (colored circle)
    const colors = [0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0x95E1D3]
    const labelBgGeometry = new THREE.CircleGeometry(0.35, 16)
    const labelBgMaterial = new THREE.MeshBasicMaterial({ color: colors[answerIndex] })
    const labelBg = new THREE.Mesh(labelBgGeometry, labelBgMaterial)
    labelBg.position.set(0, 1.4, 0)
    moleGroup.add(labelBg)
    
    // Label text circle
    const labelGeometry = new THREE.CircleGeometry(0.25, 16)
    const labelMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 })
    const labelCircle = new THREE.Mesh(labelGeometry, labelMaterial)
    labelCircle.position.set(0, 1.4, 0.01)
    moleGroup.add(labelCircle)
    
    // Hole (dark circle on ground)
    const holeGeometry = new THREE.CircleGeometry(0.6, 16)
    const holeMaterial = new THREE.MeshBasicMaterial({ color: 0x2C1810 })
    const hole = new THREE.Mesh(holeGeometry, holeMaterial)
    hole.rotation.x = -Math.PI / 2
    hole.position.set(x, 0.01, z)
    this.scene.add(hole)
    
    moleGroup.position.set(x, -1.5, z) // Start hidden underground
    this.scene.add(moleGroup)
    
    return {
      mesh: moleGroup,
      answerIndex,
      isUp: false,
      targetY: 0,
      label,
      holeY: -1.5
    }
  }

  private createMoles(): void {
    const positions = [
      { x: -3, z: 1 },
      { x: -1, z: 1 },
      { x: 1, z: 1 },
      { x: 3, z: 1 }
    ]
    const labels = ['A', 'B', 'C', 'D']
    
    for (let i = 0; i < 4; i++) {
      const mole = this.createMole(positions[i].x, positions[i].z, i, labels[i])
      this.moles.push(mole)
    }
  }

  private createHammer(): void {
    // Don't create a visible hammer - we'll use cursor styling instead
    // Just keep the reference null for now
    this.hammer = null
  }

  private handleMouseMove(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }

  handleInput(key: string): void {
    // WhackAMoleGame uses mouse input, not keyboard
    // This method is required by BaseGame but not used
  }

  private handleClick(event: MouseEvent): void {
    if (this.selectedAnswer !== null || !this.currentQuestion) return
    
    const rect = this.canvas.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    
    this.raycaster.setFromCamera(this.mouse, this.camera)
    
    // Check if we clicked on a mole
    for (const mole of this.moles) {
      if (!mole.isUp) continue
      
      const intersects = this.raycaster.intersectObject(mole.mesh, true)
      if (intersects.length > 0) {
        console.log(`💥 Whacked mole ${mole.label}!`)
        
        // Squish mole!
        mole.mesh.scale.y = 0.3
        mole.mesh.position.y -= 0.3
        
        this.submitAnswer(mole.answerIndex)
        
        // Animate mole going down
        mole.targetY = mole.holeY
        mole.isUp = false
        break
      }
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
    this.popTimer = 0
    
    // Notify UI
    if (this.onQuestionChange) {
      this.onQuestionChange(this.currentQuestion)
    }
    
    // Pop up all moles
    this.popUpMoles()
    
    console.log('Question:', this.currentQuestion.question)
  }

  private popUpMoles(): void {
    for (const mole of this.moles) {
      mole.isUp = true
      mole.targetY = 0
      // Reset mole appearance
      mole.mesh.scale.set(1, 1, 1)
      mole.mesh.position.y = mole.holeY
    }
  }

  private popDownMoles(): void {
    for (const mole of this.moles) {
      mole.isUp = false
      mole.targetY = mole.holeY
    }
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
    
    // Pop down moles
    this.popDownMoles()
    
    // Next question after delay
    setTimeout(() => {
      if (!this.gameState.isGameOver) {
        this.showNextQuestion()
      }
    }, 2000)
  }

  update(deltaTime: number): void {
    if (this.gameState.isGameOver) return
    
    // Update mole positions (smooth animation)
    for (const mole of this.moles) {
      const currentY = mole.mesh.position.y
      const diff = mole.targetY - currentY
      if (Math.abs(diff) > 0.01) {
        mole.mesh.position.y += diff * 0.1
      }
    }
    
    // Timer logic - moles stay up for limited time
    if (this.selectedAnswer === null && this.currentQuestion) {
      this.popTimer += deltaTime
      if (this.popTimer > this.popDuration) {
        // Time's up! Treat as wrong answer
        console.log("⏰ Time's up!")
        this.submitAnswer(-1) // -1 means no answer
      }
    }
    
    // Wobble moles when they're up
    for (const mole of this.moles) {
      if (mole.isUp && mole.mesh.position.y > -0.5) {
        mole.mesh.rotation.z = Math.sin(Date.now() * 0.005 + mole.answerIndex) * 0.1
      }
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
      gameId: 'whackamole',
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

