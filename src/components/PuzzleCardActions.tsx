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
        <div className="flex items-center justify-center gap-1.5 text-[13px] text-accent font-bold">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>{formatTime(solveTime)}</span>
        </div>
      )}
      <Link
        href={`/puzzles/${puzzleId}`}
        className={`inline-flex items-center justify-center py-3.5 px-4 rounded-full font-bold text-[13px] transition-opacity hover:opacity-90 ${
          solveTime !== null
            ? 'bg-sunken text-ink'
            : 'bg-accent text-accent-ink'
        }`}
      >
        {solveTime !== null ? 'View puzzle' : 'Solve puzzle'}
      </Link>
    </div>
  )
}
