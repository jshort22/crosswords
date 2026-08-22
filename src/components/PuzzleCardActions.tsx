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
        /* data-solved-mark is a TEST HOOK. The solved state on a card is only
           ever visible once localStorage says so, which makes it easy to break
           unnoticed — select on this, not on the icon or the colour. */
        <div data-solved-mark="" className="flex items-center justify-center gap-1.5 text-[13px] text-accent font-bold">
          <svg viewBox="0 0 24 24" width="15" height="15" className="text-gold-ink" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M6 2h12v7a6 6 0 0 1-12 0V2Z" />
            <path d="M10 14.5V17c0 .8-.6 1.2-1.2 1.5-.9.5-1.8 1.6-1.8 3.5" />
            <path d="M14 14.5V17c0 .8.6 1.2 1.2 1.5.9.5 1.8 1.6 1.8 3.5" />
            <path d="M4 22h16" />
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
