'use client'

import { RefObject, useEffect } from 'react'

// Below this width the question panel sits above the game instead of beside it
export const SIDE_PANEL_MIN_WIDTH = 1024

/**
 * Keeps the action centered in the part of the screen the question panel
 * doesn't cover: beside it on wide screens, below it on phones and tablets
 */
export function useViewShift(
  panelRef: RefObject<HTMLElement>,
  isActive: boolean,
  setViewShift: (x: number, y: number) => void
): void {
  useEffect(() => {
    const update = () => {
      const panel = panelRef.current
      if (!isActive || !panel) {
        setViewShift(0, 0)
      } else if (window.innerWidth >= SIDE_PANEL_MIN_WIDTH) {
        setViewShift(panel.offsetWidth / 2, 0)
      } else {
        setViewShift(0, panel.offsetHeight / 2)
      }
    }
    update()
    window.addEventListener('resize', update)
    // The panel grows and shrinks with each question
    const observer = new ResizeObserver(update)
    if (panelRef.current) observer.observe(panelRef.current)
    return () => {
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, panelRef.current])
}
