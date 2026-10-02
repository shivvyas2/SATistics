'use client'

import { useEffect, useRef, useState } from 'react'
import { SATQuestion, CarnivalGameState, GameAnalytics } from '@/games/carnival/types'
import type { CarnivalGame } from '@/games/carnival/CarnivalGame'
import { GameOverModal } from './GameOverModal'
import { fetchQuestionsWithCache } from '@/lib/api/questions'
import { satQuestions } from '@/games/carnival/questions'
import type { SATQuestion as ExamQuestion } from '@/lib/api/questions'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { strategyHint } from '@/lib/hints'
import { ArcadeFrame, ArcadeStartScreen, ArcadeTopBar } from './arcade/ArcadeFrame'
import { LaneChip } from './exam/LaneChip'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionContent } from './QuestionContent'

const ACCENT = '#f472b6'

interface CarnivalGameContainerProps {
  gameId: string
}

export function CarnivalGameContainer({ gameId }: CarnivalGameContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<CarnivalGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<SATQuestion[]>(satQuestions)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [gameState, setGameState] = useState<CarnivalGameState | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [analytics, setAnalytics] = useState<GameAnalytics | null>(null)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [highScore, setHighScore] = useState(0)
  // The game loop reads this to know whether to advance the game
  const runningRef = useRef(false)
  runningRef.current = started && !paused

  useEffect(() => setHighScore(getHighScore('carnival')), [])

  // Fetch AI questions on mount
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const aiQuestions = await fetchQuestionsWithCache('carnival', 50, satQuestions)
        setQuestions(aiQuestions)
      } catch (error) {
        console.error('Failed to load AI questions:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadQuestions()
  }, [])

  useEffect(() => {
    if (!canvasRef.current || loading) return

    const canvas = canvasRef.current
    let animationFrameId: number
    let game: CarnivalGame | null = null
    let resizeHandler: (() => void) | null = null

    const initGame = async () => {
      const { CarnivalGame: CarnivalGameClass } = await import('@/games/carnival/CarnivalGame')

      resizeHandler = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      resizeHandler()
      window.addEventListener('resize', resizeHandler)

      game = new CarnivalGameClass(canvas.width, canvas.height, canvas, questions)
      gameRef.current = game

      game.onQuestionChange = (question) => {
        setCurrentQuestion(question)
        setSelectedAnswer(null)
        setShowResult(false)
        setShowHint(false)
      }

      game.onGameStateChange = (state) => {
        setGameState(state)
      }

      game.onGameOver = async (analyticsData) => {
        setAnalytics(analyticsData)
        setGameOver(true)
        setHighScore(recordHighScore('carnival', analyticsData.score))
        
        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore('carnival', analyticsData)
        } catch (error) {
          console.error('Error saving score:', error)
        }
      }

      game.init()

      let lastTime = 0
      const gameLoop = (currentTime: number) => {
        if (!game) return
        
        const deltaTime = currentTime - lastTime
        lastTime = currentTime

        // Hold the game still on the start screen and while paused
        if (runningRef.current) game.update(deltaTime)
        game.render(null as any)

        animationFrameId = requestAnimationFrame(gameLoop)
      }

      animationFrameId = requestAnimationFrame(gameLoop)

      return () => {
        // Cleanup
      }
    }

    let cleanupListeners: (() => void) | null = null

    const init = async () => {
      cleanupListeners = await initGame()
    }

    init()

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId)
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
      if (cleanupListeners) {
        cleanupListeners()
      }
      if (game) {
        game.cleanup()
      }
    }
  }, [loading, questions])

  const handleRestart = () => {
    window.location.reload()
  }

  if (loading) {
    return (
      <ArcadeFrame color={ACCENT}>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="arcade-font arcade-glow text-lg text-pink-400">BALLOON POP</p>
            <p className="arcade-font arcade-blink mt-6 text-[10px] text-white">LOADING QUESTIONS...</p>
          </div>
        </div>
      </ArcadeFrame>
    )
  }

  const question = currentQuestion as ExamQuestion | null

  return (
    <ArcadeFrame color={ACCENT}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-manipulation"
        style={{ display: 'block' }}
        tabIndex={-1}
      />

      {!started && (
        <ArcadeStartScreen
          title="BALLOON POP"
          subtitle={`${questions.length} quick-fire questions`}
          instructions={[
            'Each balloon carries one answer. Tap or click the balloon with the right one.',
            'You get three shots per question.',
            'Stuck? Ask for a hint.',
          ]}
          highScore={highScore}
          onStart={() => setStarted(true)}
        />
      )}

      {started && !paused && !gameOver && gameState && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <ArcadeTopBar
            stats={[
              { label: 'SCORE', value: String(gameState.score).padStart(6, '0') },
              { label: 'HI-SCORE', value: String(Math.max(highScore, gameState.score)).padStart(6, '0'), color: '#fde047' },
              { label: 'SHOTS', value: '●'.repeat(gameState.bulletsRemaining) + '○'.repeat(Math.max(0, 3 - gameState.bulletsRemaining)), color: '#f472b6' },
              { label: 'STREAK', value: `x${gameState.streak}`, color: '#fb923c' },
            ]}
            onPause={() => setPaused(true)}
          />

          {question && (
            <>
              {/* Question - Top */}
              <div className="arcade-panel pointer-events-auto mx-3 mt-2 flex max-h-[34vh] flex-col overflow-hidden text-white">
                <div className="flex flex-none items-center gap-2 px-4 pt-2 text-xs">
                  <span className="font-bold text-pink-300">
                    Question {gameState.currentQuestionIndex + 1} of {gameState.totalQuestions}
                  </span>
                  <span className="truncate text-gray-300">{question.skill || question.topic}</span>
                  <button
                    onClick={() => setShowHint(true)}
                    disabled={showHint}
                    className="ml-auto flex-none rounded-lg border border-amber-300/60 bg-amber-300/15 px-3 py-1 text-xs font-bold text-amber-200 disabled:opacity-40"
                  >
                    Hint
                  </button>
                </div>
                <div className="dark-scroll min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-2">
                  {question.passage && (
                    <QuestionContent html={question.passageHtml} text={question.passage} className="game-reading text-[15px] leading-normal text-gray-100" />
                  )}
                  <QuestionContent
                    html={question.questionHtml}
                    text={question.stem || question.question}
                    className="text-[15px] font-semibold leading-snug sm:text-[17px]"
                  />
                  {showHint && <p className="text-sm text-amber-200">Hint: {strategyHint(question)}</p>}
                </div>
              </div>

              <div className="flex-1" />

              {/* Answers - Bottom */}
              <div className="arcade-panel pointer-events-auto m-3 grid grid-cols-2 gap-2 p-2 text-white lg:grid-cols-4">
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <LaneChip lane={index} size="sm" />
                    <QuestionContent html={question.optionsHtml?.[index]} text={option} className="min-w-0 flex-1 break-words text-sm leading-snug" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {paused && !gameOver && <PauseMenu gameId="carnival" onResume={() => setPaused(false)} />}

      {/* Game Over Modal */}
      {gameOver && analytics && (
        <GameOverModal analytics={analytics} onRestart={handleRestart} />
      )}
    </ArcadeFrame>
  )
}
