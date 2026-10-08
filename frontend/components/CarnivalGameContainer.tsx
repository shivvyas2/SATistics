'use client'

import { useEffect, useRef, useState } from 'react'
import { SATQuestion, CarnivalGameState, GameAnalytics } from '@/games/carnival/types'
import type { CarnivalGame } from '@/games/carnival/CarnivalGame'
import { GameOverModal } from './GameOverModal'
import { ReviewList, reviewFromAttempts } from './exam/ReviewList'
import { fetchQuestionsWithCache } from '@/lib/api/questions'
import { satQuestions } from '@/games/carnival/questions'
import type { SATQuestion as ExamQuestion } from '@/lib/api/questions'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { strategyHint } from '@/lib/hints'
import { GameTopBar, HUD_PANEL, Pips } from './arcade/GameHud'
import { GameIntro, GameLoading } from './exam/GameIntro'
import { LaneChip } from './exam/LaneChip'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionContent } from './QuestionContent'

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
      <div className="fixed inset-0 bg-paper">
        <GameLoading gameId="carnival" message="Inflating the balloons..." progress={null} />
      </div>
    )
  }

  const question = currentQuestion as ExamQuestion | null

  return (
    <div className="game-hud fixed inset-0 h-screen w-screen select-none overflow-hidden bg-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-manipulation"
        style={{ display: 'block' }}
        tabIndex={-1}
      />

      {!started && (
        <GameIntro
          gameId="carnival"
          kicker={highScore > 0 ? `Best score ${highScore}` : 'Arcade'}
          title="Balloon"
          titleAccent="pop."
          summary={`${questions.length} quick-fire questions. Every balloon carries one answer choice.`}
          steps={[
            { label: 'Aim', text: 'Tap or click the balloon whose letter matches your answer.' },
            { label: '3 shots', text: 'You get three darts per question, so a miss is not the end.' },
            { label: 'Hint', text: 'Stuck? Ask for a hint above the question.' },
          ]}
          startLabel="Start popping"
          onStart={() => setStarted(true)}
        />
      )}

      {started && !paused && !gameOver && gameState && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <GameTopBar
            stats={[
              { label: 'Score', value: gameState.score, tone: 'lime' },
              { label: 'Best', value: Math.max(highScore, gameState.score) },
              { label: 'Shots', value: <Pips filled={gameState.bulletsRemaining} total={3} />, tone: 'coral' },
              { label: 'Streak', value: `x${gameState.streak}`, tone: 'cobalt' },
            ]}
            onPause={() => setPaused(true)}
          />

          {question && (
            <>
              {/* Question - Top */}
              <div className={`${HUD_PANEL} mx-3 mt-3 flex max-h-[34vh] flex-col overflow-hidden`}>
                <div className="flex flex-none items-center gap-2 px-4 pt-2 text-xs">
                  <span className="font-bold text-lime">
                    Question {gameState.currentQuestionIndex + 1} of {gameState.totalQuestions}
                  </span>
                  <span className="truncate text-gray-300">{question.skill || question.topic}</span>
                  <button
                    onClick={() => setShowHint(true)}
                    disabled={showHint}
                    className="ml-auto flex-none rounded-full border-2 border-ink bg-lime px-3 py-1 text-xs font-bold text-ink disabled:opacity-40"
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
                  {showHint && <p className="text-sm text-lime-soft">Hint: {strategyHint(question)}</p>}
                </div>
              </div>

              <div className="flex-1" />

              {/* Answers - Bottom */}
              <div className={`${HUD_PANEL} m-3 grid grid-cols-2 gap-2 p-2 lg:grid-cols-4`}>
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-2 py-1.5">
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
        <GameOverModal analytics={analytics} onRestart={handleRestart}>
          <ReviewList review={reviewFromAttempts(analytics.questionAttempts)} />
        </GameOverModal>
      )}
    </div>
  )
}
