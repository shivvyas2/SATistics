'use client'

import { useEffect, useRef, useState } from 'react'
import { SATQuestion, WhackAMoleGameState, GameAnalytics } from '@/games/whackamole/types'
import type { WhackAMoleGame } from '@/games/whackamole/WhackAMoleGame'
import { GameOverModal } from './GameOverModal'
import { ReviewList, reviewFromAttempts } from './exam/ReviewList'
import { fetchQuestionsWithCache } from '@/lib/api/questions'
import { satQuestions } from '@/games/whackamole/questions'
import type { SATQuestion as ExamQuestion } from '@/lib/api/questions'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { GameTopBar, HUD_PANEL } from './arcade/GameHud'
import { GameIntro, GameLoading } from './exam/GameIntro'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionContent } from './QuestionContent'

// Answer colors match the signs the moles hold up
const MOLE_COLORS = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3']
const LETTERS = ['A', 'B', 'C', 'D']

// Mallet cursor drawn in the site palette
const MALLET_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'><g transform='rotate(-35 16 16)'><rect x='14' y='12' width='5' height='18' rx='2' fill='%23ECEAE4' stroke='%2317171C' stroke-width='2'/><rect x='6' y='3' width='20' height='10' rx='2' fill='%23D4F34A' stroke='%2317171C' stroke-width='2'/></g></svg>") 8 8, auto`

interface WhackAMoleGameContainerProps {
  gameId: string
}

export function WhackAMoleGameContainer({ gameId }: WhackAMoleGameContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<WhackAMoleGame | null>(null)
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<SATQuestion[]>(satQuestions)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [gameState, setGameState] = useState<WhackAMoleGameState | null>(null)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [analytics, setAnalytics] = useState<GameAnalytics | null>(null)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [highScore, setHighScore] = useState(0)
  // The game loop reads this to know whether to advance the game
  const runningRef = useRef(false)
  runningRef.current = started && !paused

  useEffect(() => setHighScore(getHighScore('whackamole')), [])

  // Fetch AI questions on mount
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const aiQuestions = await fetchQuestionsWithCache('whackamole', 50, satQuestions)
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
    if (!canvasRef.current || loading || !started) return

    const canvas = canvasRef.current
    let animationFrameId: number
    let game: WhackAMoleGame | null = null
    let resizeHandler: (() => void) | null = null

    const initGame = async () => {
      const { WhackAMoleGame: WhackAMoleGameClass } = await import('@/games/whackamole/WhackAMoleGame')

      resizeHandler = () => {
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight
      }

      resizeHandler()
      window.addEventListener('resize', resizeHandler)

      game = new WhackAMoleGameClass(canvas.width, canvas.height, canvas, questions)
      gameRef.current = game

      game.onQuestionChange = (question) => {
        setCurrentQuestion(question)
        setSelectedAnswer(null)
        setShowResult(false)
      }

      game.onGameStateChange = (state) => {
        setGameState(state)
      }

      game.onGameOver = async (analyticsData) => {
        setAnalytics(analyticsData)
        setGameOver(true)
        setHighScore(recordHighScore('whackamole', analyticsData.score))

        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore('whackamole', analyticsData)
        } catch (error) {
          console.error('Error saving score:', error)
        }
      }

      game.init()

      let lastTime = 0
      const gameLoop = (currentTime: number) => {
        if (!game) return
        
        // The game starts after the intro, so time the first frame from itself, not page load
        const deltaTime = lastTime ? currentTime - lastTime : 0
        lastTime = currentTime

        // Hold the game still while paused
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
  }, [loading, questions, started])

  const handleRestart = () => {
    window.location.reload()
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-paper">
        <GameLoading gameId="whackamole" message="Digging the mole holes..." progress={null} />
      </div>
    )
  }

  const question = currentQuestion as ExamQuestion | null
  const isPlaying = started && !paused && !gameOver

  return (
    <div className="game-hud fixed inset-0 h-screen w-screen select-none overflow-hidden bg-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ cursor: MALLET_CURSOR, display: 'block' }}
        tabIndex={-1}
      />

      {!started && (
        <GameIntro
          gameId="whackamole"
          kicker={highScore > 0 ? `Best score ${highScore}` : 'Arcade'}
          title="Whack"
          titleAccent="the answer."
          summary={`${questions.length} quick questions. Four moles pop up, each holding one answer.`}
          steps={[
            { label: 'Click', text: 'Hit the mole holding the letter of the right answer. Tap works on phones.' },
            { label: 'Streak', text: 'Right answers in a row build a streak for bonus points.' },
            { label: 'Pause', text: 'The menu button at the top left stops the game at any time.' },
          ]}
          startLabel="Start whacking"
          onStart={() => setStarted(true)}
        />
      )}

      {isPlaying && gameState && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
          <GameTopBar
            stats={[
              { label: 'Score', value: gameState.score, tone: 'lime' },
              { label: 'Best', value: Math.max(highScore, gameState.score) },
              { label: 'Streak', value: `x${gameState.streak}`, tone: 'cobalt' },
              { label: 'Question', value: `${gameState.currentQuestionIndex + 1}/${gameState.totalQuestions}`, tone: 'coral' },
            ]}
            onPause={() => setPaused(true)}
          />

          {question && (
            <>
              <div className={`${HUD_PANEL} mx-3 mt-3 max-h-[34vh] overflow-hidden`}>
                <div className="flex items-center gap-2 px-4 pt-3 text-xs">
                  <span className="rounded-full border-2 border-white/80 px-2 py-0.5 font-bold">{question.topic}</span>
                  <span className="font-bold capitalize text-lime">{question.difficulty}</span>
                </div>
                <div className="dark-scroll max-h-[26vh] overflow-y-auto px-4 pb-3 pt-2">
                  <QuestionContent
                    html={question.questionHtml}
                    text={question.stem || question.question}
                    className="text-[15px] font-semibold leading-snug sm:text-[17px]"
                  />
                </div>
              </div>

              <div className="flex-1" />

              <div className={`${HUD_PANEL} m-3 grid grid-cols-2 gap-2 p-2 lg:grid-cols-4`}>
                {question.options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2 rounded-xl bg-white/[0.07] px-2 py-1.5">
                    <span
                      className="flex h-7 w-7 flex-none items-center justify-center rounded-full border-2 border-ink text-xs font-black text-ink"
                      style={{ backgroundColor: MOLE_COLORS[index] }}
                    >
                      {LETTERS[index]}
                    </span>
                    <QuestionContent html={question.optionsHtml?.[index]} text={option} className="min-w-0 flex-1 break-words text-sm leading-snug" />
                  </div>
                ))}
              </div>
              <p className="mx-auto mb-3 rounded-full border-2 border-ink bg-mist px-4 py-1 text-sm font-bold text-ink shadow-brutal-sm">
                Hit the mole holding the right answer
              </p>
            </>
          )}
        </div>
      )}

      {paused && !gameOver && <PauseMenu gameId="whackamole" onResume={() => setPaused(false)} />}

      {gameOver && analytics && (
        <GameOverModal analytics={analytics} onRestart={handleRestart}>
          <ReviewList review={reviewFromAttempts(analytics.questionAttempts)} />
        </GameOverModal>
      )}
    </div>
  )
}
