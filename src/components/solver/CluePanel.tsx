'use client'

import { useLayoutEffect, useRef } from 'react'
import type { Clue } from '@/lib/crossword/types'

interface Props {
  title: string
  clues: Clue[]
  activeClueNumber: number | null
  onClueClick: (clue: Clue) => void
}

export default function CluePanel({ title, clues, activeClueNumber, onClueClick }: Props) {
  const listRef = useRef<HTMLOListElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  useLayoutEffect(() => {
    if (!listRef.current || !activeRef.current) return
    const list = listRef.current
    const item = activeRef.current
    const itemContentTop =
      item.getBoundingClientRect().top - list.getBoundingClientRect().top + list.scrollTop
    list.scrollTop = itemContentTop - 8
  }, [activeClueNumber])

  return (
    <div className="flex flex-col h-full">
      <h2 className="font-display text-xs font-semibold uppercase tracking-[0.14em] text-accent px-3 py-2.5 border-b border-line">
        {title}
      </h2>
      <ol ref={listRef} className="flex-1 overflow-y-auto text-sm">
        {clues.map(clue => {
          const isActive = clue.number === activeClueNumber
          return (
            <li key={clue.number}>
              <button
                ref={isActive ? activeRef : null}
                onClick={() => onClueClick(clue)}
                className={`w-full text-left px-3 py-1.5 max-md:py-3 flex gap-2 transition-colors ${
                  isActive
                    ? 'bg-accent-soft font-semibold text-accent-soft-ink'
                    : 'hover:bg-sunken text-ink'
                }`}
              >
                <span className="shrink-0 font-semibold text-ink-soft w-6 text-right">
                  {clue.number}
                </span>
                <span className="leading-snug">{clue.clue || <em className="text-ink-soft">No clue</em>}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
