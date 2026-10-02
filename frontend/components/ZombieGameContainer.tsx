'use client'

import { useEffect, useRef, useState } from 'react'
import type { ZombieGame } from '@/games/zombie/ZombieGame'
import { ZombieFeedback, ZombieHudState, ZombieReviewItem } from '@/games/zombie/types'
import { GameAnalytics } from '@/games/whackamole/types'
import { SATQuestion, fetchAIQuestions } from '@/lib/api/questions'
import { getHighScore, recordHighScore } from '@/lib/arcade'
import { ExamPrefs, QUICK_SECONDS_PER_QUESTION, gamePace, getExamPrefs, sectionLabel } from '@/lib/exam'
import { insightFor } from '@/lib/hints'
import { GameOverModal } from './GameOverModal'
import { ArcadeFrame, ArcadeStartScreen, ArcadeTopBar } from './arcade/ArcadeFrame'
import { Calculator } from './exam/Calculator'
import { HintButton } from './exam/HintButton'
import { PauseMenu } from './exam/PauseMenu'
import { QuestionCard, sourceLabel } from './exam/QuestionCard'
import { ReviewList } from './exam/ReviewList'
import { useQuestionHints } from './exam/useQuestionHints'
import { useViewShift } from './exam/useViewShift'

const GAME_ID = 'zombie'
const ACCENT = '#a3e635'

