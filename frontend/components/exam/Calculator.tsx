'use client'

import { useCallback, useEffect, useState } from 'react'

const BUTTONS = [
  'C', '⌫', '(', ')', '÷',
  '7', '8', '9', '×', '√',
  '4', '5', '6', '−', 'x²',
  '1', '2', '3', '+', '^',
  '±', '0', '.', '=',
]

const KEY_MAP: Record<string, string> = {
  '*': '×', 'x': '×', '/': '÷', '-': '−', Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', Delete: 'C',
}

/**
 * Evaluates an arithmetic expression with + − × ÷ ^ √ and parentheses.
 * Returns null if the expression is incomplete or invalid.
 */
export function evaluate(expression: string): number | null {
  const tokens = expression.match(/\d+\.?\d*|\.\d+|[+−×÷^√()]/g) || []
  if (tokens.join('') !== expression) return null
  let position = 0
  const peek = () => tokens[position]
  const next = () => tokens[position++]

  const parseSum = (): number => {
    let value = parseProduct()
    while (peek() === '+' || peek() === '−') {
      value = next() === '+' ? value + parseProduct() : value - parseProduct()
    }
    return value
  }
  const parseProduct = (): number => {
    let value = parseUnary()
    while (peek() === '×' || peek() === '÷') {
      value = next() === '×' ? value * parseUnary() : value / parseUnary()
    }
    return value
  }
  // Unary minus binds looser than ^, so −3^2 is −9
  const parseUnary = (): number => {
    if (peek() === '−') {
      next()
      return -parseUnary()
    }
    return parsePower()
  }
  const parsePower = (): number => {
    const base = parseAtom()
    if (peek() === '^') {
      next()
      return Math.pow(base, parseUnary())
    }
    return base
  }
  const parseAtom = (): number => {
    const token = next()
    if (token === '√') return Math.sqrt(parseAtom())
    if (token === '(') {
      const value = parseSum()
      if (next() !== ')') throw new Error('Unclosed parenthesis')
      return value
    }
    if (token === undefined || !/^[\d.]/.test(token)) throw new Error('Expected a number')
    return parseFloat(token)
  }

  try {
    const value = parseSum()
    return position === tokens.length && Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function formatResult(value: number): string {
  return String(parseFloat(value.toPrecision(10)))
}

interface CalculatorProps {
  // Also accept typed digits and operators
  keyboard?: boolean
  onClose: () => void
}

/**
 * On-screen calculator for math questions, like the ones the SAT and GRE provide
 */
export function Calculator({ keyboard = false, onClose }: CalculatorProps) {
  const [expression, setExpression] = useState('')
  const [error, setError] = useState(false)

  const press = useCallback((button: string) => {
    setError(false)
    setExpression((current) => {
      switch (button) {
        case 'C':
          return ''
        case '⌫':
          return current.slice(0, -1)
        case 'x²':
          return current + '^2'
        case '±':
          return current.startsWith('−(') && current.endsWith(')') ? current.slice(2, -1) : current ? `−(${current})` : '−'
        case '=': {
          if (!current) return current
          const value = evaluate(current)
          if (value === null) {
            setError(true)
            return current
          }
          return formatResult(value).replace('-', '−')
        }
        default:
          return current + button
      }
    })
  }, [])

  useEffect(() => {
    if (!keyboard) return
    const handleKeyDown = (e: KeyboardEvent) => {
      const button = KEY_MAP[e.key] || e.key
      if (BUTTONS.includes(button) && button !== 'C' || e.key === 'Escape' || e.key === 'Delete') {
        e.preventDefault()
        press(button)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [keyboard, press])

  const preview = expression ? evaluate(expression) : null

  return (
    <div className="w-64 bg-gray-950/95 backdrop-blur-md rounded-2xl border border-white/15 text-white shadow-2xl p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold tracking-wide text-gray-300">CALCULATOR</span>
        <button onClick={onClose} aria-label="Close calculator" className="text-gray-300 hover:text-white text-sm px-1">
          ✕
        </button>
      </div>
      <div className={`rounded-lg bg-black/60 px-3 py-2 mb-2 text-right border ${error ? 'border-red-500' : 'border-transparent'}`}>
        <div className="text-xl font-mono tabular-nums min-h-[28px] break-all">{expression || '0'}</div>
        <div className="text-xs font-mono text-gray-300 min-h-[16px]">
          {error ? 'Check the expression' : preview !== null ? `= ${formatResult(preview)}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {BUTTONS.map((button) => (
          <button
            key={button}
            onClick={() => press(button)}
            className={`h-9 rounded-lg text-sm font-bold active:scale-95 ${
              button === '=' ? 'col-span-2 bg-blue-600 hover:bg-blue-500' : /\d|\./.test(button) ? 'bg-white/15 hover:bg-white/25' : 'bg-white/5 hover:bg-white/15 text-sky-300'
            }`}
          >
            {button}
          </button>
        ))}
      </div>
    </div>
  )
}
