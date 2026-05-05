'use client'

import { useReducer, useCallback, useEffect } from 'react'
import type { CrosswordPuzzle, SolverState, Direction } from '@/lib/crossword/types'
import { getWordCells, nextCellInWord, prevCellInWord } from '@/lib/crossword/utils'

type Action =
  | { type: 'SET_LETTER'; row: number; col: number; letter: string }
  | { type: 'CLEAR_LETTER'; row: number; col: number }
  | { type: 'SET_ACTIVE'; row: number; col: number }
  | { type: 'SET_DIRECTION'; direction: Direction }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'MOVE'; dr: number; dc: number }
  | { type: 'ADVANCE' }
  | { type: 'RETREAT' }
  | { type: 'NEXT_WORD' }
  | { type: 'PREV_WORD' }
  | { type: 'CHECK_COMPLETE'; solution: string[][] }
  | { type: 'RESTORE'; cells: SolverState['cells']; startTime: number | null }
  | { type: 'RESET' }
  | { type: 'SHOW_INCORRECT' }
  | { type: 'FILL_FOR_TEST' }
  | { type: 'RESTORE_SOLVED' }

function initState(puzzle: CrosswordPuzzle): SolverState {
  const cells = Array.from({ length: puzzle.rows }, () =>
    Array.from({ length: puzzle.cols }, () => ({
      userLetter: '',
      isRevealed: false,
      isChecked: false,
      isCorrect: null as boolean | null,
    }))
  )

  // find first white cell
  let firstRow = 0, firstCol = 0
  outer: for (let r = 0; r < puzzle.rows; r++) {
    for (let c = 0; c < puzzle.cols; c++) {
      if (puzzle.grid[r][c].type === 'white') {
        firstRow = r; firstCol = c
        break outer
      }
    }
  }

  return {
    cells,
    activeRow: firstRow,
    activeCol: firstCol,
    direction: 'across',
    isComplete: false,
    hasErrors: false,
    startTime: Date.now(),
    endTime: null,
  }
}

function reducer(state: SolverState, action: Action, puzzle: CrosswordPuzzle): SolverState {
  switch (action.type) {
    case 'SET_LETTER': {
      const newCells = state.cells.map((row, r) =>
        row.map((cell, c) =>
          r === action.row && c === action.col
            ? { ...cell, userLetter: action.letter.toUpperCase(), isCorrect: null }
            : cell
        )
      )
      return {
        ...state,
        cells: newCells,
        hasErrors: false,
      }
    }
    case 'CLEAR_LETTER': {
      const newCells = state.cells.map((row, r) =>
        row.map((cell, c) =>
          r === action.row && c === action.col
            ? { ...cell, userLetter: '', isCorrect: null }
            : cell
        )
      )
      return { ...state, cells: newCells, hasErrors: false }
    }
    case 'SET_ACTIVE': {
      const { row, col } = action
      if (puzzle.grid[row]?.[col]?.type === 'black') return state
      // Clicking the same cell toggles direction
      if (row === state.activeRow && col === state.activeCol) {
        return { ...state, direction: state.direction === 'across' ? 'down' : 'across' }
      }
      return { ...state, activeRow: row, activeCol: col }
    }
    case 'SET_DIRECTION':
      return { ...state, direction: action.direction }
    case 'TOGGLE_DIRECTION':
      return { ...state, direction: state.direction === 'across' ? 'down' : 'across' }
    case 'MOVE': {
      const newRow = state.activeRow + action.dr
      const newCol = state.activeCol + action.dc
      if (
        newRow < 0 || newRow >= puzzle.rows ||
        newCol < 0 || newCol >= puzzle.cols ||
        puzzle.grid[newRow][newCol].type === 'black'
      ) return state
      const dir: Direction = action.dr !== 0 ? 'down' : 'across'
      return { ...state, activeRow: newRow, activeCol: newCol, direction: dir }
    }
    case 'ADVANCE': {
      const [nr, nc] = nextCellInWord(puzzle.grid, state.activeRow, state.activeCol, state.direction)
      if (nr !== state.activeRow || nc !== state.activeCol) {
        return { ...state, activeRow: nr, activeCol: nc }
      }
      // End of word — jump to first cell of next word
      const clues = state.direction === 'across' ? puzzle.cluesAcross : puzzle.cluesDown
      const currentIdx = clues.findIndex(c => c.cells.some(([r, c2]) => r === state.activeRow && c2 === state.activeCol))
      if (currentIdx === -1) return state
      const nextClue = clues[(currentIdx + 1) % clues.length]
      return { ...state, activeRow: nextClue.cells[0][0], activeCol: nextClue.cells[0][1] }
    }
    case 'RETREAT': {
      const [nr, nc] = prevCellInWord(puzzle.grid, state.activeRow, state.activeCol, state.direction)
      return { ...state, activeRow: nr, activeCol: nc }
    }
    case 'NEXT_WORD': {
      const clues = state.direction === 'across' ? puzzle.cluesAcross : puzzle.cluesDown
      const idx = clues.findIndex(c => c.cells.some(([r, c2]) => r === state.activeRow && c2 === state.activeCol))
      if (idx === -1) return state
      const next = clues[(idx + 1) % clues.length]
      return { ...state, activeRow: next.cells[0][0], activeCol: next.cells[0][1] }
    }
    case 'PREV_WORD': {
      const clues = state.direction === 'across' ? puzzle.cluesAcross : puzzle.cluesDown
      const idx = clues.findIndex(c => c.cells.some(([r, c2]) => r === state.activeRow && c2 === state.activeCol))
      if (idx === -1) return state
      const prev = clues[(idx - 1 + clues.length) % clues.length]
      return { ...state, activeRow: prev.cells[0][0], activeCol: prev.cells[0][1] }
    }
    case 'RESTORE':
      return { ...state, cells: action.cells, startTime: action.startTime }
    case 'RESET': {
      const clearedCells = state.cells.map(row =>
        row.map(cell => ({ ...cell, userLetter: '', isCorrect: null, isChecked: false }))
      )
      return { ...state, cells: clearedCells, isComplete: false, hasErrors: false, startTime: Date.now(), endTime: null }
    }
    case 'SHOW_INCORRECT': {
      const checkedCells = state.cells.map((row, r) =>
        row.map((cell, c) => {
          if (!cell.userLetter) return { ...cell, isCorrect: null }
          return { ...cell, isCorrect: cell.userLetter === puzzle.grid[r][c].letter }
        })
      )
      return { ...state, cells: checkedCells }
    }
    case 'RESTORE_SOLVED': {
      const solvedCells = state.cells.map((row, r) =>
        row.map((cell, c) =>
          puzzle.grid[r][c].type === 'black'
            ? cell
            : { ...cell, userLetter: puzzle.grid[r][c].letter, isCorrect: null }
        )
      )
      return { ...state, cells: solvedCells, isComplete: true, hasErrors: false }
    }
    case 'FILL_FOR_TEST': {
      // Collect all white cells in grid order
      const whiteCells: [number, number][] = []
      for (let r = 0; r < puzzle.rows; r++) {
        for (let c = 0; c < puzzle.cols; c++) {
          if (puzzle.grid[r][c].type === 'white') whiteCells.push([r, c])
        }
      }
      const skip = whiteCells[whiteCells.length - 1]
      const filledCells = state.cells.map((row, r) =>
        row.map((cell, c) => {
          if (puzzle.grid[r][c].type === 'black') return cell
          if (r === skip[0] && c === skip[1]) return { ...cell, userLetter: '' }
          return { ...cell, userLetter: puzzle.grid[r][c].letter }
        })
      )
      return {
        ...state,
        cells: filledCells,
        hasErrors: false,
        startTime: state.startTime ?? Date.now(),
        activeRow: skip[0],
        activeCol: skip[1],
      }
    }
    case 'CHECK_COMPLETE': {
      const allFilled = state.cells.every((row, r) =>
        row.every((cell, c) =>
          puzzle.grid[r][c].type === 'black' || cell.userLetter !== ''
        )
      )
      if (!allFilled) return state
      const allCorrect = state.cells.every((row, r) =>
        row.every((cell, c) => {
          if (puzzle.grid[r][c].type === 'black') return true
          return cell.userLetter === action.solution[r][c]
        })
      )
      if (allCorrect) {
        return { ...state, isComplete: true, hasErrors: false, endTime: Date.now() }
      }
      return { ...state, hasErrors: true }
    }
    default:
      return state
  }
}

