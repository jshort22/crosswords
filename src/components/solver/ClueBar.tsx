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
    'shrink-0 w-11 min-h-11 flex items-center justify-center text-2xl leading-none ' +
    'text-gray-500 dark:text-gray-400 active:bg-gray-200 dark:active:bg-gray-700 transition-colors'

  return (
    /* Fixed height, deliberately: if the bar grew with the clue, the grid area
       would shrink and the cells would visibly resize every time you moved
       between a one-line and a two-line clue. Two lines covers ~95% of clues
       here (median 26 chars, 95th percentile 71); longer ones scroll inside. */
    <div className="touch-target shrink-0 md:hidden h-14 flex items-stretch border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <button type="button" tabIndex={-1} aria-label="Previous clue" onClick={onPrev} className={arrowClass}>
        ‹
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={onOpenList}
        className="flex-1 min-w-0 px-1 py-2 text-left flex items-center active:bg-gray-100 dark:active:bg-gray-700 transition-colors"
      >
        {clue ? (
          // items-center on the button centres this block in the fixed bar, so a
          // one-line clue isn't stranded at the top; items-start here keeps the
          // number aligned to the first line rather than to the block's middle.
          <div className="min-w-0 w-full max-h-full flex items-start gap-2">
            {/* mt-0.5 optically aligns the smaller number with the first text line,
                which items-baseline used to do — but baseline alignment only
                considers the first line, so it can't be used once text wraps. */}
            <span className="shrink-0 mt-0.5 text-xs font-bold text-gray-500 dark:text-gray-400">
              {clue.number}
              {direction === 'across' ? 'A' : 'D'}
            </span>
            {/* Wraps freely, but the height is capped so no clue length can
                squeeze the grid — the grid takes whatever height is left. A
                fixed line-clamp would just move the cliff: real clues here run
                from 26 chars (median) to 132 (about four lines on a phone).
                Past the cap this scrolls, so nothing is ever unreachable, and
                the full text is always one tap away in the clue sheet. */}
            {/* max-height is expressed in em so it lands on an exact multiple of
                the line box: leading-snug is 1.375, so 2.75em is precisely two
                lines. A px cap (e.g. max-h-12) slices the third line in half,
                which reads as broken rather than as "there is more, scroll". */}
            <span className="min-w-0 flex-1 max-h-[2.75em] overflow-y-auto overscroll-contain text-sm leading-snug text-gray-800 dark:text-gray-200">
              {clue.clue || <em className="text-gray-400">No clue</em>}
            </span>
          </div>
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
