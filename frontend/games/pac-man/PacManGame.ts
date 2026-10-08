import { BaseGame } from '../BaseGame';
import * as THREE from 'three';
import type { SATQuestion } from '@/lib/api/questions'
import type { GameAnalytics, QuestionAttempt } from '@/games/whackamole/types'
import { LANE_COLORS, LANE_LETTERS } from '@/games/subway-surfers/types/game'

export interface PacManHudState {
  score: number
  lives: number
  level: number
  isPowerMode: boolean
  isGameOver: boolean
  // Time left to answer the question on screen
  questionSecondsLeft: number
  questionSecondsTotal: number
}

export interface PacManReviewItem {
  question: SATQuestion
  selected: number | null
  isCorrect: boolean
  timeSpent: number
}

// A lettered pellet in the maze; eating it gives that answer
interface AnswerPellet {
  option: number
  mesh: THREE.Mesh
  label: THREE.Sprite
}

// Answer pellets are placed at least this far from Pac-Man so they can't be eaten by accident
const MIN_ANSWER_DISTANCE = 6

// A question appears each time this many dots are eaten
const DOTS_PER_QUESTION = 10

interface Ghost {
  mesh: THREE.Mesh
  position: { x: number; z: number }
  direction: { x: number; z: number }
  color: number
  speed: number
}

interface PowerPellet {
  mesh: THREE.Mesh
  position: { x: number; z: number }
  active: boolean
}

/**
 * Pac-Man SAT Study Game
 * Navigate the maze, collect dots, avoid ghosts, and answer SAT questions!
 */
export class PacManGame extends BaseGame {
  private scene!: THREE.Scene
  private camera!: THREE.PerspectiveCamera
  private renderer!: THREE.WebGLRenderer
  private pacman!: THREE.Mesh
  private ghosts: Ghost[] = []
  private dots: THREE.Mesh[] = []
  private powerPellets: PowerPellet[] = []
  private walls: THREE.Mesh[] = []
  
  private pacmanPos = { x: 0, z: 0 }
  private pacmanDir = { x: 0, z: 0 }
  private nextDir = { x: 0, z: 0 }
  private moveSpeed = 0.1
  private powerMode = false
  private powerModeTimer = 0
  
  private maze: number[][] = []
  private cellSize = 2
  private dotsCollected = 0
  private totalDots = 0
  
  private currentQuestion: SATQuestion | null = null
  private questionTimer = 0
  private showQuestion = false
  private questionCooldown = 0
  
  private questions: SATQuestion[] = []
  private questionIndex = 0
  private questionSeconds = 35
  private attempts: QuestionAttempt[] = []
  private review: PacManReviewItem[] = []
  private hasEnded = false
  private answerPellets: AnswerPellet[] = []
  private viewShift = { x: 0, y: 0 }

  // Callbacks
  public onHudChange?: (state: PacManHudState) => void
  public onQuestionChange?: (question: SATQuestion | null) => void
  public onGameOver?: (analytics: GameAnalytics, review: PacManReviewItem[]) => void

  // Questions to ask, and how long the player gets for each
  setQuestions(questions: SATQuestion[], secondsPerQuestion: number): void {
    this.questions = questions
    this.questionSeconds = secondsPerQuestion
  }

  init(): void {
    
    if (!this.canvas) {
      console.error('Canvas not found!');
      return;
    }

    // Create WebGL renderer using the canvas from constructor
    try {
      this.renderer = new THREE.WebGLRenderer({ 
        canvas: this.canvas, 
        antialias: true,
        alpha: false
      });
      this.renderer.setSize(this.width, this.height);
      this.renderer.setPixelRatio(window.devicePixelRatio);
    } catch (error) {
      console.error('Error creating renderer:', error);
      console.error('THREE.WebGLRenderer type:', typeof THREE.WebGLRenderer);
      return;
    }

    // Create scene and camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    
    // Position camera to look down at the maze from above
    this.camera = new THREE.PerspectiveCamera(60, this.width / this.height, 0.1, 1000);
    this.camera.lookAt(0, 0, 0);
    this.resize(this.width, this.height);
    
    // Lighting - make it brighter
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(0, 20, 0);
    this.scene.add(directionalLight);
    
    // Add a helper light
    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(hemisphereLight);
    
    // Add ground plane to make sure something is visible
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x0a0a0a,
      side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.1;
    this.scene.add(ground);
    
    // Create maze
    this.generateMaze();
    this.createMazeWalls();
    
    // Create Pac-Man
    const pacmanGeometry = new THREE.SphereGeometry(0.6, 32, 32, 0, Math.PI * 1.5);
    const pacmanMaterial = new THREE.MeshPhongMaterial({ 
      color: 0xffff00,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3
    });
    this.pacman = new THREE.Mesh(pacmanGeometry, pacmanMaterial);
    this.pacman.position.set(this.pacmanPos.x, 0.6, this.pacmanPos.z);
    this.scene.add(this.pacman);
    
    // Create ghosts
    this.createGhosts();
    
    // Create dots and power pellets
    this.createDots();
    
    this.setState({ 
      score: 0, 
      level: 1, 
      lives: 3, 
      isPaused: false, 
      isGameOver: false 
    });
  }

