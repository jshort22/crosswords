export type CellState = 'black' | 'white'

export interface GridCell {
  type: CellState
  letter: string      // solution letter, empty string for black
  number: number | null
}

// [row][col] grid
export type Grid = GridCell[][]

export interface Clue {
  number: number
  clue: string
  answer: string   // solution letters concatenated
  cells: [number, number][]  // [row, col] sequence
}

/**
 * A reference to one answer. The direction is part of the identity — 17 Across
 * and 17 Down are different answers that share a number, so a bare number
 * cannot identify a theme entry.
 */
export interface ClueRef {
  number: number
  direction: Direction
}

/**
 * The puzzle's theme set: the marquees (the revealers) and the answers that pay
 * them off. A puzzle can have more than one marquee — that happens.
 *
 * Selecting a marquee lights every themer **and the other marquees**; selecting
 * a themer lights the marquees only, never its sibling themers. The marquees are
 * the hubs, and themers still do not reveal each other.
 */
export interface ThemeSet {
  marquees: ClueRef[]
  themers: ClueRef[]
}

export interface CrosswordPuzzle {
  id: string
  title: string
  author: string | null
  difficulty: number
  rows: number
  cols: number
  grid: Grid
  cluesAcross: Clue[]
  cluesDown: Clue[]
  themeSet: ThemeSet
  sourceFileUrl: string | null
  isPublished: boolean
  createdAt: string
}

// What the solver keeps track of per-cell
export interface SolverCell {
  userLetter: string
  isRevealed: boolean
  isChecked: boolean
  isCorrect: boolean | null
}

export type Direction = 'across' | 'down'


export interface SolverState {
  cells: SolverCell[][]
  activeRow: number
  activeCol: number
  direction: Direction
  isComplete: boolean
  hasErrors: boolean
  startTime: number | null
  endTime: number | null
}
