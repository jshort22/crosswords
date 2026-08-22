import type { Grid, GridCell, Clue, CrosswordPuzzle, SolverCell } from './types'
import type { PuzzleRow } from '@/lib/supabase/types'

/** Returns true if the cell at [r,c] should start an across word. */
export function startsAcross(grid: Grid, r: number, c: number): boolean {
  const cell = grid[r][c]
  if (cell.type === 'black') return false
  const leftEmpty = c === 0 || grid[r][c - 1].type === 'black'
  const rightFilled = c < grid[r].length - 1 && grid[r][c + 1].type === 'white'
  return leftEmpty && rightFilled
}

/** Returns true if the cell at [r,c] should start a down word. */
export function startsDown(grid: Grid, r: number, c: number): boolean {
  const cell = grid[r][c]
  if (cell.type === 'black') return false
  const topEmpty = r === 0 || grid[r - 1][c].type === 'black'
  const bottomFilled = r < grid.length - 1 && grid[r + 1][c].type === 'white'
  return topEmpty && bottomFilled
}

/** Assigns clue numbers to the grid in place and returns numbered cells. */
export function numberGrid(grid: Grid): Grid {
  const numbered = grid.map(row => row.map(cell => ({ ...cell, number: null as number | null })))
  let n = 1
  for (let r = 0; r < numbered.length; r++) {
    for (let c = 0; c < numbered[r].length; c++) {
      if (startsAcross(numbered, r, c) || startsDown(numbered, r, c)) {
        numbered[r][c].number = n++
      }
    }
  }
  return numbered
}

/** Builds Clue objects from a numbered grid. */
export function buildClues(
  grid: Grid,
  clueDictAcross: Record<number, string>,
  clueDictDown: Record<number, string>
): { across: Clue[]; down: Clue[] } {
  const across: Clue[] = []
  const down: Clue[] = []

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      if (!cell.number) continue

      if (startsAcross(grid, r, c)) {
        const cells: [number, number][] = []
        let cc = c
        while (cc < grid[r].length && grid[r][cc].type === 'white') {
          cells.push([r, cc])
          cc++
        }
        across.push({
          number: cell.number,
          clue: clueDictAcross[cell.number] ?? '',
          answer: cells.map(([rr, cc2]) => grid[rr][cc2].letter).join(''),
          cells,
        })
      }

      if (startsDown(grid, r, c)) {
        const cells: [number, number][] = []
        let rr = r
        while (rr < grid.length && grid[rr][c].type === 'white') {
          cells.push([rr, c])
          rr++
        }
        down.push({
          number: cell.number,
          clue: clueDictDown[cell.number] ?? '',
          answer: cells.map(([rr2, cc2]) => grid[rr2][cc2].letter).join(''),
          cells,
        })
      }
    }
  }

  return { across, down }
}

/** Creates an empty grid of given dimensions. */
export function createEmptyGrid(rows: number, cols: number): Grid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, (): GridCell => ({
      type: 'white',
      letter: '',
      number: null,
    }))
  )
}

/** Serialize Grid to JSON-safe format for Supabase storage. */
export function serializeGrid(grid: Grid): unknown {
  return grid.map(row =>
    row.map(cell => ({
      t: cell.type === 'black' ? 'b' : 'w',
      l: cell.letter,
      n: cell.number,
    }))
  )
}

/** Deserialize grid from Supabase JSON. */
export function deserializeGrid(raw: unknown): Grid {
  const rows = raw as Array<Array<{ t: string; l: string; n: number | null }>>
  return rows.map(row =>
    row.map(cell => ({
      type: cell.t === 'b' ? 'black' : 'white',
      letter: cell.l ?? '',
      number: cell.n ?? null,
    }))
  )
}

/** Serialize clues map to JSON. */
export function serializeClueDict(clues: Record<number, string>): unknown {
  return clues
}

export function deserializeClueDict(raw: unknown): Record<number, string> {
  return raw as Record<number, string>
}

/** Convert a Supabase puzzle row to a CrosswordPuzzle. */
export function rowToPuzzle(row: PuzzleRow): CrosswordPuzzle {
  const grid = deserializeGrid(row.grid)
  const clueDictAcross = deserializeClueDict(row.clues_across)
  const clueDictDown = deserializeClueDict(row.clues_down)
  const { across, down } = buildClues(grid, clueDictAcross, clueDictDown)

  return {
    id: row.id,
    title: row.title,
    author: row.author,
    difficulty: row.difficulty,
    rows: row.grid_size_rows,
    cols: row.grid_size_cols,
    grid,
    cluesAcross: across,
    cluesDown: down,
    sourceFileUrl: row.source_file_url,
    isPublished: row.is_published,
    createdAt: row.created_at,
  }
}

/** Given a cell position and direction, return all cells in that word. */
export function getWordCells(
  grid: Grid,
  row: number,
  col: number,
  direction: 'across' | 'down'
): [number, number][] {
  const cells: [number, number][] = []
  if (direction === 'across') {
    let c = col
    while (c >= 0 && grid[row][c].type === 'white') c--
    c++
    while (c < grid[row].length && grid[row][c].type === 'white') {
      cells.push([row, c])
      c++
    }
  } else {
    let r = row
    while (r >= 0 && grid[r][col].type === 'white') r--
    r++
    while (r < grid.length && grid[r][col].type === 'white') {
      cells.push([r, col])
      r++
    }
  }
  return cells
}

