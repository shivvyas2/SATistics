'use client'

import { useEffect, useRef } from 'react'
import { GameRenderer } from '@/games/GameRenderer'
import { WhackAMoleGameContainer } from './WhackAMoleGameContainer'
import { CarnivalGameContainer } from './CarnivalGameContainer'
import ZombieGameContainer from './ZombieGameContainer'
import { SubwaySurfersGameContainer } from './SubwaySurfersGameContainer'
import { SquidGameContainer } from './SquidGameContainer'

const OWN_CONTAINER_GAMES = ['zombie', 'whackamole', 'carnival', 'subway-surfers', 'squid-game']

interface GameContainerProps {
  game: {
    id: string
    name?: string
    title?: string
  }
}

export function GameContainer({ game }: GameContainerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<GameRenderer | null>(null)
  const hasOwnContainer = OWN_CONTAINER_GAMES.includes(game.id)

  // Default HTML5 Canvas games - useEffect must be called before any early returns
  useEffect(() => {
    if (hasOwnContainer || !canvasRef.current) return

    const canvas = canvasRef.current

    // Set canvas to full screen
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    // Initialize game renderer - pass canvas directly, not context
    rendererRef.current = new GameRenderer(canvas, game.id)
    rendererRef.current.init().catch((error) => {
      console.error('Failed to initialize game:', error)
    })

    // Handle resize
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth
        canvasRef.current.height = window.innerHeight
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      rendererRef.current?.cleanup()
    }
  }, [game.id, hasOwnContainer])

  // Render specific game containers for Three.js games
  // These early returns must come AFTER all hooks
  if (game.id === 'zombie') {
    return <ZombieGameContainer />
  }

  if (game.id === 'whackamole') {
    return <WhackAMoleGameContainer gameId={game.id} />
  }

  if (game.id === 'carnival') {
    return <CarnivalGameContainer gameId={game.id} />
  }

  if (game.id === 'subway-surfers') {
    return <SubwaySurfersGameContainer />
  }

  if (game.id === 'squid-game') {
    return <SquidGameContainer />
  }

  return (
    <div ref={containerRef} className="relative w-screen h-screen" style={{ margin: 0, padding: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ display: 'block' }}
      />
    </div>
  )
}

export default GameContainer