'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { CrosswordPuzzle, Clue, SolverState, Direction } from '@/lib/crossword/types'
import { useCrosswordSolver } from '@/hooks/useCrosswordSolver'
import { getActiveClue, difficultyLabel, difficultyColors, formatTime } from '@/lib/crossword/utils'
import CrosswordGrid from './CrosswordGrid'
import CluePanel from './CluePanel'
import CompletionModal from './CompletionModal'
import SolverActions from './SolverActions'
import ClueBar from './ClueBar'
import ClueSheet from './ClueSheet'
import OnScreenKeyboard from './OnScreenKeyboard'
import ThemeToggle from '@/components/ThemeToggle'
import { useIsMobile } from '@/hooks/useIsMobile'

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
  const { state, wordCellSet, setLetter, clearLetter, setActive, setDirection, move, advance, retreat, nextWord, prevWord, restore, reset, showIncorrect, restoreSolved } =
    useCrosswordSolver(puzzle)

  const [showModal, setShowModal] = useState(false)
  const [celebrationPhase, setCelebrationPhase] = useState<'idle' | 'sweep' | 'gold'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [timerVisible, setTimerVisible] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()
  // State, not a ref: it batches with the restore dispatches below, so the first
  // render where hasRestored is true already has the restored cells/elapsed. A ref
  // would flip synchronously and let the save effect fire against empty state.
  const [hasRestored, setHasRestored] = useState(false)
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
        setHasRestored(true)
        return
      }
    } catch {}

    const saved = loadProgress(puzzle.id)
    if (saved) {
      restore(saved.cells, Date.now() - saved.elapsed * 1000)
      setElapsed(saved.elapsed)
    }
    setHasRestored(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save progress whenever cells or elapsed change (after restore runs)
  useEffect(() => {
    if (!hasRestored) return
    if (state.isComplete) return
    saveProgress(puzzle.id, state.cells, elapsed)
  }, [hasRestored, state.cells, elapsed, state.isComplete, puzzle.id])

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

    setSheetOpen(false)
    setCelebrationPhase('sweep')
    let modalTimer: ReturnType<typeof setTimeout> | undefined
    const sweepTimer = setTimeout(() => {
      setCelebrationPhase('gold')
      modalTimer = setTimeout(() => setShowModal(true), 600)
    }, 2200)
    return () => {
      clearTimeout(sweepTimer)
      clearTimeout(modalTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isComplete])

  // Input is extracted from handleKeyDown so the physical keyboard and the
  // on-screen keyboard reach the SAME implementation. Forking these would fork
  // the isComplete guard, and the day one side changed, a solved gold grid
  // would become editable on the other.

  const inputLetter = useCallback(
    (letter: string) => {
      // A completed grid is read-only. CHECK_COMPLETE stops re-evaluating once
      // isComplete is set, so an edit here would leave a wrong letter sitting in
      // a still-gold "solved" grid.
      if (state.isComplete) return
      setLetter(state.activeRow, state.activeCol, letter)
      advance()
    },
    [state.isComplete, state.activeRow, state.activeCol, setLetter, advance]
  )

  const inputBackspace = useCallback(() => {
    if (state.isComplete) return
    const { activeRow, activeCol, direction } = state
    if (state.cells[activeRow][activeCol].userLetter) {
      clearLetter(activeRow, activeCol)
    } else {
      retreat()
      clearLetter(
        direction === 'across' ? activeRow : activeRow - 1 < 0 ? activeRow : activeRow - 1,
        direction === 'across' ? (activeCol - 1 < 0 ? activeCol : activeCol - 1) : activeCol
      )
    }
  }, [state, clearLetter, retreat])

  // Kept in SolverClient rather than pushed into SolverActions: this exact
  // cluster is what 4b1c6e3 fixed, and it depends on state owned here.
  const handleReset = useCallback(() => {
    reset()
    setElapsed(0)
    setCelebrationPhase('idle')
    restoredAsSolvedRef.current = false
    try { localStorage.removeItem(`crossword-solved-${puzzle.id}`) } catch {}
  }, [reset, puzzle.id])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault()
        inputLetter(e.key)
        return
      }

      switch (e.key) {
        case 'Backspace':
          e.preventDefault()
          inputBackspace()
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
    [inputLetter, inputBackspace, nextWord, prevWord, move]
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

  const activeClue = state.direction === 'across' ? activeAcrossClue : activeDownClue

  // The clue bar's arrows walk ONE continuous Across-then-Down sequence, the way
  // NYT does, flipping direction at the boundary. That is deliberately not
  // nextWord/prevWord: those are direction-scoped and wrap within a single list,
  // which is right for desktop Tab but would trap you in Across on mobile.
  const goClue = useCallback(
    (delta: 1 | -1) => {
      const seq = [
        ...puzzle.cluesAcross.map(c => ({ clue: c, dir: 'across' as Direction })),
        ...puzzle.cluesDown.map(c => ({ clue: c, dir: 'down' as Direction })),
      ]
      const i = seq.findIndex(e => e.dir === state.direction && e.clue.number === activeClue?.number)
      if (i === -1) return
      const next = seq[(i + delta + seq.length) % seq.length]
      // setActive BEFORE setDirection: SET_ACTIVE toggles direction when the
      // target cell equals the current one, which is reachable at the
      // Across/Down boundary. Setting direction after makes it deterministic.
      setActive(next.clue.cells[0][0], next.clue.cells[0][1])
      setDirection(next.dir)
    },
    [puzzle.cluesAcross, puzzle.cluesDown, state.direction, activeClue, setActive, setDirection]
  )

  const handleSheetAcrossClick = useCallback(
    (clue: Clue) => {
      handleAcrossClueClick(clue)
      setSheetOpen(false)
    },
    [handleAcrossClueClick]
  )

  const handleSheetDownClick = useCallback(
    (clue: Clue) => {
      handleDownClueClick(clue)
      setSheetOpen(false)
    },
    [handleDownClueClick]
  )


  return (
    <div className="h-svh flex flex-col overflow-hidden overscroll-none pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
      {/* Header — sections match the main layout widths so the title centres over the grid */}
      <header className="shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center pt-[env(safe-area-inset-top)]">
        {/* Left: back button. w-40 on desktop matches the aside so the title
            centres over the grid; auto width on mobile. */}
        <div className="md:w-40 shrink-0 px-3 py-2 md:px-4 md:py-3 flex items-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors whitespace-nowrap"
          >
            <span aria-hidden>←</span>
            <span className="hidden md:inline">All Puzzles</span>
          </Link>
        </div>

        {/* Center: title + difficulty — flex-1 matches the grid column */}
        <div className="flex-1 min-w-0 py-2 md:py-3 flex flex-col items-center gap-0.5 md:gap-1">
          <h1 className="text-sm md:text-base font-bold text-gray-900 dark:text-white leading-tight text-center font-serif truncate max-w-full px-1">
            {puzzle.title}
          </h1>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${difficultyColors[puzzle.difficulty] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'}`}>
            {difficultyLabel(puzzle.difficulty)}
          </span>
        </div>

        {/* Right: timer + theme + (mobile) actions menu. w-64/72 on desktop
            mirrors the clue aside so the title stays centred over the grid. */}
        <div className="md:w-64 lg:w-72 shrink-0 px-3 py-2 md:px-4 md:py-3 flex items-center md:flex-col md:items-end gap-2 md:gap-1.5 ml-auto">
          <span className="text-base md:text-xl font-mono font-semibold tabular-nums text-gray-700 dark:text-gray-200">
            {timerVisible ? formatTime(elapsed) : '--:--'}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <label className="hidden md:flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-gray-400 dark:text-gray-500">Timer</span>
              <div
                onClick={() => setTimerVisible(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${timerVisible ? 'bg-amber-400' : 'bg-gray-200 dark:bg-gray-600'}`}
              >
                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${timerVisible ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </label>
            {isMobile && (
              <button
                type="button"
                onClick={() => setMenuOpen(o => !o)}
                aria-label="Puzzle actions"
                aria-expanded={menuOpen}
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-lg text-gray-600 dark:text-gray-300 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
              >
                ⋯
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile actions popover. A transparent full-screen backdrop handles
          dismissal rather than a document listener — those interact badly with
          touch on iOS. */}
      {isMobile && menuOpen && (
        <div className="md:hidden fixed inset-0 z-30" onClick={() => setMenuOpen(false)}>
          <div
            className="absolute right-2 top-2 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-2 shadow-xl flex flex-col gap-2 mt-[env(safe-area-inset-top)]"
            onClick={e => e.stopPropagation()}
          >
            <SolverActions
              variant="menu"
              onReset={() => { handleReset(); setMenuOpen(false) }}
              onShowIncorrect={() => { showIncorrect(); setMenuOpen(false) }}
            />
          </div>
        </div>
      )}

      {/* Main area */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left action panel */}
        <aside className="hidden md:flex flex-col w-40 border-r border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 p-3 gap-2">
          <SolverActions variant="sidebar" onReset={handleReset} onShowIncorrect={showIncorrect} />
        </aside>

        {/* Grid column */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Scrollable grid area */}
          {/* min-h-0 lets this flex child shrink below its content size. container-type
              size makes its dimensions queryable so the grid can size against BOTH
              axes (see CrosswordGrid). No overflow-auto: the grid always fits. */}
          <div
            className="flex-1 min-h-0 flex flex-col items-center justify-center p-2 gap-2 overflow-hidden"
            style={{ containerType: 'size' }}
          >
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
          <div className="hidden md:flex px-4 pb-4 justify-center">
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

      {/* Mobile: clue bar + keyboard live outside <main> so they pin to the bottom
          of the shell and the grid gets whatever height is left. Gated on JS so
          their handlers never mount on desktop; the md:hidden inside each also
          covers the first frame before useSyncExternalStore resolves. */}
      {isMobile && (
        <>
          <ClueBar
            clue={activeClue ?? null}
            direction={state.direction}
            onPrev={() => goClue(-1)}
            onNext={() => goClue(1)}
            onOpenList={() => setSheetOpen(true)}
          />
          <OnScreenKeyboard
            onLetter={inputLetter}
            onDelete={inputBackspace}
            disabled={state.isComplete}
          />
        </>
      )}

      {isMobile && sheetOpen && (
        <ClueSheet
          cluesAcross={puzzle.cluesAcross}
          cluesDown={puzzle.cluesDown}
          activeAcrossNumber={state.direction === 'across' ? activeAcrossClue?.number ?? null : null}
          activeDownNumber={state.direction === 'down' ? activeDownClue?.number ?? null : null}
          onAcrossClick={handleSheetAcrossClick}
          onDownClick={handleSheetDownClick}
          onClose={() => setSheetOpen(false)}
        />
      )}

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
