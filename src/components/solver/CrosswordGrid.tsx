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

// Cell size is pure CSS: the wrapper carries the puzzle's aspect ratio and the
// tracks are 1fr, so the grid fills whatever space it's given and stays square.
// Previously this read window.innerWidth during render, which produced a real
// hydration mismatch (server 40px vs client 23px on a phone) and never responded
// to rotation. There is deliberately no resize listener here — there is nothing
// left to recompute.
const MAX_CELL_PX = 44

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

  // Cell borders are drawn as gaps over the container background rather than
  // per-cell borders: 1fr tracks land on fractional pixels, and per-cell borders
  // render hairline-uneven at those sizes. The gold celebration recolours this
  // background, which is why the borderColor prop moved up here.
  const celebrating = celebrationPhase === 'gold'

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="touch-target relative outline-none focus:outline-none"
      style={{
        // Fit inside BOTH axes of the parent. `width:100%` + `max-height:100%`
        // is not enough: max-height clamps the height without recomputing the
        // width, so a 21x21 on a short-and-wide desktop viewport came out with
        // non-square cells. Resolving the width against the parent's height
        // (100cqh, from its container-type:size) constrains both axes in one
        // expression, with the third term preserving the old 44px cell cap.
        width: `min(100cqw, calc(100cqh * ${puzzle.cols} / ${puzzle.rows}), ${puzzle.cols * MAX_CELL_PX}px)`,
        // `relative`, `aspectRatio` and `containerType` must stay on the SAME
        // element: the sweep overlay below is inset-0 against it, and the cqw
        // font sizes resolve against it.
        aspectRatio: `${puzzle.cols} / ${puzzle.rows}`,
        containerType: 'inline-size',
        ['--cols' as string]: puzzle.cols,
      }}
      aria-label="Crossword grid"
    >
      {/* Sweep overlay */}
      {celebrationPhase === 'sweep' && (
        <div
          className="absolute inset-0 z-10 pointer-events-none animate-sweep"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, var(--gold-sweep) 50%, transparent 100%)',
            backgroundSize: '200% 100%',
          }}
        />
      )}

      {/* data-grid / data-cell / data-active / data-wrong / data-celebrating are
          TEST HOOKS. The e2e harnesses used to select on Tailwind colour classes
          (.bg-amber-300 for the cursor, .bg-black for a block, .bg-amber-400 for
          the celebration), which meant a restyle silently broke every one of
          them. Keep these attributes stable even if the palette changes again. */}
      <div
        data-grid=""
        data-celebrating={celebrating ? '' : undefined}
        // Deliberately SQUARE, in a design that rounds everything else. Rounding
        // this container needs overflow-hidden to clip the corner, which clipped
        // 1-Across's number right off the first cell; and rounding the cells
        // themselves left a visible pinhole of line colour at every four-way
        // intersection. A crossword grid is a grid — the softness lives in the
        // cards, buttons, sheet and keys instead.
        className={`grid select-none h-full w-full gap-px p-px transition-colors duration-300 ${
          celebrating ? 'bg-gold' : 'bg-cell-line'
        }`}
        style={{
          gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${puzzle.rows}, minmax(0, 1fr))`,
        }}
      >
        {puzzle.grid.map((row, r) =>
          row.map((cell, c) => {
            const key = `${r},${c}`
            const isActive = state.activeRow === r && state.activeCol === c
            const inWord = wordCellSet.has(key)
            const solverCell = state.cells[r]?.[c]

            if (cell.type === 'black') {
              // Swallow taps so a mis-hit on a black square doesn't feel dead
              // and doesn't fall through to anything behind the grid.
              return (
                <div
                  key={key}
                  data-cell="black"
                  className="bg-cell-black"
                  onPointerDown={e => e.preventDefault()}
                />
              )
            }

            const bgColor = isActive
              ? 'bg-cell-active'
              : inWord
              ? 'bg-cell-word'
              : 'bg-cell'

            return (
              <div
                key={key}
                data-cell="white"
                data-active={isActive ? '' : undefined}
                data-in-word={inWord ? '' : undefined}
                onPointerDown={e => {
                  // preventDefault avoids the synthesised mouse sequence and the
                  // text-selection/scroll behaviour that comes with it on touch.
                  // But it ALSO suppresses the browser's default focus move to
                  // the nearest focusable ancestor, which is how this container
                  // used to regain focus after a click on a sidebar button — so
                  // refocus explicitly, or physical-keyboard input silently dies
                  // once anything else has been clicked.
                  e.preventDefault()
                  containerRef.current?.focus()
                  onCellClick(r, c)
                }}
                className={`relative cursor-pointer flex items-center justify-center transition-colors duration-300 ${bgColor}`}
              >
                {cell.number !== null && (
                  <span
                    className={`absolute top-0 left-[6%] font-medium leading-none ${
                      isActive ? 'text-cell-active-ink' : 'text-cell-num'
                    }`}
                    style={{ fontSize: 'calc(22cqw / var(--cols))' }}
                  >
                    {cell.number}
                  </span>
                )}
                <span
                  data-wrong={solverCell?.isCorrect === false ? '' : undefined}
                  className={`font-semibold leading-none select-none ${
                    solverCell?.isCorrect === false
                      ? 'text-danger'
                      : isActive
                      ? 'text-cell-active-ink'
                      : 'text-ink'
                  }`}
                  style={{ fontSize: 'calc(52cqw / var(--cols))' }}
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
