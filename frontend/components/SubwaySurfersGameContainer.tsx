'use client'

import { useEffect, useRef, useState } from 'react'
import type { SubwaySurfersGame } from '@/games/subway-surfers/SubwaySurfersGame'
import {
  LANE_LETTERS,
  RunnerFeedback,
  RunnerHudState,
  RunnerModuleInfo,
  RunnerReviewItem,
} from '@/games/subway-surfers/types/game'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { ExamPrefs, QUICK_SECONDS_PER_QUESTION, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
import { GameOverModal } from './GameOverModal'
import { Calculator } from './exam/Calculator'
import { GameIntro, GameLoading } from './exam/GameIntro'
import { HintButton } from './exam/HintButton'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionCard, sourceLabel } from './exam/QuestionCard'
import { useQuestionHints } from './exam/useQuestionHints'
import { useViewShift } from './exam/useViewShift'
import { insightFor } from '@/lib/hints'
import { ReviewList } from './exam/ReviewList'

// A drag shorter than this is a tap, not a swipe
const SWIPE_MIN_DISTANCE = 30

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function SubwaySurfersGameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<SubwaySurfersGame | null>(null)
  const [prefs, setPrefs] = useState<ExamPrefs | null>(null)
  const [questions, setQuestions] = useState<SATQuestion[] | null>(null)
  const [hud, setHud] = useState<RunnerHudState | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [feedback, setFeedback] = useState<RunnerFeedback | null>(null)
  const [moduleInfo, setModuleInfo] = useState<RunnerModuleInfo | null>(null)
  const [analytics, setAnalytics] = useState<GameAnalytics | null>(null)
  const [review, setReview] = useState<RunnerReviewItem[]>([])
  const [showCalculator, setShowCalculator] = useState(false)

  // Fetch twice as many questions as the run needs so module 2 can adapt its difficulty
  useEffect(() => {
    const examPrefs = getExamPrefs()
    setPrefs(examPrefs)
    let cancelled = false
    fetchAIQuestions(examPrefs.questionCount * 2, undefined, gamePace('subway-surfers')).then((loaded) => {
      if (!cancelled) setQuestions(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!canvasRef.current || !questions || !prefs) return

    const canvas = canvasRef.current
    let animationFrameId = 0
    let game: SubwaySurfersGame | null = null
    let cancelled = false

    const handleResize = () => game?.resize(window.innerWidth, window.innerHeight)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault()
      game?.handleInput(e.key)
    }

    const initGame = async () => {
      const { SubwaySurfersGame: SubwaySurfersGameClass } = await import('@/games/subway-surfers/SubwaySurfersGame')
      if (cancelled) return

      game = new SubwaySurfersGameClass(window.innerWidth, window.innerHeight, canvas, questions, {
        questionCount: prefs.questionCount,
        secondsPerQuestion: QUICK_SECONDS_PER_QUESTION,
      })
      gameRef.current = game

      game.onHudChange = setHud
      game.onQuestionChange = setCurrentQuestion
      game.onFeedback = setFeedback
      game.onModuleChange = setModuleInfo
      game.onGameOver = async (analyticsData, reviewItems) => {
        setAnalytics(analyticsData)
        setReview(reviewItems)

        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore('subway-surfers', analyticsData)
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

        game.update(deltaTime)
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
  }, [questions, prefs])

  const isPlaying = hud !== null && hud.phase !== 'loading' && hud.phase !== 'ready' && hud.phase !== 'done'
  useViewShift(panelRef, isPlaying && !hud?.isPaused, (x, y) => gameRef.current?.setViewShift(x, y))

  const { hints, eliminated, canHint, requestHint } = useQuestionHints(currentQuestion)
  const handleHint = () => {
    const lane = requestHint()
    if (lane !== null) gameRef.current?.eliminateLane(lane)
  }

  // Swipe sideways on the game to change lanes
  const swipeStartX = useRef<number | null>(null)
  const handleSwipeEnd = (clientX: number) => {
    const distance = swipeStartX.current === null ? 0 : clientX - swipeStartX.current
    swipeStartX.current = null
    if (Math.abs(distance) > SWIPE_MIN_DISTANCE) gameRef.current?.moveLane(distance > 0 ? 1 : -1)
  }

  const examName = prefs ? sectionLabel(prefs) : ''

  // Show loading screen while fetching questions and loading the 3D scene
  const isLoading = !questions || !hud || hud.phase === 'loading'

  const gateShare = hud && hud.gateSecondsTotal > 0 ? hud.gateSecondsLeft / hud.gateSecondsTotal : 0
  const isGateClose = hud !== null && hud.gateSecondsLeft < 10
  const sectionTotal = hud ? QUICK_SECONDS_PER_QUESTION * Math.ceil(hud.totalQuestions / hud.moduleCount) : 0
  const isClockLow = hud !== null && sectionTotal > 0 && hud.sectionSecondsLeft / sectionTotal < 0.2

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden game-hud skin-subway`} style={{ margin: 0, padding: 0 }}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full touch-none"
        style={{ display: 'block' }}
        tabIndex={-1}
        onPointerDown={(e) => { swipeStartX.current = e.clientX }}
        onPointerUp={(e) => handleSwipeEnd(e.clientX)}
        onPointerCancel={() => { swipeStartX.current = null }}
      />

      {isLoading && (
        <GameLoading
          gameId="subway-surfers"
          message={questions ? 'Laying the tracks...' : `Finding ${examName} questions...`}
          progress={questions ? hud?.loadProgress ?? 0 : null}
        />
      )}

      {questions && hud?.phase === 'ready' && prefs && (
        <GameIntro
          gameId="subway-surfers"
          kicker={examName}
          title="Exam"
          titleAccent="run."
          summary={`${hud.totalQuestions} quick-fire questions in ${hud.moduleCount} timed ${hud.moduleCount === 1 ? 'module' : 'modules'}, about ${QUICK_SECONDS_PER_QUESTION} seconds each.${hud.moduleCount > 1 ? ' Module 2 gets harder or easier based on Module 1.' : ''}`}
          steps={[
            { label: '← →', text: 'Steer into the lane of your answer. A and D work too, or swipe on a phone.' },
            { label: '↑', text: 'Dive through the gate as soon as you are sure. Space and W work too.' },
            { label: 'Hint', text: 'Stuck? Ask for one. Miss a question and it comes back later instead of showing the answer.' },
          ]}
          startLabel="Start run"
          onStart={() => gameRef.current?.start()}
        />
      )}

      {/* In-game HUD */}
      {hud && isPlaying && !hud.isPaused && (
        <div className="absolute inset-0 flex flex-col lg:flex-row pointer-events-none z-10">
          {/* Question Panel */}
          <div
            ref={panelRef}
            className="hud-panel pointer-events-auto flex flex-col m-3 lg:w-[min(440px,38vw)] max-h-[58vh] lg:max-h-none overflow-hidden"
          >
            <div className="hud-banner flex flex-none items-center justify-between px-4 py-1.5">
              <span>● {examName.toUpperCase()} LINE</span>
              <span>MODULE {hud.module}/{hud.moduleCount}</span>
            </div>
            {currentQuestion ? (
              <>
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={hud.questionNumber}
                  totalQuestions={hud.totalQuestions}
                  activeOption={hud.currentLane}
                  activeLabel="YOUR LANE"
                  feedback={feedback}
                  hints={hints}
                  eliminated={eliminated}
                  insight={feedback?.willRetry ? insightFor(currentQuestion, feedback.selected) : null}
                />

                <div className="flex-none px-4 py-2 border-t border-white/10">
                  {feedback ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-bold ${feedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.isCorrect ? `Correct! +${feedback.points}` : feedback.willRetry ? 'Not quite. You get another try later.' : 'Not quite'}
                      </span>
                      {!feedback.isCorrect && (
                        <button onClick={() => gameRef.current?.skipFeedback()} className="text-xs font-bold text-sky-300 hover:text-white">
                          Continue
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-gray-300">{hud.isDiving ? 'Diving...' : 'Gates arrive in'}</span>
                          <span className={`font-bold tabular-nums ${isGateClose ? 'text-amber-400' : 'text-white'}`}>
                            {formatClock(hud.gateSecondsLeft)}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isGateClose ? 'bg-amber-400' : 'bg-sky-400'}`}
                            style={{ width: `${Math.min(100, gateShare * 100)}%` }}
                          />
                        </div>
                      </div>
                      <HintButton hintsShown={hints.length} disabled={!canHint || hud.isDiving} onClick={handleHint} />
                    </div>
                  )}
                  {sourceLabel(currentQuestion) && (
                    <p className="text-xs text-gray-300 mt-1.5 truncate">{sourceLabel(currentQuestion)}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                <p className="text-xs font-bold tracking-widest text-sky-400 mb-1">MODULE {hud.module} OF {hud.moduleCount}</p>
                {moduleInfo && (
                  <>
                    <p className="text-xl font-black mb-2">{moduleInfo.isHarder ? 'Stepping up the difficulty' : 'Building back up'}</p>
                    <p className="text-sm text-gray-300">
                      You got {moduleInfo.previousCorrect} of {moduleInfo.previousTotal} in Module 1, so this module is{' '}
                      {moduleInfo.isHarder ? 'harder' : 'easier'}, just like the real exam.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Game Area */}
          <div className="relative flex-1 min-h-0">
            {/* Exam Status - Top Right */}
            <div className="pointer-events-auto absolute top-0 lg:top-3 right-3 flex items-stretch gap-2">
              <div className="hud-panel px-2.5 sm:px-4 py-1.5 sm:py-2 text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">
                  MODULE {hud.module}/{hud.moduleCount} TIME
                </div>
                <div className={`text-lg sm:text-2xl font-black tabular-nums ${isClockLow ? 'text-red-400' : ''}`}>
                  {formatClock(hud.sectionSecondsLeft)}
                </div>
              </div>
              <div className="hud-panel px-2.5 sm:px-4 py-1.5 sm:py-2 text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">SCORE</div>
                <div className="text-lg sm:text-2xl font-black tabular-nums">{hud.score}</div>
              </div>
              <div className="hud-panel px-2.5 sm:px-4 py-1.5 sm:py-2 text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">STREAK</div>
                <div className="text-lg sm:text-2xl font-black tabular-nums text-orange-400">{hud.streak > 0 ? `x${hud.streak}` : '—'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => gameRef.current?.setPaused(!hud.isPaused)}
                  aria-label={hud.isPaused ? 'Resume' : 'Pause'}
                  className="flex-1 w-9 bg-gray-950/95 hover:bg-gray-800 rounded-lg border border-white/15 text-white text-sm"
                >
                  {hud.isPaused ? '▶' : '⏸'}
                </button>
                <button
                  onClick={() => gameRef.current?.setMuted(!hud.isMuted)}
                  aria-label={hud.isMuted ? 'Unmute' : 'Mute'}
                  className="flex-1 w-9 bg-gray-950/95 hover:bg-gray-800 rounded-lg border border-white/15 text-white text-sm"
                >
                  <span className={hud.isMuted ? 'line-through opacity-60' : ''}>♪</span>
                </button>
              </div>
            </div>

            {/* Calculator - Bottom Right */}
            {prefs?.section === 'quant' && (
              <div className="pointer-events-auto absolute bottom-4 right-3 flex flex-col items-end gap-2">
                {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}
                {!showCalculator && (
                  <button
                    onClick={() => setShowCalculator(true)}
                    className="px-4 py-2 rounded-full bg-gray-950/95 hover:bg-gray-800 border border-white/15 text-white text-sm font-bold"
                  >
                    Calculator
                  </button>
                )}
              </div>
            )}

            {/* Controls - Bottom Center */}
            {hud.phase === 'question' && (
              <div className="pointer-events-auto absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <button
                  onClick={() => gameRef.current?.dive()}
                  disabled={hud.isDiving}
                  className="px-6 py-2 rounded-full bg-white text-gray-900 font-black text-sm shadow-lg active:scale-95 disabled:opacity-60 whitespace-nowrap"
                >
                  {hud.isDiving ? 'Diving...' : `Lock in ${LANE_LETTERS[hud.currentLane]} — Dive`}
                </button>
                <p className="hidden lg:block text-white text-sm font-semibold bg-black/75 rounded-full px-4 py-1.5 whitespace-nowrap">
                  ← → or A D steer · ↑ or Space dive · P pause
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {hud && isPlaying && hud.isPaused && (
        <PauseMenu gameId="subway-surfers" onResume={() => gameRef.current?.setPaused(false)} />
      )}

      {/* Game Over Modal */}
      {analytics && (
        <GameOverModal analytics={analytics} onRestart={() => window.location.reload()}>
          <ReviewList review={review} />
        </GameOverModal>
      )}
    </div>
  )
}
