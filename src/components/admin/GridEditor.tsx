'use client'

import { useCallback, useState, useRef } from 'react'
import type { Grid } from '@/lib/crossword/types'
import { numberGrid } from '@/lib/crossword/utils'

interface Props {
  grid: Grid
  onChange: (grid: Grid) => void
}

function applyToggleBlack(grid: Grid, r: number, c: number, symmetry: boolean): Grid {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const mr = rows - 1 - r
  const mc = cols - 1 - c
  const isMirrorSelf = mr === r && mc === c
  const newType = grid[r][c].type === 'black' ? 'white' : 'black'
  return numberGrid(
    grid.map((row, ri) =>
      row.map((cell, ci) => {
        const isPrimary = ri === r && ci === c
        const isMirror = symmetry && !isMirrorSelf && ri === mr && ci === mc
        if (!isPrimary && !isMirror) return cell
        return { ...cell, type: newType, letter: newType === 'black' ? '' : cell.letter }
      })
    )
  )
}

export default function GridEditor({ grid, onChange }: Props) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const cellSize = Math.min(Math.floor(Math.min(560 / cols, 560 / rows)), 40)
  const [symmetry, setSymmetry] = useState(true)
  const [activeCell, setActiveCell] = useState<[number, number] | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const advance = (r: number, c: number, updated: Grid): [number, number] => {
    let nr = r, nc = c + 1
    while (nr < rows) {
      if (nc >= cols) { nr++; nc = 0; continue }
      if (updated[nr][nc].type !== 'black') return [nr, nc]
      nc++
    }
    return [r, c]
  }

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!activeCell) return
      const [r, c] = activeCell

      if (e.key === ' ') {
        e.preventDefault()
        const updated = applyToggleBlack(grid, r, c, symmetry)
        onChange(updated)
        setActiveCell(advance(r, c, updated))
        return
      }

      if (e.key === 'Backspace') {
        e.preventDefault()
        if (grid[r][c].type === 'black') {
          onChange(applyToggleBlack(grid, r, c, symmetry))
        } else if (grid[r][c].letter !== '') {
          onChange(numberGrid(grid.map((row, ri) =>
            row.map((cell, ci) => ri === r && ci === c ? { ...cell, letter: '' } : cell)
          )))
        } else {
          if (c > 0) setActiveCell([r, c - 1])
          else if (r > 0) setActiveCell([r - 1, cols - 1])
        }
        return
      }

      if (e.key === 'ArrowRight') { e.preventDefault(); if (c + 1 < cols) setActiveCell([r, c + 1]); return }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); if (c > 0)        setActiveCell([r, c - 1]); return }
      if (e.key === 'ArrowDown')  { e.preventDefault(); if (r + 1 < rows) setActiveCell([r + 1, c]); return }
      if (e.key === 'ArrowUp')    { e.preventDefault(); if (r > 0)        setActiveCell([r - 1, c]); return }

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        let updated = grid
        if (updated[r][c].type === 'black') updated = applyToggleBlack(updated, r, c, symmetry)
        updated = numberGrid(updated.map((row, ri) =>
          row.map((cell, ci) => ri === r && ci === c ? { ...cell, letter: e.key.toUpperCase() } : cell)
        ))
        onChange(updated)
        setActiveCell(advance(r, c, updated))
        return
      }
    },
    [activeCell, grid, onChange, symmetry, rows, cols]
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Click a cell, then type letters or press <strong>space</strong> to make it black. Rows advance automatically when full.
        </p>
        <button
          type="button"
          onClick={() => setSymmetry(s => !s)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
            symmetry
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-gray-200 text-gray-400 hover:bg-gray-50'
          }`}
        >
          180° symmetry {symmetry ? 'on' : 'off'}
        </button>
      </div>

      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="grid border border-gray-300 w-fit outline-none"
        style={{
          gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
          gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
        }}
      >
        {grid.map((row, r) =>
          row.map((cell, c) => {
            const isBlack = cell.type === 'black'
            const isActive = activeCell?.[0] === r && activeCell?.[1] === c
            return (
              <div
                key={`${r},${c}`}
                className={`relative border border-gray-300 flex items-center justify-center cursor-pointer select-none ${
                  isBlack ? 'bg-black' : isActive ? 'bg-amber-200' : 'bg-white hover:bg-amber-50'
                }`}
                style={{
                  width: cellSize,
                  height: cellSize,
                  outline: isActive ? '2.5px solid #f59e0b' : undefined,
                  outlineOffset: '-2px',
                }}
                onClick={() => {
                  setActiveCell([r, c])
                  gridRef.current?.focus()
                }}
                onContextMenu={e => {
                  e.preventDefault()
                  onChange(applyToggleBlack(grid, r, c, symmetry))
                }}
              >
                {!isBlack && (
                  <>
                    {cell.number !== null && (
                      <span
                        className="absolute top-0 left-0.5 text-gray-500 leading-none font-medium"
                        style={{ fontSize: cellSize * 0.22 }}
                      >
                        {cell.number}
                      </span>
                    )}
                    {cell.letter && (
                      <span
                        className="font-bold text-gray-900 uppercase"
                        style={{ fontSize: cellSize * 0.5 }}
                      >
                        {cell.letter}
                      </span>
                    )}
                  </>
                )}
              </div>
            )
          })
        )}
      </div>

      <p className="text-xs text-gray-400">
        Right-click or Ctrl+click also toggles black. Arrow keys navigate. Numbers are auto-assigned by standard crossword rules.
      </p>
    </div>
  )
}
