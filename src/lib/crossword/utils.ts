import type { Grid, GridCell, Clue, CrosswordPuzzle } from './types'
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


export function difficultyLabel(d: number): string {
  return ['', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'][d] ?? 'Unknown'
}

export const difficultyColors: Record<number, string> = {
  1: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  2: 'bg-lime-100 text-lime-700 dark:bg-lime-900/40 dark:text-lime-400',
  3: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400',
  4: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400',
  5: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
