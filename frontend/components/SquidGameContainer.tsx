'use client'

import { useEffect, useRef, useState } from 'react'
import type { SquidGameGame } from '@/games/squid-game/SquidGameGame'
import { SquidFeedback, SquidHudState, SquidOutcome, SquidReviewItem } from '@/games/squid-game/types'
import { LANE_LETTERS } from '@/games/subway-surfers/types/game'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { EXAMS, ExamPrefs, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
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

const OUTCOMES: Record<SquidOutcome, { title: string; subtitle: string }> = {
  victory: { title: 'You Survived!', subtitle: 'You crossed the finish line' },
  eliminated: { title: 'Eliminated', subtitle: 'You ran out of lives' },
  short: { title: 'Out of Questions', subtitle: 'The game ended before you reached the finish line' },
}

function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

export function SquidGameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<SquidGameGame | null>(null)
  const [prefs, setPrefs] = useState<ExamPrefs | null>(null)
  const [questions, setQuestions] = useState<SATQuestion[] | null>(null)
  const [hud, setHud] = useState<SquidHudState | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [feedback, setFeedback] = useState<SquidFeedback | null>(null)
  const [showCalculator, setShowCalculator] = useState(true)
  const [result, setResult] = useState<{ analytics: GameAnalytics; review: SquidReviewItem[]; outcome: SquidOutcome } | null>(null)

  const isQuant = prefs?.section === 'quant'

  // Fetch extra questions so difficulty can adapt to how the player is doing
  useEffect(() => {
    const examPrefs = getExamPrefs()
    setPrefs(examPrefs)
    let cancelled = false
    fetchAIQuestions(examPrefs.questionCount * 2, undefined, gamePace('squid-game')).then((loaded) => {
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
    let game: SquidGameGame | null = null
    let cancelled = false

    const handleResize = () => game?.resize(window.innerWidth, window.innerHeight)

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !game) return
      if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault()

      game.handleInput(e.key)
    }
    const handleKeyUp = (e: KeyboardEvent) => game?.handleKeyRelease(e.key)

    const initGame = async () => {
      const { SquidGameGame: SquidGameClass } = await import('@/games/squid-game/SquidGameGame')
      if (cancelled) return

      game = new SquidGameClass(window.innerWidth, window.innerHeight, canvas, questions, {
        questionCount: prefs.questionCount,
        secondsPerQuestion: EXAMS[prefs.exam].sections[prefs.section].secondsPerQuestion,
      })
      gameRef.current = game

      game.onHudChange = setHud
      game.onQuestionChange = setCurrentQuestion
      game.onFeedback = setFeedback
      game.onGameOver = async (analytics, review, outcome) => {
        setResult({ analytics, review, outcome })

        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore('squid-game', analytics)
        } catch (error) {
          console.error('Error saving score:', error)
        }
      }

      game.init()
      window.addEventListener('resize', handleResize)
      window.addEventListener('keydown', handleKeyDown)
      window.addEventListener('keyup', handleKeyUp)

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
      window.removeEventListener('keyup', handleKeyUp)
      game?.cleanup()
      gameRef.current = null
    }
  }, [questions, prefs])

  const isPlaying = hud !== null && hud.phase !== 'loading' && hud.phase !== 'ready' && !result
  useViewShift(panelRef, isPlaying && !hud?.isPaused, (x, y) => gameRef.current?.setViewShift(x, y))

  const { hints, eliminated, canHint, requestHint } = useQuestionHints(currentQuestion)
  const handleHint = () => {
    const ruledOut = requestHint()
    gameRef.current?.registerHint()
    if (ruledOut !== null) gameRef.current?.eliminatePad(ruledOut)
  }

  // On-screen buttons stand in for the movement keys on touch devices
  const holdKey = (key: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault()
      gameRef.current?.handleInput(key)
    },
    onPointerUp: () => gameRef.current?.handleKeyRelease(key),
    onPointerLeave: () => gameRef.current?.handleKeyRelease(key),
    onPointerCancel: () => gameRef.current?.handleKeyRelease(key),
  })

  const examName = prefs ? sectionLabel(prefs) : ''
  const isLoading = !questions || !hud || hud.phase === 'loading'
  const isRedLight = hud !== null && hud.phase !== 'green'
  const isClockLow = hud !== null && hud.questionSecondsLeft / hud.questionSecondsTotal < 0.2

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden game-hud skin-squid`} style={{ margin: 0, padding: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" style={{ display: 'block' }} tabIndex={-1} />

      {isLoading && (
        <GameLoading
          gameId="squid-game"
          message={questions ? 'Setting up the arena...' : `Finding ${examName} questions...`}
          progress={questions ? hud?.loadProgress ?? 0 : null}
        />
      )}

      {questions && hud?.phase === 'ready' && prefs && (
        <GameIntro
          gameId="squid-game"
          kicker={examName}
          title="Red light,"
          titleAccent="green light."
          summary={`Up to ${hud.totalQuestions} full-length questions at real exam pace (${EXAMS[prefs.exam].sections[prefs.section].pacing}).${isQuant ? ' An on-screen calculator is provided.' : ''}`}
          steps={[
            { label: 'W A S D', text: 'Run for the finish line on green. Arrow keys work too, and phones get on-screen buttons.' },
            { label: 'Freeze', text: 'Let go before the doll turns around. Moving on red costs a life.' },
            { label: 'Pads', text: `Answer pads appear on the sand. Walk onto your answer and stay there. A wrong answer costs one of your ${hud.maxLives} lives.` },
            { label: 'Hint', text: 'Stuck? Ask for one. A missed question comes back later instead of showing the answer.' },
          ]}
          startLabel="Start game"
          onStart={() => gameRef.current?.start()}
        />
      )}

      {/* In-game HUD */}
      {hud && isPlaying && !hud.isPaused && (
        <div className="absolute inset-0 flex flex-col lg:flex-row pointer-events-none z-10">
          {/* Question Panel */}
          <div
            ref={panelRef}
            className={`hud-panel pointer-events-auto flex flex-col m-3 lg:w-[min(460px,40vw)] max-h-[72vh] lg:max-h-none ${currentQuestion ? '' : 'lg:self-start'} overflow-hidden`}
          >
            <div className="hud-banner flex flex-none items-center justify-between px-4 py-1.5">
              <span>○ △ □ &nbsp;{examName.toUpperCase()}</span>
              <span>PLAYER 456</span>
            </div>
            {currentQuestion ? (
              <>
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={hud.questionNumber}
                  totalQuestions={hud.totalQuestions}
                  activeOption={hud.standingPad}
                  activeLabel="STANDING HERE"
                  feedback={feedback}
                  hints={hints}
                  eliminated={eliminated}
                  insight={feedback?.willRetry ? insightFor(currentQuestion, feedback.selected) : null}
                />
                <div className="flex-none px-4 py-3 border-t border-white/10">
                  {feedback ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-bold ${feedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.isCorrect
                          ? `Correct! +${feedback.points} · long green light`
                          : feedback.selected === null
                          ? 'Out of time · −1 life'
                          : 'Not quite · −1 life'}
                      </span>
                      {!feedback.isCorrect && (
                        <button onClick={() => gameRef.current?.skipFeedback()} className="text-xs font-bold text-sky-300 hover:text-white">
                          Continue
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="flex-none">
                        <div className="text-xs font-semibold tracking-wide text-gray-300">TIME LEFT</div>
                        <div className={`text-xl font-black tabular-nums ${isClockLow ? 'text-red-400' : ''}`}>
                          {formatClock(hud.questionSecondsLeft)}
                        </div>
                      </div>
                      {hud.standingPad === null ? (
                        <p className="flex-1 text-sm text-gray-200">Walk onto the pad of your answer and stay there.</p>
                      ) : (
                        <button
                          onClick={() => gameRef.current?.lockIn()}
                          className="relative flex-1 overflow-hidden rounded-xl bg-white/10 py-2.5 text-sm font-bold"
                        >
                          <span className="absolute inset-y-0 left-0 bg-blue-600" style={{ width: `${hud.lockProgress * 100}%` }} />
                          <span className="relative">Locking in {LANE_LETTERS[hud.standingPad]}... (Space to lock now)</span>
                        </button>
                      )}
                      <HintButton hintsShown={hints.length} disabled={!canHint} onClick={handleHint} />
                    </div>
                  )}
                  {sourceLabel(currentQuestion) && (
                    <p className="text-xs text-gray-300 mt-1.5 truncate">{sourceLabel(currentQuestion)}</p>
                  )}
                </div>
              </>
            ) : (
              <div className="p-6 text-center">
                {hud.phase === 'green' ? (
                  <>
                    <p className="text-3xl font-black text-green-400 mb-2">GREEN LIGHT</p>
                    <p className="text-sm text-gray-300 mb-4">Run! Let go before she turns around.</p>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full"
                        style={{ width: `${(hud.greenSecondsLeft / hud.greenSecondsTotal) * 100}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-black text-red-500 mb-2">RED LIGHT</p>
                    <p className="text-sm text-gray-300">
                      {hud.wasCaughtMoving ? 'You moved! −1 life' : hud.phase === 'done' ? '' : 'Freeze!'}
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Game Area */}
          <div className="relative flex-1 min-h-0">
            {/* Status - Top Right */}
            <div className="pointer-events-auto absolute top-0 lg:top-3 right-3 flex items-stretch gap-2">
              <div
                className={`rounded-xl border px-4 py-2 text-center font-black text-white ${
                  isRedLight ? 'bg-red-600/90 border-red-300/50' : 'bg-green-600/90 border-green-300/50'
                }`}
              >
                <div className="text-xs font-semibold tracking-wide opacity-90">LIGHT</div>
                <div className="text-2xl">{isRedLight ? 'RED' : 'GREEN'}</div>
              </div>
              <div className="hud-panel px-2.5 sm:px-4 py-1.5 sm:py-2 text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">LIVES</div>
                <div className="text-2xl font-black tabular-nums text-rose-400">
                  ♥ {hud.lives}<span className="text-sm text-gray-400">/{hud.maxLives}</span>
                </div>
              </div>
              <div className="hud-panel px-2.5 sm:px-4 py-1.5 sm:py-2 text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">SCORE</div>
                <div className="text-2xl font-black tabular-nums">{hud.score}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => gameRef.current?.setPaused(true)}
                  aria-label="Pause"
                  className="flex-1 w-9 bg-gray-950/95 hover:bg-gray-800 rounded-lg border border-white/15 text-white text-sm"
                >
                  ⏸
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

            {/* Distance to the finish line - Bottom Center */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[min(360px,60%)]">
              <div className="flex justify-between text-xs font-bold text-white mb-1 bg-black/75 rounded-full px-3 py-1">
                <span>START</span>
                <span>{Math.round(hud.progress * 100)}% TO FINISH</span>
              </div>
              <div className="h-2.5 bg-black/75 rounded-full overflow-hidden border border-white/30">
                <div className="h-full bg-rose-500 rounded-full" style={{ width: `${hud.progress * 100}%` }} />
              </div>
            </div>

            {/* Touch Controls - shown where there is no keyboard */}
            {(hud.phase === 'green' || hud.phase === 'turning' || hud.phase === 'question') && (
              <div className="pointer-events-auto absolute bottom-14 inset-x-3 hidden items-end justify-between [@media(pointer:coarse)]:flex select-none">
                <div className="flex gap-2">
                  <button {...holdKey('a')} aria-label="Move left" className="h-14 w-14 rounded-full bg-gray-950/80 border border-white/30 text-white text-xl touch-none">◀</button>
                  <button {...holdKey('d')} aria-label="Move right" className="h-14 w-14 rounded-full bg-gray-950/80 border border-white/30 text-white text-xl touch-none">▶</button>
                </div>
                <button {...holdKey('w')} className="h-20 w-20 rounded-full bg-green-500 border-2 border-white text-ink font-black shadow-lg touch-none active:scale-95">
                  {hud.phase === 'question' ? 'WALK' : 'RUN'}
                </button>
              </div>
            )}

            {/* Calculator - Bottom Right */}
            {isQuant && hud.phase === 'question' && (
              <div className="pointer-events-auto absolute bottom-4 right-3">
                {showCalculator ? (
                  <Calculator keyboard onClose={() => setShowCalculator(false)} />
                ) : (
                  <button
                    onClick={() => setShowCalculator(true)}
                    className="px-4 py-2 rounded-full bg-gray-950/95 hover:bg-gray-800 border border-white/15 text-white text-sm font-bold"
                  >
                    Calculator
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {hud && isPlaying && hud.isPaused && (
        <PauseMenu gameId="squid-game" onResume={() => gameRef.current?.setPaused(false)} />
      )}

      {/* Game Over Modal */}
      {result && (
        <GameOverModal analytics={result.analytics} onRestart={() => window.location.reload()} {...OUTCOMES[result.outcome]}>
          <ReviewList review={result.review} />
        </GameOverModal>
      )}
    </div>
  )
}
