'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { formatTime } from '@/lib/crossword/utils'

interface Props {
  puzzleId: string
}

export default function PuzzleCardActions({ puzzleId }: Props) {
  const [solveTime, setSolveTime] = useState<number | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`crossword-solved-${puzzleId}`)
      if (raw) {
        const { elapsed } = JSON.parse(raw)
        setSolveTime(elapsed)
      }
    } catch {}
  }, [puzzleId])

  return (
    <div className="mt-auto flex flex-col gap-2">
      {solveTime !== null && (
        <div className="flex items-center justify-center gap-1.5 text-sm text-amber-600 font-semibold">
          <span>🏆</span>
          <span>{formatTime(solveTime)}</span>
        </div>
      )}
      <Link
        href={`/puzzles/${puzzleId}`}
        className={`inline-flex items-center justify-center py-2.5 px-4 rounded-lg font-semibold text-sm transition-colors text-white ${
          solveTime !== null
            ? 'bg-amber-400 hover:bg-amber-500'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {solveTime !== null ? 'View Puzzle' : 'Solve Puzzle'}
      </Link>
    </div>
  )
}
