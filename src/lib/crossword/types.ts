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
