'use client'

import type { Clue, Direction } from '@/lib/crossword/types'

interface Props {
  clue: Clue | null
  direction: Direction
  onPrev: () => void
  onNext: () => void
  onOpenList: () => void
}

// The mobile equivalent of the desktop clue panels: one line above the keyboard
// showing the active clue, with arrows to step through entries and a tap target
// to open the full list.
export default function ClueBar({ clue, direction, onPrev, onNext, onOpenList }: Props) {
  const arrowClass =
    'shrink-0 w-11 h-11 flex items-center justify-center text-2xl leading-none ' +
    'text-gray-500 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors'

  return (
    <div className="touch-target shrink-0 md:hidden flex items-stretch border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button type="button" tabIndex={-1} aria-label="Previous clue" onClick={onPrev} className={arrowClass}>
        ‹
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={onOpenList}
        className="flex-1 min-w-0 px-1 py-2 text-left flex items-baseline gap-2 active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
      >
        {clue ? (
          <>
            <span className="shrink-0 text-xs font-bold text-gray-500 dark:text-gray-400">
              {clue.number}
              {direction === 'across' ? 'A' : 'D'}
            </span>
            <span className="truncate text-sm text-gray-800 dark:text-gray-200">
              {clue.clue || <em className="text-gray-400">No clue</em>}
            </span>
          </>
        ) : (
          <span className="text-sm text-gray-400 dark:text-gray-500 italic">Select a cell</span>
        )}
      </button>

      <button type="button" tabIndex={-1} aria-label="Next clue" onClick={onNext} className={arrowClass}>
        ›
      </button>

      {/* Only visible in phone landscape, where the keyboard is hidden. */}
      <span className="landscape-only hidden shrink-0 items-center pr-3 text-[10px] leading-tight text-gray-400 dark:text-gray-500">
        Rotate to type
      </span>
    </div>
  )
}