/** Find the clue whose cells include [row, col] in the given direction. */
export function getActiveClue(
  clues: Clue[],
  row: number,
  col: number
): Clue | undefined {
  return clues.find(clue => clue.cells.some(([r, c]) => r === row && c === col))
}

/** Next white cell in direction (wraps within word only, stays in word). */
export function nextCellInWord(
  grid: Grid,
  row: number,
  col: number,
  direction: 'across' | 'down'
): [number, number] {
  if (direction === 'across') {
    const next = col + 1
    if (next < grid[row].length && grid[row][next].type === 'white') return [row, next]
  } else {
    const next = row + 1
    if (next < grid.length && grid[next][col].type === 'white') return [next, col]
  }
  return [row, col]
}

export function prevCellInWord(
  grid: Grid,
  row: number,
  col: number,
  direction: 'across' | 'down'
): [number, number] {
  if (direction === 'across') {
    const prev = col - 1
    if (prev >= 0 && grid[row][prev].type === 'white') return [row, prev]
  } else {
    const prev = row - 1
    if (prev >= 0 && grid[prev][col].type === 'white') return [prev, col]
  }
  return [row, col]
}

/**
 * Where backspace should go when the cursor sits on an empty cell.
 *
 * `prevCellInWord` deliberately stops at the word's edge, which is right for
 * movement *within* a word but left backspace with nowhere to go: at a word's
 * first cell it returned that same cell, so holding the key at a black square
 * or the grid edge did nothing at all and deleting "backwards through the
 * puzzle" stopped dead at every boundary. ADVANCE has a word-jump for exactly
 * this case; this is its mirror.
 *
 * At a word's first cell we step to the LAST cell of the previous clue in the
 * same direction, wrapping at the first clue the way ADVANCE wraps at the last.
 * Unlike Tab, this does **not** skip over words that have nothing to delete:
 * backspace is destructive, so it walks the grid one cell at a time rather than
 * teleporting the cursor into a distant answer and erasing it. Held down, the
 * key auto-repeats, so crossing an empty stretch costs nothing.
 *
 * A lone white cell with no clue in this direction has no word to leave; the
 * cursor stays put there.
 */
export function prevCellForBackspace(
  puzzle: CrosswordPuzzle,
  row: number,
  col: number,
  direction: 'across' | 'down'
): [number, number] {
  const [pr, pc] = prevCellInWord(puzzle.grid, row, col, direction)
  if (pr !== row || pc !== col) return [pr, pc]

  const clues = direction === 'across' ? puzzle.cluesAcross : puzzle.cluesDown
  if (clues.length === 0) return [row, col]
  const idx = clues.findIndex(c => c.cells.some(([r, c2]) => r === row && c2 === col))
  if (idx === -1) return [row, col]

  const prevClue = clues[(idx - 1 + clues.length) % clues.length]
  return prevClue.cells[prevClue.cells.length - 1] ?? [row, col]
}


export function difficultyLabel(d: number): string {
  return ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'][d] ?? 'Unknown'
}

/**
 * One class pair per difficulty, from the theme tokens — so these follow the
 * palette in both modes with no `dark:` variants. The ramp runs green → red
 * across Beginner → Expert.
 */
export const difficultyColors: Record<number, string> = {
  1: 'bg-diff-1-soft text-diff-1',
  2: 'bg-diff-2-soft text-diff-2',
  3: 'bg-diff-3-soft text-diff-3',
  4: 'bg-diff-4-soft text-diff-4',
  5: 'bg-diff-5-soft text-diff-5',
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Longest clue that still fits the mobile clue bar's three lines.
 *
 * The bar is sized for exactly three lines (see ClueBar). Measured in a real
 * browser across all 298 clues in the library, plus a synthetic prose sweep,
 * the character count where a fourth line starts depends on viewport width:
 *
 *   320px (iPhone SE 1st gen)          three lines up to ~90 chars
 *   375px (iPhone SE 2/3, 13 mini)     ~112 chars
 *   390px (iPhone 12–16)               ~123 chars
 *   430px (Pro Max)                    ~145 chars
 *
 * 100 is the round number sitting safely below the 375px crossover band — real
 * clues there still fit at 101 chars and spilled at 114 — so anything under it
 * is safe on every phone still in common use.
 *
 * This is deliberately a soft warning in the admin clue editor, never a cap.
 * A character count can only ever approximate wrapping (a line of "l"s is far
 * narrower than a line of "W"s), and a clue that spills is not broken — it
 * scrolls inside the bar and is one tap away in full in the clue sheet. So the
 * count may warn on a clue that would actually have fit; that is the right way
 * round for an advisory.
 */
export const CLUE_THREE_LINE_LIMIT = 100

export function clueOverflowsThreeLines(clue: string): boolean {
  return clue.trim().length > CLUE_THREE_LINE_LIMIT
}

/**
 * Where the cursor should land when it is dropped into a word: the first cell
 * still empty, or the word's first cell if it is completely filled.
 *
 * Every path that moves the cursor into a word goes through this — auto-advance,
 * Tab/NEXT_WORD, the mobile clue-bar arrows, and clicking a clue in the list.
 * They used to land on cells[0] unconditionally, which put you on a letter you
 * had already entered and made the answer read as if it were starting over.
 *
 * Note this is about *placement*, not skipping. The arrows still visit every
 * clue whether or not it is filled — that is how you get back to an answer that
 * is filled in but wrong.
 */
export function firstUnfilledCell(clue: Clue, cells: SolverCell[][]): [number, number] {
  return clue.cells.find(([r, c]) => !cells[r]?.[c]?.userLetter) ?? clue.cells[0]
}
