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
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
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
                className={`w-full text-left px-3 py-1.5 flex gap-2 transition-colors ${
                  isActive
                    ? 'bg-amber-100 dark:bg-amber-800/40 font-semibold text-gray-900 dark:text-amber-200'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <span className="shrink-0 font-semibold text-gray-500 dark:text-gray-400 w-6 text-right">
                  {clue.number}
                </span>
                <span className="leading-snug">{clue.clue || <em className="text-gray-400">No clue</em>}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