  private generateMaze(): void {
    // Classic Pac-Man style maze (simplified)
    this.maze = [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,1,1,1,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
      [1,1,1,1,0,1,0,0,0,1,0,1,1,1,1],
      [1,0,0,0,0,1,0,1,0,1,0,0,0,0,1],
      [1,0,1,1,0,0,0,1,0,0,0,1,1,0,1],
      [1,0,0,0,0,1,0,0,0,1,0,0,0,0,1],
      [1,0,1,1,0,1,1,1,1,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1],
      [1,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ]
    
    // Set initial Pac-Man position
    this.pacmanPos = { 
      x: (-this.maze[0].length / 2 + 1) * this.cellSize, 
      z: (-this.maze.length / 2 + 1) * this.cellSize 
    }
  }

  private createMazeWalls(): void {
    const wallGeometry = new THREE.BoxGeometry(this.cellSize, 2, this.cellSize)
    const wallMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x2196f3,
      emissive: 0x1565c0,
      emissiveIntensity: 0.2
    })
    
    const startX = -this.maze[0].length / 2 * this.cellSize
    const startZ = -this.maze.length / 2 * this.cellSize
    
    for (let row = 0; row < this.maze.length; row++) {
      for (let col = 0; col < this.maze[row].length; col++) {
        if (this.maze[row][col] === 1) {
          const wall = new THREE.Mesh(wallGeometry, wallMaterial)
          wall.position.set(
            startX + col * this.cellSize,
            1,
            startZ + row * this.cellSize
          )
          this.walls.push(wall)
          this.scene.add(wall)
        }
      }
    }
  }

  private createGhosts(): void {
    const ghostColors = [0xff0000, 0xffb8ff, 0x00ffff, 0xffb851]
    
    ghostColors.forEach((color, i) => {
      const ghostGeometry = new THREE.SphereGeometry(0.6, 16, 16)
      const ghostMaterial = new THREE.MeshPhongMaterial({ color })
      const ghostMesh = new THREE.Mesh(ghostGeometry, ghostMaterial)
      
      const pos = this.getRandomEmptyPosition()
      ghostMesh.position.set(pos.x, 0.6, pos.z)
      
      const ghost: Ghost = {
        mesh: ghostMesh,
        position: pos,
        direction: { x: 1, z: 0 },
        color,
        speed: 0.05 + i * 0.01
      }
      
      this.ghosts.push(ghost)
      this.scene.add(ghostMesh)
    })
  }

  private createDots(): void {
    const dotGeometry = new THREE.SphereGeometry(0.15, 8, 8)
    const dotMaterial = new THREE.MeshPhongMaterial({ color: 0xffff88 })
    const powerPelletGeometry = new THREE.SphereGeometry(0.35, 8, 8)
    const powerPelletMaterial = new THREE.MeshPhongMaterial({ color: 0xff88ff })
    
    const startX = -this.maze[0].length / 2 * this.cellSize
    const startZ = -this.maze.length / 2 * this.cellSize
    
    for (let row = 0; row < this.maze.length; row++) {
      for (let col = 0; col < this.maze[row].length; col++) {
        if (this.maze[row][col] === 0) {
          const x = startX + col * this.cellSize
          const z = startZ + row * this.cellSize
          
          // Power pellets in corners
          if ((row === 1 && col === 1) || (row === 1 && col === this.maze[0].length - 2) ||
              (row === this.maze.length - 2 && col === 1) || 
              (row === this.maze.length - 2 && col === this.maze[0].length - 2)) {
            const pellet = new THREE.Mesh(powerPelletGeometry, powerPelletMaterial)
            pellet.position.set(x, 0.35, z)
            this.powerPellets.push({ mesh: pellet, position: { x, z }, active: true })
            this.scene.add(pellet)
          } else {
            const dot = new THREE.Mesh(dotGeometry, dotMaterial)
            dot.position.set(x, 0.15, z)
            this.dots.push(dot)
            this.scene.add(dot)
            this.totalDots++
          }
        }
      }
    }
  }

  private getRandomEmptyPosition(): { x: number; z: number } {
    const startX = -this.maze[0].length / 2 * this.cellSize
    const startZ = -this.maze.length / 2 * this.cellSize
    
    while (true) {
      const row = Math.floor(Math.random() * this.maze.length)
      const col = Math.floor(Math.random() * this.maze[0].length)
      
      if (this.maze[row][col] === 0) {
        return {
          x: startX + col * this.cellSize,
          z: startZ + row * this.cellSize
        }
      }
    }
  }

  update(deltaTime: number): void {
    this.emitHud()
    if (this.state.isGameOver) {
      this.endGame()
      return
    }
    if (this.state.isPaused) return
    if (!this.pacman || !this.scene) return // Safety check
    
    // While a question is up the ghosts hold still and Pac-Man goes for an answer pellet
    if (this.showQuestion) {
      this.questionTimer += deltaTime
      if (this.questionTimer > this.questionSeconds * 1000) {
        this.answer(null)
        return
      }
      this.movePacman()
      this.checkDotCollection()
      this.checkAnswerPellets()
      this.pacman.rotation.y += deltaTime * 0.005
      return
    }
    
    if (this.questionCooldown > 0) {
      this.questionCooldown -= deltaTime
    }
    
    // Update power mode
    if (this.powerMode) {
      this.powerModeTimer -= deltaTime
      if (this.powerModeTimer <= 0) {
        this.powerMode = false
        this.ghosts.forEach(ghost => {
          (ghost.mesh.material as THREE.MeshPhongMaterial).color.setHex(ghost.color)
        })
      }
    }
    
    // Move Pac-Man
    this.movePacman()
    
    // Check dot collection
    this.checkDotCollection()
    
    // Move ghosts
    this.moveGhosts()
    
    // Check collisions
    this.checkGhostCollision()
    
    // Animate Pac-Man mouth
    this.pacman.rotation.y += deltaTime * 0.005
  }

  private movePacman(): void {
    if (!this.pacman) return // Safety check
    
    // Try to change direction
    if (this.nextDir.x !== 0 || this.nextDir.z !== 0) {
      const newX = this.pacmanPos.x + this.nextDir.x * this.moveSpeed
      const newZ = this.pacmanPos.z + this.nextDir.z * this.moveSpeed
      
      if (!this.isWall(newX, newZ)) {
        this.pacmanDir = { ...this.nextDir }
      }
    }
    
    // Move in current direction
    if (this.pacmanDir.x !== 0 || this.pacmanDir.z !== 0) {
      const newX = this.pacmanPos.x + this.pacmanDir.x * this.moveSpeed
      const newZ = this.pacmanPos.z + this.pacmanDir.z * this.moveSpeed
      
      if (!this.isWall(newX, newZ)) {
        this.pacmanPos.x = newX
        this.pacmanPos.z = newZ
        this.pacman.position.set(this.pacmanPos.x, 0.6, this.pacmanPos.z)
        
        // Update rotation
        if (this.pacmanDir.x > 0) this.pacman.rotation.z = Math.PI
        else if (this.pacmanDir.x < 0) this.pacman.rotation.z = 0
        else if (this.pacmanDir.z > 0) this.pacman.rotation.z = Math.PI / 2
        else if (this.pacmanDir.z < 0) this.pacman.rotation.z = -Math.PI / 2
      }
    }
  }

  private isWall(x: number, z: number): boolean {
    const startX = -this.maze[0].length / 2 * this.cellSize
    const startZ = -this.maze.length / 2 * this.cellSize
    
    const col = Math.round((x - startX) / this.cellSize)
    const row = Math.round((z - startZ) / this.cellSize)
    
    if (row < 0 || row >= this.maze.length || col < 0 || col >= this.maze[0].length) {
      return true
    }
    
    return this.maze[row][col] === 1
  }

  private checkDotCollection(): void {
    // Check dots
    for (let i = this.dots.length - 1; i >= 0; i--) {
      const dot = this.dots[i]
      const dx = dot.position.x - this.pacmanPos.x
      const dz = dot.position.z - this.pacmanPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      
      if (dist < 0.8) {
        this.scene.remove(dot)
        this.dots.splice(i, 1)
        this.dotsCollected++
        this.setState({ score: this.state.score + 10 })
        
        // Trigger question every 10 dots
        if (this.dotsCollected % DOTS_PER_QUESTION === 0 && this.questionCooldown <= 0 && !this.showQuestion) {
          this.triggerQuestion()
        }
        
        // Check win condition
        if (this.dotsCollected === this.totalDots) {
          this.nextLevel()
        }
      }
    }
    
    // Check power pellets
    for (const pellet of this.powerPellets) {
      if (!pellet.active) continue
      
      const dx = pellet.position.x - this.pacmanPos.x
      const dz = pellet.position.z - this.pacmanPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      
      if (dist < 0.8) {
        this.scene.remove(pellet.mesh)
        pellet.active = false
        this.powerMode = true
        this.powerModeTimer = 8000
        this.setState({ score: this.state.score + 50 })
        
        // Change ghost colors
        this.ghosts.forEach(ghost => {
          (ghost.mesh.material as THREE.MeshPhongMaterial).color.setHex(0x0000ff)
        })
      }
    }
  }

  private moveGhosts(): void {
    this.ghosts.forEach(ghost => {
      // Simple AI: occasionally change direction
      if (Math.random() < 0.02) {
        const dirs = [
          { x: 1, z: 0 }, { x: -1, z: 0 },
          { x: 0, z: 1 }, { x: 0, z: -1 }
        ]
        ghost.direction = dirs[Math.floor(Math.random() * dirs.length)]
      }
      
      const newX = ghost.position.x + ghost.direction.x * ghost.speed
      const newZ = ghost.position.z + ghost.direction.z * ghost.speed
      
      if (!this.isWall(newX, newZ)) {
        ghost.position.x = newX
        ghost.position.z = newZ
        ghost.mesh.position.set(ghost.position.x, 0.6, ghost.position.z)
      } else {
        // Hit wall, change direction
        const dirs = [
          { x: 1, z: 0 }, { x: -1, z: 0 },
          { x: 0, z: 1 }, { x: 0, z: -1 }
        ]
        ghost.direction = dirs[Math.floor(Math.random() * dirs.length)]
      }
    })
  }

  private checkGhostCollision(): void {
    this.ghosts.forEach(ghost => {
      const dx = ghost.position.x - this.pacmanPos.x
      const dz = ghost.position.z - this.pacmanPos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      
      if (dist < 1.2) {
        if (this.powerMode) {
          // Eat ghost
          ghost.position = this.getRandomEmptyPosition()
          ghost.mesh.position.set(ghost.position.x, 0.6, ghost.position.z)
          this.setState({ score: this.state.score + 200 })
        } else {
          // Lose life
          this.setState({ lives: this.state.lives - 1 })
          this.resetPositions()
          if (this.state.lives <= 0) {
            this.setState({ isGameOver: true })
          }
        }
      }
    })
  }

  private triggerQuestion(): void {
    if (this.questions.length === 0) return
    this.currentQuestion = this.questions[this.questionIndex++ % this.questions.length]
    this.showQuestion = true
    this.questionTimer = 0
    this.questionCooldown = 5000
    this.spawnAnswerPellets(this.currentQuestion.options.length)
    this.onQuestionChange?.(this.currentQuestion)
  }

  // Drops one lettered pellet per answer into open spots around the maze
  private spawnAnswerPellets(count: number): void {
    const taken: { x: number; z: number }[] = []
    const isFarEnough = (p: { x: number; z: number }) =>
      Math.hypot(p.x - this.pacmanPos.x, p.z - this.pacmanPos.z) >= MIN_ANSWER_DISTANCE &&
      taken.every((t) => Math.hypot(p.x - t.x, p.z - t.z) >= this.cellSize * 2)

    for (let option = 0; option < count; option++) {
      let position = this.getRandomEmptyPosition()
      for (let tries = 0; tries < 40 && !isFarEnough(position); tries++) position = this.getRandomEmptyPosition()
      taken.push(position)

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.75, 20, 20),
        new THREE.MeshBasicMaterial({ color: LANE_COLORS[option] })
      )
      mesh.position.set(position.x, 0.75, position.z)
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.createLetterTexture(option), depthTest: false }))
      label.position.set(position.x, 2.5, position.z)
      label.scale.set(1.7, 1.7, 1)
      label.renderOrder = 10
      this.scene.add(mesh, label)
      this.answerPellets.push({ option, mesh, label })
    }
  }

  private createLetterTexture(option: number): THREE.CanvasTexture {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.fillStyle = '#000000'
      ctx.beginPath()
      ctx.arc(64, 64, 60, 0, Math.PI * 2)
      ctx.fill()
      ctx.lineWidth = 10
      ctx.strokeStyle = LANE_COLORS[option]
      ctx.stroke()
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 80px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(LANE_LETTERS[option], 64, 70)
    }
    return new THREE.CanvasTexture(canvas)
  }

  private clearAnswerPellets(): void {
    for (const { mesh, label } of this.answerPellets) {
      this.scene.remove(mesh, label)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.Material).dispose()
      label.material.map?.dispose()
      label.material.dispose()
    }
    this.answerPellets = []
  }

  private checkAnswerPellets(): void {
    const eaten = this.answerPellets.find(
      (pellet) =>
        pellet.mesh.visible &&
        Math.hypot(pellet.mesh.position.x - this.pacmanPos.x, pellet.mesh.position.z - this.pacmanPos.z) < 1
    )
    if (eaten) this.answer(eaten.option)
  }

  // A hint ruled this answer out: its pellet disappears
  eliminateAnswer(option: number): void {
    const pellet = this.answerPellets.find((p) => p.option === option)
    if (!pellet) return
    pellet.mesh.visible = false
    pellet.label.visible = false
  }

  // Answers the question on screen; null means time ran out
  answer(selected: number | null): void {
    const question = this.currentQuestion
    if (!question) return

    const isCorrect = selected === question.correctAnswer
    const timeSpent = Math.round(this.questionTimer)
    this.attempts.push({ questionId: question.id, topic: question.topic, difficulty: question.difficulty, isCorrect, timeSpent, question, selected })
    this.review.push({ question, selected, isCorrect, timeSpent })

    if (isCorrect) {
      // A right answer turns the ghosts blue, like a power pellet
      this.setState({ score: this.state.score + 100 })
      this.powerMode = true
      this.powerModeTimer = 5000
      this.ghosts.forEach(ghost => {
        (ghost.mesh.material as THREE.MeshPhongMaterial).color.setHex(0x0000ff)
      })
    } else {
      this.setState({ lives: this.state.lives - 1 })
      if (this.state.lives <= 0) {
        this.setState({ isGameOver: true })
      }
    }
    
    this.showQuestion = false
    this.currentQuestion = null
    this.clearAnswerPellets()
    this.onQuestionChange?.(null)
  }

  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    if (!this.renderer || !this.camera) return
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / height
    // Pull the camera back on tall screens so the whole maze stays in view
    this.camera.position.set(0, 35 * Math.max(1, 1.15 / this.camera.aspect), 0)
    this.camera.lookAt(0, 0, 0)
    this.applyViewShift()
  }

  // Shifts the maze so it stays clear of the question panel
  setViewShift(x: number, y = 0): void {
    this.viewShift = { x, y }
    this.applyViewShift()
  }

  private applyViewShift(): void {
    if (!this.camera) return
    if (this.viewShift.x || this.viewShift.y) {
      this.camera.setViewOffset(this.width, this.height, -this.viewShift.x, -this.viewShift.y, this.width, this.height)
    } else {
      this.camera.clearViewOffset()
    }
    this.camera.updateProjectionMatrix()
  }

  // Steers Pac-Man; the turn happens at the next opening
  setDirection(x: number, z: number): void {
    this.nextDir = { x, z }
  }

  setPaused(paused: boolean): void {
    this.setState({ isPaused: paused })
  }

  private emitHud(): void {
    this.onHudChange?.({
      score: this.state.score,
      lives: Math.max(0, this.state.lives),
      level: this.state.level,
      isPowerMode: this.powerMode,
      isGameOver: this.state.isGameOver,
      questionSecondsLeft: Math.max(0, this.questionSeconds - this.questionTimer / 1000),
      questionSecondsTotal: this.questionSeconds,
    })
  }

  private endGame(): void {
    if (this.hasEnded) return
    this.hasEnded = true

    const topicPerformance: GameAnalytics['topicPerformance'] = {}
    this.attempts.forEach((attempt) => {
      const perf = (topicPerformance[attempt.topic] ||= { correct: 0, total: 0, accuracy: 0 })
      perf.total++
      if (attempt.isCorrect) perf.correct++
      perf.accuracy = (perf.correct / perf.total) * 100
    })
    const correct = this.attempts.filter((attempt) => attempt.isCorrect).length
    const totalTime = this.attempts.reduce((sum, attempt) => sum + attempt.timeSpent, 0)
    let streak = 0
    let maxStreak = 0
    for (const attempt of this.attempts) {
      streak = attempt.isCorrect ? streak + 1 : 0
      maxStreak = Math.max(maxStreak, streak)
    }

    this.onGameOver?.(
      {
        gameId: 'pac-man',
        score: this.state.score,
        accuracy: this.attempts.length > 0 ? (correct / this.attempts.length) * 100 : 0,
        correctAnswers: correct,
        wrongAnswers: this.attempts.length - correct,
        questionAttempts: this.attempts,
        topicPerformance,
        streakInfo: { maxStreak },
        averageResponseTime: this.attempts.length > 0 ? Math.round(totalTime / this.attempts.length) : 0,
      },
      this.review
    )
  }

  private resetPositions(): void {
    if (!this.pacman) return // Safety check
    
    this.pacmanPos = { 
      x: (-this.maze[0].length / 2 + 1) * this.cellSize, 
      z: (-this.maze.length / 2 + 1) * this.cellSize 
    }
    this.pacman.position.set(this.pacmanPos.x, 0.6, this.pacmanPos.z)
    this.pacmanDir = { x: 0, z: 0 }
    this.nextDir = { x: 0, z: 0 }
    
    this.ghosts.forEach(ghost => {
      const pos = this.getRandomEmptyPosition()
      ghost.position = pos
      ghost.mesh.position.set(pos.x, 0.6, pos.z)
    })
  }

  private nextLevel(): void {
    this.setState({ level: this.state.level + 1 })
    this.dotsCollected = 0
    
    // Recreate dots
    this.dots.forEach(dot => this.scene.remove(dot))
    this.dots = []
    this.totalDots = 0
    this.createDots()
    
    // Reset power pellets
    this.powerPellets.forEach(pellet => {
      if (!pellet.active) {
        pellet.active = true
        this.scene.add(pellet.mesh)
      }
    })
    
    // Reset positions
    this.resetPositions()
    
    // Increase ghost speed
    this.ghosts.forEach(ghost => {
      ghost.speed += 0.01
    })
  }

  // The score, question and game-over screens are drawn by the page, not on the canvas
  render(): void {
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera)
    }
  }

  handleInput(key: string): void {
    
    // Movement
    switch (key.toLowerCase()) {
      case 'arrowup':
      case 'w':
        this.nextDir = { x: 0, z: -1 }
        break
      case 'arrowdown':
      case 's':
        this.nextDir = { x: 0, z: 1 }
        break
      case 'arrowleft':
      case 'a':
        this.nextDir = { x: -1, z: 0 }
        break
      case 'arrowright':
      case 'd':
        this.nextDir = { x: 1, z: 0 }
        break
    }
  }

  cleanup(): void {
    // Clean up Three.js resources
    if (this.scene) {
      this.scene.traverse((object: THREE.Object3D): void => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose()
          }
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose())
            } else {
              object.material.dispose()
            }
          }
        }
      })
    }
    
    if (this.renderer) {
      this.renderer.dispose()
    }
    
    // Clear arrays
    this.ghosts = []
    this.dots = []
    this.powerPellets = []
    this.walls = []
  }
}