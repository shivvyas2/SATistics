'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { SquidGameGame } from '@/games/squid-game/SquidGameGame'
import { SquidFeedback, SquidHudState, SquidOutcome, SquidReviewItem } from '@/games/squid-game/types'
import { LANE_LETTERS } from '@/games/subway-surfers/types/game'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { EXAMS, ExamPrefs, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
import { GameOverModal } from './GameOverModal'
import { Calculator } from './exam/Calculator'
import { HintButton } from './exam/HintButton'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionCard, sourceLabel } from './exam/QuestionCard'
import { useQuestionHints } from './exam/useQuestionHints'
import { useViewShift } from './exam/useViewShift'
import { insightFor } from '@/lib/hints'
import { ReviewList } from './exam/ReviewList'

const OUTCOMES: Record<SquidOutcome, { title: string; subtitle: string; emoji: string }> = {
  victory: { title: 'You Survived!', subtitle: 'You crossed the finish line', emoji: '🏆' },
  eliminated: { title: 'Eliminated', subtitle: 'You ran out of lives', emoji: '💀' },
  short: { title: 'Out of Questions', subtitle: 'The game ended before you reached the finish line', emoji: '⏱️' },
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
  const [picked, setPicked] = useState<number | null>(null)
  const [showCalculator, setShowCalculator] = useState(true)
  const [result, setResult] = useState<{ analytics: GameAnalytics; review: SquidReviewItem[]; outcome: SquidOutcome } | null>(null)

  // Keys read the latest pick and question without re-binding the listeners
  const pickedRef = useRef(picked)
  pickedRef.current = picked
  const questionRef = useRef(currentQuestion)
  questionRef.current = currentQuestion
  const eliminatedRef = useRef<number[]>([])
  const isQuant = prefs?.section === 'quant'
  const calculatorOpenRef = useRef(false)
  calculatorOpenRef.current = isQuant && showCalculator

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

      const question = questionRef.current
      const letterIndex = LANE_LETTERS.indexOf(e.key.toUpperCase())
      if (question && letterIndex >= 0 && letterIndex < question.options.length) {
        if (!eliminatedRef.current.includes(letterIndex)) setPicked(letterIndex)
        return
      }
      // With the calculator open, Enter means "equals"
      if (question && e.key === 'Enter' && pickedRef.current !== null && !calculatorOpenRef.current) {
        game.answer(pickedRef.current)
        return
      }
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
      game.onQuestionChange = (question) => {
        setCurrentQuestion(question)
        setPicked(null)
      }
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
    if (ruledOut !== null && ruledOut === picked) setPicked(null)
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

  eliminatedRef.current = eliminated
  const examName = prefs ? sectionLabel(prefs) : ''
  const isLoading = !questions || !hud || hud.phase === 'loading'
  const isRedLight = hud !== null && hud.phase !== 'green'
  const isClockLow = hud !== null && hud.questionSecondsLeft / hud.questionSecondsTotal < 0.2

  return (
    <div className={`fixed inset-0 w-screen h-screen bg-black overflow-hidden game-hud`} style={{ margin: 0, padding: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full touch-none" style={{ display: 'block' }} tabIndex={-1} />

      {isLoading && (
        <div className="absolute inset-0 bg-black flex items-center justify-center z-40">
          <div className="text-center px-6">
            <div className="text-white text-4xl font-bold mb-4 ">SQUID GAME</div>
            <div className="text-gray-300 text-lg mb-6 ">
              {questions ? 'Loading the arena...' : `Loading ${examName} questions...`}
            </div>
            <div className="w-80 max-w-full h-4 bg-gray-800 border-2 border-gray-600 rounded overflow-hidden mx-auto">
              <div
                className={`h-full bg-red-600 transition-all duration-300 ease-out ${questions ? '' : 'animate-pulse'}`}
                style={{ width: `${questions ? Math.max(10, (hud?.loadProgress || 0) * 100) : 40}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {questions && hud?.phase === 'ready' && prefs && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-gray-900/95 border border-white/15 rounded-2xl p-6 max-w-md w-full text-white shadow-2xl">
            <p className="text-xs font-bold tracking-widest text-rose-400 mb-1">{examName.toUpperCase()}</p>
            <h1 className="text-3xl font-black mb-1">
              <span className="text-red-500">Red Light</span>, <span className="text-green-400">Green Light</span>
            </h1>
            <p className="text-gray-300 text-sm mb-5">
              Up to {hud.totalQuestions} full-length questions at real exam pace ({EXAMS[prefs.exam].sections[prefs.section].pacing}).
              {isQuant && ' An on-screen calculator is provided.'}
            </p>
            <ul className="space-y-2 text-sm text-gray-200 mb-6">
              <li><span className="font-bold text-green-400">Green light</span> — hold <span className="font-bold text-white">Run</span> (or W / ↑) to run for the finish line</li>
              <li><span className="font-bold text-red-400">Red light</span> — let go before the doll turns around, then answer the question. Take your time.</li>
              <li>A correct answer earns a long green light. A wrong answer or moving on red costs one of your {hud.maxLives} lives.</li>
              <li>Stuck? Ask for a hint. A missed question comes back later instead of showing the answer.</li>
            </ul>
            <button
              onClick={() => gameRef.current?.start()}
              className="w-full bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-700 hover:to-red-800 text-white font-bold text-lg py-3 rounded-xl transition-all shadow-lg active:scale-95"
            >
              Start Game
            </button>
            <Link href="/games" className="block text-center text-gray-300 hover:text-white text-sm mt-3">
              Back to games
            </Link>
          </div>
        </div>
      )}

      {/* In-game HUD */}
      {hud && isPlaying && !hud.isPaused && (
        <div className="absolute inset-0 flex flex-col lg:flex-row pointer-events-none z-10">
          {/* Question Panel */}
          <div
            ref={panelRef}
            className={`pointer-events-auto flex flex-col m-3 lg:w-[min(460px,40vw)] max-h-[72vh] lg:max-h-none ${currentQuestion ? "" : "lg:self-start"} bg-gray-950/95 backdrop-blur-md rounded-2xl border border-white/15 text-white shadow-2xl overflow-hidden`}
          >
            {currentQuestion ? (
              <>
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={hud.questionNumber}
                  totalQuestions={hud.totalQuestions}
                  activeOption={picked}
                  activeLabel="SELECTED"
                  feedback={feedback}
                  onPick={setPicked}
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
                      <button
                        onClick={() => picked !== null && gameRef.current?.answer(picked)}
                        disabled={picked === null}
                        className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-white/10 disabled:text-gray-400 font-bold text-sm"
                      >
                        {picked === null ? 'Pick an answer' : `Submit ${LANE_LETTERS[picked]}`}
                      </button>
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
              <div className="bg-gray-950/95 backdrop-blur-md rounded-xl border border-white/15 px-2.5 sm:px-4 py-1.5 sm:py-2 text-white text-center">
                <div className="text-xs font-semibold tracking-wide text-gray-300">LIVES</div>
                <div className="text-2xl font-black tabular-nums text-rose-400">
                  ♥ {hud.lives}<span className="text-sm text-gray-400">/{hud.maxLives}</span>
                </div>
              </div>
              <div className="bg-gray-950/95 backdrop-blur-md rounded-xl border border-white/15 px-2.5 sm:px-4 py-1.5 sm:py-2 text-white text-center">
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
                  {hud.isMuted ? '🔇' : '🔊'}
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
            {(hud.phase === 'green' || hud.phase === 'turning') && (
              <div className="pointer-events-auto absolute bottom-14 inset-x-3 hidden items-end justify-between [@media(pointer:coarse)]:flex select-none">
                <div className="flex gap-2">
                  <button {...holdKey('a')} aria-label="Move left" className="h-14 w-14 rounded-full bg-gray-950/80 border border-white/30 text-white text-xl touch-none">◀</button>
                  <button {...holdKey('d')} aria-label="Move right" className="h-14 w-14 rounded-full bg-gray-950/80 border border-white/30 text-white text-xl touch-none">▶</button>
                </div>
                <button {...holdKey('w')} className="h-20 w-20 rounded-full bg-green-500 border-2 border-white text-ink font-black shadow-lg touch-none active:scale-95">
                  RUN
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
