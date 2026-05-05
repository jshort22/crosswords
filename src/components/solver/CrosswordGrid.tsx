'use client'

import { useRef, useEffect } from 'react'
import type { CrosswordPuzzle } from '@/lib/crossword/types'
import type { SolverState } from '@/lib/crossword/types'

interface Props {
  puzzle: CrosswordPuzzle
  state: SolverState
  wordCellSet: Set<string>
  onCellClick: (row: number, col: number) => void
  onKeyDown: (e: React.KeyboardEvent) => void
  celebrationPhase: 'idle' | 'sweep' | 'gold'
}

export default function CrosswordGrid({
  puzzle,
  state,
  wordCellSet,
  onCellClick,
  onKeyDown,
  celebrationPhase,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  const cellSize = Math.min(
    Math.floor(Math.min(
      typeof window !== 'undefined' ? (window.innerWidth - 32) / puzzle.cols : 600 / puzzle.cols,
      600 / puzzle.cols
    )),
    44
  )

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="outline-none focus:outline-none relative"
      aria-label="Crossword grid"
    >
      {/* Sweep overlay */}
      {celebrationPhase === 'sweep' && (
        <div
          className="absolute inset-0 z-10 pointer-events-none animate-sweep"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(251,191,36,0.55) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      <div
        className="grid select-none"
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${puzzle.rows}, ${cellSize}px)`,
          gap: 0,
        }}
      >
        {puzzle.grid.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r},${c}`
            const isActive = state.activeRow === r && state.activeCol === c
            const inWord = wordCellSet.has(key)
            const solverCell = state.cells[r]?.[c]

            if (cell.type === 'black') {
              return (
                <div
                  key={key}
                  className="bg-black"
                  style={{ width: cellSize, height: cellSize }}
                />
              )
            }

            const borderColor =
              celebrationPhase === 'gold'
                ? 'border-amber-400'
                : 'border-gray-400'

            const bgColor = isActive
              ? 'bg-amber-300'
              : inWord
              ? 'bg-sky-100'
              : 'bg-white'

            return (
              <div
                key={key}
                onClick={() => onCellClick(r, c)}
                className={`relative border cursor-pointer flex items-center justify-center transition-colors duration-300 ${bgColor} ${borderColor}`}
                style={{ width: cellSize, height: cellSize, fontSize: cellSize * 0.52 }}
              >
                {cell.number !== null && (
                  <span
                    className="absolute top-0 left-0.5 text-gray-700 font-medium leading-none"
                    style={{ fontSize: cellSize * 0.22 }}
                  >
                    {cell.number}
                  </span>
                )}
                <span
                  className={`font-bold leading-none select-none ${
                    solverCell?.isCorrect === false
                      ? 'text-red-600'
                      : solverCell?.userLetter
                      ? 'text-gray-900'
                      : ''
                  }`}
                >
                  {solverCell?.userLetter ?? ''}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
