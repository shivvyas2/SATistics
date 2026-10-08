'use client'

import { useEffect, useRef, useState } from 'react'
import type { PacManGame, PacManHudState, PacManReviewItem } from '@/games/pac-man/PacManGame'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { preloadGame } from '@/lib/preload'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { QUICK_SECONDS_PER_QUESTION, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
import { GameOverModal } from './GameOverModal'
import { GameTopBar, HUD_PANEL, Pips } from './arcade/GameHud'
import { GameIntro, GameLoading } from './exam/GameIntro'
import { HintButton } from './exam/HintButton'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionCard } from './exam/QuestionCard'
import { ReviewList } from './exam/ReviewList'
import { useQuestionHints } from './exam/useQuestionHints'
import { useViewShift } from './exam/useViewShift'

const GAME_ID = 'pac-man'
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
  const panelRef = useRef<HTMLDivElement>(null)
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
    // Download the game while its questions load
    preloadGame(GAME_ID)
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
  const handleHint = () => {
    const option = requestHint()
    if (option !== null) gameRef.current?.eliminateAnswer(option)
  }
  useViewShift(panelRef, !!currentQuestion && started && !paused && !result, (x, y) => gameRef.current?.setViewShift(x, y))

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
      className={`h-12 w-12 rounded-xl border-2 border-ink bg-mist text-lg text-ink shadow-brutal-sm touch-none active:translate-y-0.5 active:bg-lime active:shadow-none ${className}`}
    >
      {{ up: '▲', down: '▼', left: '◀', right: '▶' }[label]}
    </button>
  )

  const isPlaying = started && !paused && !result
  const timeShare = hud ? hud.questionSecondsLeft / hud.questionSecondsTotal : 1

  return (
    <div className="game-hud fixed inset-0 h-screen w-screen select-none overflow-hidden bg-ink">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ display: 'block' }}
        tabIndex={-1}
        onPointerDown={(e) => { swipeStart.current = { x: e.clientX, y: e.clientY } }}
        onPointerUp={(e) => handleSwipeEnd(e.clientX, e.clientY)}
        onPointerCancel={() => { swipeStart.current = null }}
      />

      {!questions && <GameLoading gameId={GAME_ID} message={examName ? `Finding ${examName} questions...` : 'Finding questions...'} progress={null} />}

      {questions && !started && (
        <GameIntro
          gameId={GAME_ID}
          kicker={highScore > 0 ? `${examName} · best score ${highScore}` : examName}
          title="Pac-Man,"
          titleAccent="but smarter."
          summary="A question drops into the maze every 10 dots. Eat the pellet with your answer."
          steps={[
            { label: 'Arrows', text: 'Steer with the arrow keys or W A S D. On a phone, swipe or use the on-screen pad.' },
            { label: 'Pellets', text: 'When a question appears, lettered pellets drop in and the ghosts freeze. Eat the one with your answer.' },
            { label: 'Ghosts', text: 'A right answer turns the ghosts blue so you can eat them. A wrong one costs a life.' },
            { label: 'Hint', text: 'Stuck on a question? Ask for a hint to rule out a choice.' },
          ]}
          startLabel="Start game"
          onStart={() => setStarted(true)}
        />
      )}

      {hud && isPlaying && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <GameTopBar
            stats={[
              { label: 'Score', value: hud.score, tone: 'lime' },
              { label: 'Best', value: Math.max(highScore, hud.score) },
              { label: 'Lives', value: <Pips filled={hud.lives} total={Math.max(3, hud.lives)} />, tone: 'coral' },
              { label: 'Level', value: hud.level, tone: hud.isPowerMode ? 'cobalt' : 'paper' },
            ]}
            onPause={() => setPaused(true)}
          />

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Question: the maze stays in play beside it */}
            {currentQuestion && (
              <div
                ref={panelRef}
                className={`${HUD_PANEL} m-3 flex max-h-[44vh] flex-col overflow-hidden lg:max-h-none lg:w-[min(400px,36vw)] lg:self-start`}
              >
                <div className="mx-4 mt-4 h-3 flex-none overflow-hidden rounded-full border-2 border-white/80 bg-white/10">
                  <div
                    className={`h-full ${timeShare < 0.3 ? 'bg-coral' : 'bg-lime'}`}
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
                  hints={hints}
                  eliminated={eliminated}
                />
                <div className="flex flex-none items-center justify-between gap-3 border-t border-white/10 px-4 py-2">
                  <span className="text-sm text-gray-200">Eat the pellet with the letter of your answer</span>
                  <HintButton hintsShown={hints.length} disabled={!canHint} onClick={handleHint} />
                </div>
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              {/* On-screen pad for touch devices */}
              <div className="pointer-events-auto absolute bottom-4 right-4 hidden w-40 grid-cols-3 gap-1 [@media(pointer:coarse)]:grid">
                {padButton('up', 'arrowup', 'col-start-2')}
                {padButton('left', 'arrowleft', 'col-start-1 row-start-2')}
                {padButton('right', 'arrowright', 'col-start-3 row-start-2')}
                {padButton('down', 'arrowdown', 'col-start-2 row-start-3')}
              </div>
            </div>
          </div>
        </div>
      )}

      {started && paused && !result && <PauseMenu gameId={GAME_ID} onResume={() => setPaused(false)} />}

      {result && (
        <GameOverModal analytics={result.analytics} onRestart={() => window.location.reload()} title="Game over" subtitle="The ghosts caught up with you">
          <ReviewList review={result.review} />
        </GameOverModal>
      )}
    </div>
  )
}
