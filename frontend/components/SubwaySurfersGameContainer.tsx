'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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
import { QuestionCard, sourceLabel } from './exam/QuestionCard'
import { ReviewList } from './exam/ReviewList'

// Below this width the question panel sits above the game instead of beside it
const SIDE_PANEL_MIN_WIDTH = 1024

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
      ;(window as any).__subwayDebug = game

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

  // Keep the runner centered in the part of the screen the question panel doesn't cover
  const isPlaying = hud !== null && hud.phase !== 'loading' && hud.phase !== 'ready' && hud.phase !== 'done'
  useEffect(() => {
    const updateShift = () => {
      const panelWidth = panelRef.current?.offsetWidth || 0
      const isBeside = window.innerWidth >= SIDE_PANEL_MIN_WIDTH
      gameRef.current?.setViewShift(isPlaying && isBeside ? panelWidth / 2 : 0)
    }
    updateShift()
    window.addEventListener('resize', updateShift)
    return () => window.removeEventListener('resize', updateShift)
  }, [isPlaying])

  const examName = prefs ? sectionLabel(prefs) : ''

  // Show loading screen while fetching questions and loading the 3D scene
  const isLoading = !questions || !hud || hud.phase === 'loading'

  const gateShare = hud && hud.gateSecondsTotal > 0 ? hud.gateSecondsLeft / hud.gateSecondsTotal : 0
  const isGateClose = hud !== null && hud.gateSecondsLeft < 10
  const sectionTotal = hud ? QUICK_SECONDS_PER_QUESTION * Math.ceil(hud.totalQuestions / hud.moduleCount) : 0
  const isClockLow = hud !== null && sectionTotal > 0 && hud.sectionSecondsLeft / sectionTotal < 0.2

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden" style={{ margin: 0, padding: 0 }}>
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ display: 'block' }} tabIndex={-1} />

      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-sky-600 via-blue-700 to-indigo-900 flex items-center justify-center z-40">
          <div className="text-center px-6">
            <div className="text-white text-2xl font-bold mb-2">
              {questions ? 'Loading the subway...' : `Loading ${examName} questions...`}
            </div>
            <div className="text-white/80 text-sm">
              {questions ? 'Almost ready to run' : 'Finding real exam questions matched to your weak topics'}
            </div>
            <div className="mt-4 w-64 h-2 bg-white/20 rounded-full overflow-hidden mx-auto">
              <div
                className={`h-full bg-white transition-all duration-300 ${questions ? '' : 'animate-pulse'}`}
                style={{ width: `${questions ? Math.max(10, (hud?.loadProgress || 0) * 100) : 40}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Start Screen */}
      {questions && hud?.phase === 'ready' && prefs && (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-30 p-4">
          <div className="bg-gray-900/95 border border-white/15 rounded-2xl p-6 max-w-md w-full text-white shadow-2xl">
            <p className="text-xs font-bold tracking-widest text-sky-400 mb-1">{examName.toUpperCase()}</p>
            <h1 className="text-3xl font-black mb-1">Exam Run</h1>
            <p className="text-gray-400 text-sm mb-5">
              {hud.totalQuestions} quick-fire questions in {hud.moduleCount} timed {hud.moduleCount === 1 ? 'module' : 'modules'},
              about {QUICK_SECONDS_PER_QUESTION} seconds each.
              {hud.moduleCount > 1 && ' Module 2 gets harder or easier based on how you do in Module 1.'}
            </p>
            <ul className="space-y-2 text-sm text-gray-200 mb-6">
              <li><span className="font-bold text-white">← →</span> or <span className="font-bold text-white">1–5</span> — fly into the lane of your answer</li>
              <li><span className="font-bold text-white">Space</span> — dive through the gate as soon as you&apos;re sure</li>
              <li>Take too long and the gates come to you. Whatever lane you&apos;re in is your answer.</li>
            </ul>
            <button
              onClick={() => gameRef.current?.start()}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold text-lg py-3 rounded-xl transition-all shadow-lg active:scale-95"
            >
              Start Run
            </button>
            <Link href="/dashboard" className="block text-center text-gray-400 hover:text-white text-sm mt-3">
              Back to dashboard
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
            className="pointer-events-auto flex flex-col m-3 lg:w-[min(440px,38vw)] max-h-[58vh] lg:max-h-none bg-gray-950/85 backdrop-blur-md rounded-2xl border border-white/15 text-white shadow-2xl overflow-hidden"
          >
            {currentQuestion ? (
              <>
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={hud.questionNumber}
                  totalQuestions={hud.totalQuestions}
                  activeOption={hud.currentLane}
                  activeLabel="YOUR LANE"
                  feedback={feedback}
                  onPick={(lane) => gameRef.current?.setLane(lane)}
                />

                <div className="flex-none px-4 py-2 border-t border-white/10">
                  {feedback ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-bold ${feedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.isCorrect ? `Correct! +${feedback.points}` : 'Not quite'}
                      </span>
                      {!feedback.isCorrect && (
                        <button onClick={() => gameRef.current?.skipFeedback()} className="text-xs font-bold text-sky-300 hover:text-white">
                          Continue (Space)
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{hud.isDiving ? 'Diving...' : 'Gates arrive in'}</span>
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
                    </>
                  )}
                  {sourceLabel(currentQuestion) && (
                    <p className="text-[10px] text-gray-500 mt-1.5 truncate">{sourceLabel(currentQuestion)}</p>
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
              <div className="bg-gray-950/85 backdrop-blur-md rounded-xl border border-white/15 px-4 py-2 text-white text-center">
                <div className="text-[10px] font-bold tracking-wider text-gray-400">
                  MODULE {hud.module}/{hud.moduleCount} TIME
                </div>
                <div className={`text-2xl font-black tabular-nums ${isClockLow ? 'text-red-400' : ''}`}>
                  {formatClock(hud.sectionSecondsLeft)}
                </div>
              </div>
              <div className="bg-gray-950/85 backdrop-blur-md rounded-xl border border-white/15 px-4 py-2 text-white text-center">
                <div className="text-[10px] font-bold tracking-wider text-gray-400">SCORE</div>
                <div className="text-2xl font-black tabular-nums">{hud.score}</div>
              </div>
              <div className="bg-gray-950/85 backdrop-blur-md rounded-xl border border-white/15 px-4 py-2 text-white text-center">
                <div className="text-[10px] font-bold tracking-wider text-gray-400">STREAK</div>
                <div className="text-2xl font-black tabular-nums text-orange-400">{hud.streak > 0 ? `🔥 ${hud.streak}` : '—'}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => gameRef.current?.setPaused(!hud.isPaused)}
                  aria-label={hud.isPaused ? 'Resume' : 'Pause'}
                  className="flex-1 w-9 bg-gray-950/85 hover:bg-gray-800 rounded-lg border border-white/15 text-white text-sm"
                >
                  {hud.isPaused ? '▶' : '⏸'}
                </button>
                <button
                  onClick={() => gameRef.current?.setMuted(!hud.isMuted)}
                  aria-label={hud.isMuted ? 'Unmute' : 'Mute'}
                  className="flex-1 w-9 bg-gray-950/85 hover:bg-gray-800 rounded-lg border border-white/15 text-white text-sm"
                >
                  {hud.isMuted ? '🔇' : '🔊'}
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
                    className="px-4 py-2 rounded-full bg-gray-950/85 hover:bg-gray-800 border border-white/15 text-white text-sm font-bold"
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
                  {hud.isDiving ? 'Diving...' : `Lock in ${LANE_LETTERS[hud.currentLane]} — Dive (Space)`}
                </button>
                <p className="hidden lg:block text-white/90 text-xs font-semibold bg-black/50 rounded-full px-3 py-1 whitespace-nowrap">
                  ← → switch lane · 1–5 jump to lane · P pause
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pause Overlay */}
      {hud && isPlaying && hud.isPaused && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-20">
          <div className="text-center text-white">
            <p className="text-3xl font-black mb-1">Paused</p>
            <p className="text-gray-400 text-sm mb-5">The clock is stopped and the question is hidden.</p>
            <button
              onClick={() => gameRef.current?.setPaused(false)}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold"
            >
              Resume
            </button>
          </div>
        </div>
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