export default function ZombieGameContainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<ZombieGame | null>(null)
  const [prefs, setPrefs] = useState<ExamPrefs | null>(null)
  const [questions, setQuestions] = useState<SATQuestion[] | null>(null)
  const [hud, setHud] = useState<ZombieHudState | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<SATQuestion | null>(null)
  const [feedback, setFeedback] = useState<ZombieFeedback | null>(null)
  const [highScore, setHighScore] = useState(0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [result, setResult] = useState<{ analytics: GameAnalytics; review: ZombieReviewItem[]; survived: boolean } | null>(null)

  useEffect(() => {
    const examPrefs = getExamPrefs()
    setPrefs(examPrefs)
    setHighScore(getHighScore(GAME_ID))
    let cancelled = false
    fetchAIQuestions(examPrefs.questionCount, undefined, gamePace(GAME_ID)).then((loaded) => {
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
    let game: ZombieGame | null = null
    let cancelled = false

    const handleResize = () => game?.resize(window.innerWidth, window.innerHeight)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || !game) return
      if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') game.setPaused(true)
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        game.start()
        game.skipFeedback()
      } else if (e.key >= '1' && e.key <= '5') game.shootZombie(Number(e.key) - 1)
    }

    const initGame = async () => {
      const { ZombieGame: ZombieGameClass } = await import('@/games/zombie/ZombieGame')
      if (cancelled) return

      game = new ZombieGameClass(window.innerWidth, window.innerHeight, canvas, questions, {
        questionCount: prefs.questionCount,
        secondsPerQuestion: QUICK_SECONDS_PER_QUESTION,
      })
      gameRef.current = game

      game.onHudChange = setHud
      game.onQuestionChange = setCurrentQuestion
      game.onFeedback = setFeedback
      game.onGameOver = async (analytics, review, survived) => {
        setResult({ analytics, review, survived })
        setHighScore(recordHighScore(GAME_ID, analytics.score))

        // Save score to database via FastAPI
        try {
          const { apiClient } = await import('@/lib/api/client')
          await apiClient.saveScore(GAME_ID, analytics)
        } catch (error) {
          console.error('Error saving score:', error)
        }
      }
      // The game reports its first state from the constructor, before the callbacks are set
      game.setMuted(false)

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

  const isPlaying = hud !== null && hud.phase !== 'ready' && !result
  useViewShift(panelRef, isPlaying && !hud?.isPaused, (x, y) => gameRef.current?.setViewShift(x, y))

  const { hints, eliminated, canHint, requestHint } = useQuestionHints(currentQuestion)
  const handleHint = () => {
    const lane = requestHint()
    if (lane !== null) gameRef.current?.eliminateZombie(lane)
  }

  const examName = prefs ? sectionLabel(prefs) : ''
  const timeShare = hud ? hud.secondsLeft / hud.secondsTotal : 1

  return (
    <ArcadeFrame color={ACCENT}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full cursor-crosshair touch-none"
        style={{ display: 'block' }}
        tabIndex={-1}
        onPointerMove={(e) => gameRef.current?.setAim(e.clientX, e.clientY)}
        onPointerDown={(e) => gameRef.current?.shootAt(e.clientX, e.clientY)}
      />

      {!questions && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black">
          <div className="text-center">
            <p className="arcade-font arcade-glow text-lg text-lime-400">ZOMBIE APOCALYPSE</p>
            <p className="arcade-font arcade-blink mt-6 text-[10px] text-white">LOADING {examName.toUpperCase()}...</p>
          </div>
        </div>
      )}

      {questions && hud?.phase === 'ready' && (
        <ArcadeStartScreen
          title="ZOMBIE APOCALYPSE"
          subtitle={`${examName} · ${hud.totalQuestions} quick-fire questions, ${QUICK_SECONDS_PER_QUESTION} seconds each`}
          instructions={[
            'Every zombie carries one answer. Tap or click the zombie with the right one.',
            'A wrong shot, or letting the horde reach you, costs a heart.',
            'Stuck? Ask for a hint. A missed question comes back later instead of showing the answer.',
          ]}
          highScore={highScore}
          onStart={() => gameRef.current?.start()}
        />
      )}

      {hud && isPlaying && !hud.isPaused && (
        <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
          <ArcadeTopBar
            stats={[
              { label: 'SCORE', value: String(hud.score).padStart(6, '0') },
              { label: 'HI-SCORE', value: String(Math.max(highScore, hud.score)).padStart(6, '0'), color: '#fde047' },
              { label: 'LIVES', value: '♥'.repeat(hud.health) + '♡'.repeat(hud.maxHealth - hud.health), color: '#fb7185' },
              { label: 'STREAK', value: `x${hud.streak}`, color: '#fb923c' },
            ]}
            isMuted={hud.isMuted}
            onPause={() => gameRef.current?.setPaused(true)}
            onToggleMute={() => gameRef.current?.setMuted(!hud.isMuted)}
          />

          {/* Time until the horde arrives */}
          <div className="mx-3 mt-2 h-2 overflow-hidden rounded-full border border-white/40 bg-black/70">
            <div
              className={`h-full ${timeShare < 0.3 ? 'bg-red-500' : 'bg-lime-400'}`}
              style={{ width: `${Math.max(0, Math.min(1, timeShare)) * 100}%` }}
            />
          </div>

          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {currentQuestion && (
              <div
                ref={panelRef}
                className="arcade-panel pointer-events-auto m-3 flex max-h-[52vh] flex-col overflow-hidden text-white lg:max-h-none lg:w-[min(440px,38vw)] lg:self-start"
              >
                <QuestionCard
                  question={currentQuestion}
                  questionNumber={hud.questionNumber}
                  totalQuestions={hud.totalQuestions}
                  activeOption={null}
                  activeLabel=""
                  feedback={feedback}
                  onPick={(lane) => gameRef.current?.shootZombie(lane)}
                  hints={hints}
                  eliminated={eliminated}
                  insight={feedback?.willRetry ? insightFor(currentQuestion, feedback.selected) : null}
                />
                <div className="flex-none border-t border-white/10 px-4 py-2">
                  {feedback ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className={`font-bold ${feedback.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {feedback.isCorrect
                          ? `Headshot! +${feedback.points}`
                          : feedback.selected === null
                          ? 'The horde got to you'
                          : 'Wrong zombie'}
                      </span>
                      {!feedback.isCorrect && (
                        <button onClick={() => gameRef.current?.skipFeedback()} className="text-xs font-bold text-sky-300 hover:text-white">
                          Continue
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-300">Shoot the zombie with the right answer</span>
                      <HintButton hintsShown={hints.length} disabled={!canHint} onClick={handleHint} />
                    </div>
                  )}
                  {sourceLabel(currentQuestion) && (
                    <p className="mt-1.5 truncate text-xs text-gray-300">{sourceLabel(currentQuestion)}</p>
                  )}
                </div>
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              {prefs?.section === 'quant' && (
                <div className="pointer-events-auto absolute bottom-4 right-3">
                  {showCalculator ? (
                    <Calculator onClose={() => setShowCalculator(false)} />
                  ) : (
                    <button
                      onClick={() => setShowCalculator(true)}
                      className="rounded-full border border-white/30 bg-gray-950/95 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
                    >
                      Calculator
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hud && isPlaying && hud.isPaused && (
        <PauseMenu gameId={GAME_ID} onResume={() => gameRef.current?.setPaused(false)} />
      )}

      {result && (
        <GameOverModal
          analytics={result.analytics}
          onRestart={() => window.location.reload()}
          title={result.survived ? 'You Survived!' : 'Game Over'}
          subtitle={result.survived ? 'The horde is no match for you' : 'The zombies got you this time'}
          emoji={result.survived ? '🏆' : '🧟'}
        >
          <ReviewList review={result.review} />
        </GameOverModal>
      )}
    </ArcadeFrame>
  )
}
