'use client'

import { useEffect, useRef, useState } from 'react'
import type { PacManGame, PacManHudState, PacManReviewItem } from '@/games/pac-man/PacManGame'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { QUICK_SECONDS_PER_QUESTION, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
import { GameOverModal } from './GameOverModal'
import { ArcadeFrame, ArcadeStartScreen, ArcadeTopBar } from './arcade/ArcadeFrame'
import { HintButton } from './exam/HintButton'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionCard } from './exam/QuestionCard'
import { ReviewList } from './exam/ReviewList'
import { useQuestionHints } from './exam/useQuestionHints'

const GAME_ID = 'pac-man'
const ACCENT = '#facc15'
// A drag shorter than this is a tap, not a swipe
const SWIPE_MIN_DISTANCE = 24

const DIRECTIONS: Record<string, [number, number]> = {
  arrowup: [0, -1], w: [0, -1],
  arrowdown: [0, 1], s: [0, 1],
  arrowleft: [-1, 0], a: [-1, 0],
  arrowright: [1, 0], d: [1, 0],
}

export function PacManGameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<PacManGame | null>(null)
  const [examName, setExamName] = useState('')
  const [questions, setQuestions] = useState<SATQuestion[] | null>(null)
  const [hud, setHud] = useState<PacManHudState | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [questionsAsked, setQuestionsAsked] = useState(0)
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(false)
  const [highScore, setHighScore] = useState(0)
  const [result, setResult] = useState<{ analytics: GameAnalytics; review: PacManReviewItem[] } | null>(null)
  // The game loop reads this to know whether to advance the game
  const runningRef = useRef(false)
  runningRef.current = started && !paused

  useEffect(() => {
    setExamName(sectionLabel(getExamPrefs()))
    setHighScore(getHighScore(GAME_ID))
    let cancelled = false
    fetchAIQuestions(20, undefined, gamePace(GAME_ID)).then((loaded) => {
      if (!cancelled) setQuestions(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !questions) return

    const canvas = canvasRef.current
    let animationFrameId = 0
    let game: PacManGame | null = null
    let cancelled = false

    const handleResize = () => game?.resize(window.innerWidth, window.innerHeight)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!game) return
      if (e.key.startsWith('Arrow') || e.key === ' ') e.preventDefault()
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') setPaused(true)
      else game.handleInput(e.key)
    }

    const initGame = async () => {
      const { PacManGame: PacManGameClass } = await import('@/games/pac-man/PacManGame')
      if (cancelled) return

      game = new PacManGameClass(window.innerWidth, window.innerHeight, canvas)
      gameRef.current = game
      game.setQuestions(questions, QUICK_SECONDS_PER_QUESTION)
      game.onHudChange = setHud
      game.onQuestionChange = (question) => {
        setCurrentQuestion(question)
        if (question) setQuestionsAsked((count) => count + 1)
      }
      game.onGameOver = async (analytics, review) => {
        setResult({ analytics, review })
        setHighScore(recordHighScore(GAME_ID, analytics.score))

        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore(GAME_ID, analytics)
        } catch (error) {
          console.error('Error saving score:', error)
        }
      }
      game.init()

      window.addEventListener('resize', handleResize)
      window.addEventListener('keydown', handleKeyDown)

      let lastTime = 0
      const gameLoop = (currentTime: number) => {
        if (!game) return
        // Cap deltaTime so a background tab doesn't cause a large jump
        const deltaTime = lastTime ? Math.min(currentTime - lastTime, 50) : 0
        lastTime = currentTime

        // Hold the game still on the start screen and while paused
        if (runningRef.current) game.update(deltaTime)
        game.render()

        animationFrameId = requestAnimationFrame(gameLoop)
      }
      animationFrameId = requestAnimationFrame(gameLoop)
    }

    initGame()

    return () => {
      cancelled = true
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('keydown', handleKeyDown)
      game?.cleanup()
      gameRef.current = null
    }
  }, [questions])

  const { hints, eliminated, canHint, requestHint } = useQuestionHints(currentQuestion)

  // Swipe anywhere on the maze to steer
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const handleSwipeEnd = (x: number, y: number) => {
    const start = swipeStart.current
    swipeStart.current = null
    if (!start) return
    const dx = x - start.x
    const dy = y - start.y
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_MIN_DISTANCE) return
    if (Math.abs(dx) > Math.abs(dy)) gameRef.current?.setDirection(Math.sign(dx), 0)
    else gameRef.current?.setDirection(0, Math.sign(dy))
  }

  const padButton = (label: string, key: string, className: string) => (
    <button
      onPointerDown={() => gameRef.current?.setDirection(...DIRECTIONS[key])}
      aria-label={`Move ${label}`}
      className={`h-12 w-12 rounded-lg border-2 border-yellow-300/70 bg-black/70 text-lg text-yellow-300 touch-none active:bg-yellow-300 active:text-black ${className}`}
    >
      {{ up: '▲', down: '▼', left: '◀', right: '▶' }[label]}
    </button>
  )

  const isPlaying = started && !paused && !result
  const timeShare = hud ? hud.questionSecondsLeft / hud.questionSecondsTotal : 1

  return (
    <ArcadeFrame color={ACCENT}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ display: 'block' }}
        tabIndex={-1}
        onPointerDown={(e) => { swipeStart.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={(e) => handleSwipeEnd(e.clientX, e.clientY)}
        onPointerCancel={() => { swipeStart.current = null }}
      />

      {!questions && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="text-center">
            <p className="arcade-font arcade-glow text-lg text-yellow-300">PAC-MAN</p>
            <p className="arcade-font arcade-blink mt-6 text-[10px] text-white">LOADING QUESTIONS...</p>
          </div>
        </div>
      )}

      {questions && !started && (
        <ArcadeStartScreen
          title="PAC-MAN"
          subtitle={`${examName} · a question every 10 dots`}
          instructions={[
            'Swipe, use the on-screen pad, or the arrow keys to steer through the maze.',
            'Answer right and the ghosts turn blue so you can eat them. Answer wrong and you lose a life.',
            'Stuck on a question? Ask for a hint.',
          ]}
          highScore={highScore}
          onStart={() => setStarted(true)}
        />
      )}

      {hud && isPlaying && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <ArcadeTopBar
            stats={[
              { label: '1UP', value: String(hud.score).padStart(6, '0') },
              { label: 'HI-SCORE', value: String(Math.max(highScore, hud.score)).padStart(6, '0'), color: '#fde047' },
              { label: 'LIVES', value: '●'.repeat(hud.lives) || '-', color: '#facc15' },
              { label: 'LEVEL', value: hud.level, color: hud.isPowerMode ? '#60a5fa' : '#ffffff' },
            ]}
            onPause={() => setPaused(true)}
          />

          <div className="flex-1" />

          {/* On-screen pad for touch devices */}
          {!currentQuestion && (
            <div className="pointer-events-auto m-4 hidden w-40 grid-cols-3 gap-1 self-end [@media(pointer:coarse)]:grid">
              {padButton('up', 'arrowup', 'col-start-2')}
              {padButton('left', 'arrowleft', 'col-start-1 row-start-2')}
              {padButton('right', 'arrowright', 'col-start-3 row-start-2')}
              {padButton('down', 'arrowdown', 'col-start-2 row-start-3')}
            </div>
          )}
        </div>
      )}

      {/* Question */}
      {hud && isPlaying && currentQuestion && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 p-3">
          <div className="arcade-panel flex max-h-full w-full max-w-xl flex-col overflow-hidden text-white">
            <div className="mx-4 mt-3 h-2 flex-none overflow-hidden rounded-full border border-white/40 bg-black/70">
              <div
                className={`h-full ${timeShare < 0.3 ? 'bg-red-500' : 'bg-yellow-300'}`}
                style={{ width: `${Math.max(0, Math.min(1, timeShare)) * 100}%` }}
              />
            </div>
            <QuestionCard
              question={currentQuestion}
              questionNumber={questionsAsked}
              totalQuestions={0}
              activeOption={null}
              activeLabel=""
              feedback={null}
              onPick={(option) => gameRef.current?.answer(option)}
              hints={hints}
              eliminated={eliminated}
            />
            <div className="flex flex-none items-center justify-between gap-3 border-t border-white/10 px-4 py-2">
              <span className="text-sm text-gray-300">Tap an answer, or press 1–{currentQuestion.options.length}</span>
              <HintButton hintsShown={hints.length} disabled={!canHint} onClick={requestHint} />
            </div>
          </div>
        </div>
      )}

      {started && paused && !result && <PauseMenu gameId={GAME_ID} onResume={() => setPaused(false)} />}

      {result && (
        <GameOverModal analytics={result.analytics} onRestart={() => window.location.reload()} title="Game Over" subtitle="The ghosts caught up with you" emoji="👻">
          <ReviewList review={result.review} />
        </GameOverModal>
      )}
    </ArcadeFrame>
  )
}
