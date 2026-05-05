'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { CrosswordPuzzle, Clue, SolverState } from '@/lib/crossword/types'
import { useCrosswordSolver } from '@/hooks/useCrosswordSolver'
import { getActiveClue, difficultyLabel, difficultyColors, formatTime } from '@/lib/crossword/utils'
import CrosswordGrid from './CrosswordGrid'
import CluePanel from './CluePanel'
import CompletionModal from './CompletionModal'
import ThemeToggle from '@/components/ThemeToggle'

interface Props {
  puzzle: CrosswordPuzzle
}

function storageKey(puzzleId: string) {
  return `crossword-progress-${puzzleId}`
}

function saveProgress(puzzleId: string, cells: SolverState['cells'], elapsed: number) {
  try {
    localStorage.setItem(storageKey(puzzleId), JSON.stringify({ cells, elapsed }))
  } catch {}
}

function loadProgress(puzzleId: string): { cells: SolverState['cells']; elapsed: number } | null {
  try {
    const raw = localStorage.getItem(storageKey(puzzleId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export default function SolverClient({ puzzle }: Props) {
  const { state, wordCellSet, setLetter, clearLetter, setActive, setDirection, move, advance, retreat, nextWord, prevWord, restore, reset, showIncorrect, fillForTest, restoreSolved } =
    useCrosswordSolver(puzzle)

  const [showModal, setShowModal] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCheck, setConfirmCheck] = useState(false)
  const [celebrationPhase, setCelebrationPhase] = useState<'idle' | 'sweep' | 'gold'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [timerVisible, setTimerVisible] = useState(true)
  const restoredRef = useRef(false)
  const restoredAsSolvedRef = useRef(false)

  // Restore saved progress on mount — useLayoutEffect runs before paint so the
  // correct elapsed/cells are in state before useEffects (including the save effect) fire.
  useLayoutEffect(() => {
    // Check for a completed solve first
    try {
      const raw = localStorage.getItem(`crossword-solved-${puzzle.id}`)
      if (raw) {
        const { elapsed: savedElapsed } = JSON.parse(raw)
        restoredAsSolvedRef.current = true
        restoreSolved()
        setElapsed(savedElapsed)
        setCelebrationPhase('gold')
        restoredRef.current = true
        return
      }
    } catch {}

    const saved = loadProgress(puzzle.id)
    if (saved) {
      restore(saved.cells, Date.now() - saved.elapsed * 1000)
      setElapsed(saved.elapsed)
    }
    restoredRef.current = true
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save progress whenever cells or elapsed change (after restore runs)
  useEffect(() => {
    if (!restoredRef.current) return
    if (state.isComplete) return
    saveProgress(puzzle.id, state.cells, elapsed)
  }, [state.cells, elapsed, state.isComplete, puzzle.id])

  // Timer — simple incrementer so there's no dependency on state.startTime reconstruction
  useEffect(() => {
    if (state.isComplete) return
    const id = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(id)
  }, [state.isComplete])

  // Celebration sequence
  useEffect(() => {
    if (!state.isComplete) return
    if (restoredAsSolvedRef.current) return
    const finalElapsed = elapsed
    setElapsed(finalElapsed)
    // Clear in-progress save and record the solve
    try { localStorage.removeItem(storageKey(puzzle.id)) } catch {}
    try { localStorage.setItem(`crossword-solved-${puzzle.id}`, JSON.stringify({ elapsed: finalElapsed })) } catch {}

    setCelebrationPhase('sweep')
    const sweepTimer = setTimeout(() => {
      setCelebrationPhase('gold')
      const modalTimer = setTimeout(() => setShowModal(true), 600)
      return () => clearTimeout(modalTimer)
    }, 2200)
    return () => clearTimeout(sweepTimer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isComplete])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const { activeRow, activeCol, direction } = state

      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        setLetter(activeRow, activeCol, e.key)
        advance()
        return
      }

      switch (e.key) {
        case 'Backspace':
          e.preventDefault()
          if (state.cells[activeRow][activeCol].userLetter) {
            clearLetter(activeRow, activeCol)
          } else {
            retreat()
            clearLetter(
              direction === 'across' ? activeRow : activeRow - 1 < 0 ? activeRow : activeRow - 1,
              direction === 'across' ? (activeCol - 1 < 0 ? activeCol : activeCol - 1) : activeCol
            )
          }
          break
        case 'ArrowRight':
          e.preventDefault()
          move(0, 1)
          break
        case 'ArrowLeft':
          e.preventDefault()
          move(0, -1)
          break
        case 'ArrowDown':
          e.preventDefault()
          move(1, 0)
          break
        case 'ArrowUp':
          e.preventDefault()
          move(-1, 0)
          break
        case 'Tab':
          e.preventDefault()
          if (e.shiftKey) {
            prevWord()
          } else {
            nextWord()
          }
          break
        case ' ':
        case 'Enter':
          e.preventDefault()
          break
      }
    },
    [state, setLetter, clearLetter, advance, retreat, nextWord, prevWord, move]
  )

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      setActive(row, col)
    },
    [setActive]
  )

  const handleAcrossClueClick = useCallback(
    (clue: Clue) => {
      if (clue.cells.length > 0) {
        const [r, c] = clue.cells[0]
        setActive(r, c)
        setDirection('across')
      }
    },
    [setActive, setDirection]
  )

  const handleDownClueClick = useCallback(
    (clue: Clue) => {
      if (clue.cells.length > 0) {
        const [r, c] = clue.cells[0]
        setActive(r, c)
        setDirection('down')
      }
    },
    [setActive, setDirection]
  )

  const activeAcrossClue = getActiveClue(puzzle.cluesAcross, state.activeRow, state.activeCol)
  const activeDownClue = getActiveClue(puzzle.cluesDown, state.activeRow, state.activeCol)

  const displayAcrossNumber = state.direction === 'across' ? activeAcrossClue?.number ?? null : null
  const displayDownNumber = state.direction === 'down' ? activeDownClue?.number ?? null : null

  const activeClue = state.direction === 'across' ? activeAcrossClue : activeDownClue


  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header — sections match the main layout widths so the title centres over the grid */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center">
        {/* Left: back button — matches aside w-40 */}
        <div className="w-40 shrink-0 px-4 py-3 hidden md:flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ← All Puzzles
          </Link>
        </div>
        {/* Back button on mobile (no panel) */}
        <div className="md:hidden px-4 py-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            ← All Puzzles
          </Link>
        </div>

        {/* Center: title + difficulty — flex-1 matches the grid column */}
        <div className="flex-1 py-3 flex flex-col items-center gap-1">
          <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight text-center font-serif">
            {puzzle.title}
          </h1>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColors[puzzle.difficulty] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
            {difficultyLabel(puzzle.difficulty)}
          </span>
        </div>

        {/* Right: timer + toggle — matches aside w-64 lg:w-72 */}
        <div className="w-64 lg:w-72 shrink-0 px-4 py-3 hidden md:flex flex-col items-end gap-1.5">
          <span className="text-xl font-mono font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {timerVisible ? formatTime(elapsed) : '--:--'}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-gray-400 dark:text-gray-500">Timer</span>
              <div
                onClick={() => setTimerVisible(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${timerVisible ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${timerVisible ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
        </div>
        {/* Timer on mobile */}
        <div className="md:hidden px-4 py-3 flex flex-col items-end gap-1.5 ml-auto">
          <span className="text-xl font-mono font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {timerVisible ? formatTime(elapsed) : '--:--'}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <label className="flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-gray-400 dark:text-gray-500">Timer</span>
              <div
                onClick={() => setTimerVisible(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${timerVisible ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${timerVisible ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>
        </div>
      </header>

      {/* Main area */}
      <main className="flex flex-1 overflow-hidden">
        {/* Left action panel */}
        <aside className="hidden md:flex flex-col w-40 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3 gap-2">
          {!confirmReset ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors text-left"
            >
              Reset Puzzle
            </button>
          ) : (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-2 space-y-2">
              <p className="text-xs text-orange-700 font-medium">Reset all answers?</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => {
                    reset()
                    setElapsed(0)
                    setConfirmReset(false)
                    setCelebrationPhase('idle')
                    restoredAsSolvedRef.current = false
                    try { localStorage.removeItem(`crossword-solved-${puzzle.id}`) } catch {}
                  }}
                  className="flex-1 text-xs py-1 rounded bg-orange-400 hover:bg-orange-500 text-white font-semibold transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 text-xs py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!confirmCheck ? (
            <button
              onClick={() => setConfirmCheck(true)}
              className="w-full text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium transition-colors text-left"
            >
              Show Incorrect
            </button>
          ) : (
            <div className="border border-orange-200 bg-orange-50 rounded-lg p-2 space-y-2">
              <p className="text-xs text-orange-700 font-medium">Highlight wrong letters?</p>
              <div className="flex gap-1.5">
                <button
                  onClick={() => { showIncorrect(); setConfirmCheck(false) }}
                  className="flex-1 text-xs py-1 rounded bg-orange-400 hover:bg-orange-500 text-white font-semibold transition-colors"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmCheck(false)}
                  className="flex-1 text-xs py-1 rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <button
            onClick={fillForTest}
            className="w-full text-sm px-3 py-2 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-400 dark:text-gray-500 font-medium transition-colors text-left"
          >
            Fill (Test)
          </button>
        </aside>

        {/* Grid column */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Scrollable grid area */}
          <div className="flex-1 flex flex-col items-center p-4 overflow-auto gap-3">
            <CrosswordGrid
              puzzle={puzzle}
              state={state}
              wordCellSet={wordCellSet}
              onCellClick={handleCellClick}
              onKeyDown={handleKeyDown}
              celebrationPhase={celebrationPhase}
            />
            {/* Error notification */}
            {state.hasErrors && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800/50 rounded-xl px-4 py-2.5 text-sm text-red-700 dark:text-red-400 font-medium">
                At least one letter is wrong. Keep trying!
              </div>
            )}
          </div>

          {/* Active clue bar — pinned below the grid, always in view */}
          <div className="px-4 pb-4 flex justify-center">
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm flex items-center gap-2 max-w-full">
              {activeClue ? (
                <>
                  <span className="font-bold text-gray-500 dark:text-gray-400 shrink-0">
                    {activeClue.number} {state.direction === 'across' ? 'Across' : 'Down'}
                  </span>
                  <span className="text-gray-800 dark:text-gray-200">{activeClue.clue}</span>
                </>
              ) : (
                <span className="text-gray-400 dark:text-gray-500 italic">Select a cell</span>
              )}
            </div>
          </div>
        </div>

        {/* Clue panels — hidden on small screens, shown on medium+ */}
        <aside className="hidden md:flex flex-col w-64 lg:w-72 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col border-b border-gray-200">
            <CluePanel
              title="Across"
              clues={puzzle.cluesAcross}
              activeClueNumber={state.direction === 'across' ? activeAcrossClue?.number ?? null : null}
              onClueClick={handleAcrossClueClick}
            />
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <CluePanel
              title="Down"
              clues={puzzle.cluesDown}
              activeClueNumber={state.direction === 'down' ? activeDownClue?.number ?? null : null}
              onClueClick={handleDownClueClick}
            />
          </div>
        </aside>
      </main>

      {/* Mobile clue panels below grid */}
      <section className="md:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="border-b border-gray-100">
          <CluePanel
            title="Across"
            clues={puzzle.cluesAcross}
            activeClueNumber={displayAcrossNumber}
            onClueClick={handleAcrossClueClick}
          />
        </div>
        <CluePanel
          title="Down"
          clues={puzzle.cluesDown}
          activeClueNumber={displayDownNumber}
          onClueClick={handleDownClueClick}
        />
      </section>

      {showModal && (
        <CompletionModal
          title={puzzle.title}
          difficulty={puzzle.difficulty}
          elapsedSeconds={elapsed}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