export function useCrosswordSolver(puzzle: CrosswordPuzzle) {
  const solution = puzzle.grid.map(row => row.map(cell => cell.letter))

  const [state, dispatch] = useReducer(
    (s: SolverState, a: Action) => reducer(s, a, puzzle),
    puzzle,
    initState
  )

  const setLetter = useCallback((row: number, col: number, letter: string) => {
    dispatch({ type: 'SET_LETTER', row, col, letter })
  }, [])

  const clearLetter = useCallback((row: number, col: number) => {
    dispatch({ type: 'CLEAR_LETTER', row, col })
  }, [])

  const setActive = useCallback((row: number, col: number) => {
    dispatch({ type: 'SET_ACTIVE', row, col })
  }, [])

  const toggleDirection = useCallback(() => {
    dispatch({ type: 'TOGGLE_DIRECTION' })
  }, [])

  const setDirection = useCallback((direction: Direction) => {
    dispatch({ type: 'SET_DIRECTION', direction })
  }, [])

  const move = useCallback((dr: number, dc: number) => {
    dispatch({ type: 'MOVE', dr, dc })
  }, [])

  const advance = useCallback(() => dispatch({ type: 'ADVANCE' }), [])
  const retreat = useCallback(() => dispatch({ type: 'RETREAT' }), [])
  const nextWord = useCallback(() => dispatch({ type: 'NEXT_WORD' }), [])
  const prevWord = useCallback(() => dispatch({ type: 'PREV_WORD' }), [])
  const restore = useCallback((cells: SolverState['cells'], startTime: number | null) => {
    dispatch({ type: 'RESTORE', cells, startTime })
  }, [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  const showIncorrect = useCallback(() => dispatch({ type: 'SHOW_INCORRECT' }), [])
  const fillForTest = useCallback(() => dispatch({ type: 'FILL_FOR_TEST' }), [])
  const restoreSolved = useCallback(() => dispatch({ type: 'RESTORE_SOLVED' }), [])

  // Check completion after every letter change
  useEffect(() => {
    if (!state.isComplete) {
      dispatch({ type: 'CHECK_COMPLETE', solution })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cells])

  const wordCells = getWordCells(puzzle.grid, state.activeRow, state.activeCol, state.direction)
  const wordCellSet = new Set(wordCells.map(([r, c]) => `${r},${c}`))

  return {
    state,
    wordCells,
    wordCellSet,
    setLetter,
    clearLetter,
    setActive,
    toggleDirection,
    setDirection,
    move,
    advance,
    retreat,
    nextWord,
    prevWord,
    restore,
    reset,
    showIncorrect,
    fillForTest,
    restoreSolved,
  }
}
