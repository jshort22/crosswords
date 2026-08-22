'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { CrosswordPuzzle, Clue, SolverState, Direction } from '@/lib/crossword/types'
import { useCrosswordSolver } from '@/hooks/useCrosswordSolver'
import { getActiveClue, firstUnfilledCell, formatTime, prevCellForBackspace } from '@/lib/crossword/utils'
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

/**
 * A saved record is restored wholesale into `state.cells`, and several reducer
 * cases (CHECK_COMPLETE, SHOW_INCORRECT, RESTORE_SOLVED) walk `state.cells`
 * while indexing `puzzle.grid` at the same coordinates. So a record whose shape
 * no longer matches the grid does not merely show stale letters — it throws on
 * render, and because the bad record stays in localStorage, EVERY reload throws
 * too. The page is dead for that visitor until they clear site data.
 *
 * Editing a published puzzle's grid in admin is enough to produce one, so this
 * validates before restoring and drops anything that doesn't fit. A record for a
 * different grid is worthless anyway; keeping it only re-triggers the crash.
 */
function loadProgress(
  puzzleId: string,
  rows: number,
  cols: number
): { cells: SolverState['cells']; elapsed: number } | null {
  try {
    const raw = localStorage.getItem(storageKey(puzzleId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const cells = parsed?.cells
    const fits =
      Array.isArray(cells) &&
      cells.length === rows &&
      cells.every(
        (row: unknown) =>
          Array.isArray(row) &&
          row.length === cols &&
          row.every(cell => cell && typeof cell.userLetter === 'string')
      )
    if (!fits) {
      localStorage.removeItem(storageKey(puzzleId))
      return null
    }
    const elapsed =
      typeof parsed.elapsed === 'number' && Number.isFinite(parsed.elapsed) && parsed.elapsed >= 0
        ? parsed.elapsed
        : 0
    return { cells, elapsed }
  } catch {
    return null
  }
}

export default function SolverClient({ puzzle }: Props) {
  const { state, wordCells, wordCellSet, setLetter, clearLetter, setActive, setDirection, toggleDirection, move, advance, retreat, nextWord, prevWord, restore, reset, showIncorrect, restoreSolved } =
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

    const saved = loadProgress(puzzle.id, puzzle.rows, puzzle.cols)
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
      // Whether auto-advance should skip filled cells depends on the word as it
      // was BEFORE this keystroke, which only this side can still see: once the
      // letter is written, "just completed" and "being retyped" look identical
      // to the reducer.
      const wordWasComplete = wordCells.every(([r, c]) => state.cells[r][c].userLetter !== '')
      setLetter(state.activeRow, state.activeCol, letter)
      advance(!wordWasComplete)
    },
    [state.isComplete, state.activeRow, state.activeCol, state.cells, wordCells, setLetter, advance]
  )

  const inputBackspace = useCallback(() => {
    if (state.isComplete) return
    const { activeRow, activeCol, direction } = state
    if (state.cells[activeRow][activeCol].userLetter) {
      clearLetter(activeRow, activeCol)
    } else {
      // Both the cursor move and the clear must agree on the target. Deriving
      // it from prevCellForBackspace (the same helper RETREAT uses) keeps them
      // in step; hand-rolled -1 arithmetic here only guarded the array bound,
      // not the black-square boundary, so at a word's first cell it cleared the
      // preceding BLACK cell's record while the cursor correctly stayed put.
      const [prevRow, prevCol] = prevCellForBackspace(puzzle, activeRow, activeCol, direction)
      retreat()
      clearLetter(prevRow, prevCol)
    }
  }, [state, clearLetter, retreat, puzzle])

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
        const [r, c] = firstUnfilledCell(clue, state.cells)
        setActive(r, c)
        setDirection('across')
      }
    },
    [state.cells, setActive, setDirection]
  )

  const handleDownClueClick = useCallback(
    (clue: Clue) => {
      if (clue.cells.length > 0) {
        const [r, c] = firstUnfilledCell(clue, state.cells)
        setActive(r, c)
        setDirection('down')
      }
    },
    [state.cells, setActive, setDirection]
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
      // Skip answers that are already complete, matching Tab/NEXT_WORD. Falls
      // back to the immediate neighbour when nothing is left to fill, so the
      // arrows still move on a finished grid.
      const at = (k: number) => seq[((k % seq.length) + seq.length) % seq.length]
      let next = at(i + delta)
      for (let k = 1; k <= seq.length; k++) {
        const candidate = at(i + delta * k)
        if (candidate.clue.cells.some(([r, c]) => !state.cells[r]?.[c]?.userLetter)) {
          next = candidate
          break
        }
      }
      // setActive BEFORE setDirection: SET_ACTIVE toggles direction when the
      // target cell equals the current one, which is reachable at the
      // Across/Down boundary. Setting direction after makes it deterministic.
      const [r, c] = firstUnfilledCell(next.clue, state.cells)
      setActive(r, c)
      setDirection(next.dir)
    },
    [puzzle.cluesAcross, puzzle.cluesDown, state.direction, state.cells, activeClue, setActive, setDirection]
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
      <header className="shrink-0 bg-surface border-b border-line flex items-center pt-[env(safe-area-inset-top)]">
        {/* Left: back button. w-40 on desktop matches the aside so the title
            centres over the grid; auto width on mobile. */}
        <div className="md:w-40 shrink-0 px-3 py-2 md:px-4 md:py-3 flex items-center">
          {/* aria-label is load-bearing on mobile: the visible label is
              `hidden md:inline` and the arrow is aria-hidden, so without it the
              link has NO accessible name on a phone (WCAG 2.4.4 / 4.1.2). */}
          <Link
            href="/"
            aria-label="All puzzles"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-sunken text-xs md:text-[13px] font-medium text-ink-soft hover:text-ink transition-colors whitespace-nowrap"
          >
            <span aria-hidden>←</span>
            <span className="hidden md:inline">All Puzzles</span>
          </Link>
        </div>

        {/* Center: title — flex-1 matches the grid column. The difficulty badge
            used to sit under the title; it's on the puzzle card where you pick a
            puzzle, and once you're solving it tells you nothing you can act on.
            Dropping it also gives the grid back the height it was using. */}
        <div className="flex-1 min-w-0 py-2 md:py-3 flex flex-col items-center justify-center">
          <h1 className="font-display text-sm md:text-lg font-semibold tracking-[-0.02em] text-ink leading-tight text-center truncate max-w-full px-1">
            {puzzle.title}
          </h1>
        </div>

        {/* Right: timer + theme + (mobile) actions menu. w-64/72 on desktop
            mirrors the clue aside so the title stays centred over the grid. */}
        <div className="md:w-64 lg:w-72 shrink-0 px-3 py-2 md:px-4 md:py-3 flex items-center md:flex-col md:items-end gap-2 md:gap-1.5 ml-auto">
          {/* Fixed width, right-aligned. DM Sans does NOT ship tabular figures —
              `tabular-nums` is declared but has no effect ("1111" measures 20px
              against 39px for "8888"), so the timer's width changed on almost
              every tick. On mobile the header's right block has no fixed width,
              so that resize pushed the flex-1 centre column and the title
              visibly drifted: 10 distinct title positions over 11 seconds.
              Reserving the width is what actually holds the layout still; the
              tabular-nums stays in case the face ever gains the feature. */}
          <span
            data-timer=""
            className="w-16 md:w-[4.5rem] shrink-0 text-right text-base md:text-xl font-semibold tabular-nums text-ink"
          >
            {timerVisible ? formatTime(elapsed) : '--:--'}
          </span>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <label className="hidden md:flex items-center gap-1.5 cursor-pointer">
              <span className="text-xs text-ink-soft">Timer</span>
              <div
                onClick={() => setTimerVisible(v => !v)}
                className={`relative w-8 h-4 rounded-full transition-colors ${timerVisible ? 'bg-accent' : 'bg-line'}`}
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
                className="md:hidden w-9 h-9 flex items-center justify-center rounded-full text-lg bg-sunken text-ink-soft transition-colors"
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
            role="dialog"
            aria-label="Puzzle options"
            className="absolute right-2 top-2 w-56 rounded-[20px] bg-surface p-2.5 shadow-float flex flex-col gap-2 mt-[env(safe-area-inset-top)]"
            onClick={e => e.stopPropagation()}
          >
            <SolverActions
              variant="menu"
              timerVisible={timerVisible}
              onToggleTimer={() => setTimerVisible(v => !v)}
              onReset={() => { handleReset(); setMenuOpen(false) }}
              onShowIncorrect={() => { showIncorrect(); setMenuOpen(false) }}
              onOpenClueList={() => { setSheetOpen(true); setMenuOpen(false) }}
            />
          </div>
        </div>
      )}

      {/* Main area */}
      <main className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left action panel */}
        <aside aria-label="Puzzle actions" className="hidden md:flex flex-col w-40 border-r border-line bg-sunken p-3 gap-2">
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
              <div className="bg-danger-soft rounded-full px-4 py-2.5 text-sm text-danger font-medium">
                At least one letter is wrong. Keep trying!
              </div>
            )}
          </div>

          {/* Active clue bar — pinned below the grid, always in view */}
          <div className="hidden md:flex px-4 pb-4 justify-center">
            <div className="bg-surface shadow-key rounded-full px-4 py-2.5 text-sm flex items-center gap-2 max-w-full">
              {activeClue ? (
                <>
                  <span className="font-bold text-ink-soft shrink-0">
                    {activeClue.number} {state.direction === 'across' ? 'Across' : 'Down'}
                  </span>
                  <span className="text-ink">{activeClue.clue}</span>
                </>
              ) : (
                <span className="text-ink-soft italic">Select a cell</span>
              )}
            </div>
          </div>
        </div>

        {/* Clue panels — hidden on small screens, shown on medium+ */}
        <aside aria-label="Clues" className="hidden md:flex flex-col w-64 lg:w-72 border-l border-line bg-surface overflow-hidden">
          <div className="flex-1 overflow-hidden flex flex-col border-b border-line">
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
        // A labelled <section> is a `region` landmark, which is what puts the
        // clue bar and keyboard inside one — they sit outside <main> so they
        // pin to the bottom of the shell, which otherwise leaves them
        // landmark-less. `contents` keeps them direct flex children of the
        // shell, so the measured layout (76px bar, 342px grid) is untouched.
        <section aria-label="Clue and keyboard" className="contents">
          <ClueBar
            clue={activeClue ?? null}
            direction={state.direction}
            onPrev={() => goClue(-1)}
            onNext={() => goClue(1)}
            onToggleDirection={toggleDirection}
          />
          <OnScreenKeyboard
            onLetter={inputLetter}
            onDelete={inputBackspace}
            disabled={state.isComplete}
          />
        </section>
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
