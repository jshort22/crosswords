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
    'text-ink-soft active:bg-sunken transition-colors'

  return (
    /* Fixed height, deliberately: if the bar grew with the clue, the grid area
       would shrink and the cells would visibly resize every time you moved
       between a one-line and a two-line clue.

       Sized for exactly THREE lines: 3 x 19.25px line box (text-sm at
       leading-snug) = 57.75px, plus the button's py-2 (16px) = 73.75px, so
       4.75rem (76px) with a couple of px to spare. Measured over all 298
       clues in the library, three lines shows the whole clue for 298/298 at
       430px wide, 297/298 at 390px, and 295/298 at 375px (at 320px, nine
       clues still overflow and two need five lines). It costs 20px of grid
       height on every puzzle, which is the trade being made. */
    <div className="touch-target shrink-0 md:hidden h-[4.75rem] flex items-stretch border-t border-line bg-sunken">
      <button type="button" tabIndex={-1} aria-label="Previous clue" onClick={onPrev} className={arrowClass}>
        ‹
      </button>

      <button
        type="button"
        tabIndex={-1}
        onClick={onOpenList}
        className="flex-1 min-w-0 px-1 py-2 text-left flex items-center active:bg-accent-soft transition-colors"
      >
        {clue ? (
          // items-center on the button centres this block in the fixed bar, so a
          // one-line clue isn't stranded at the top; items-start here keeps the
          // number aligned to the first line rather than to the block's middle.
          <div className="min-w-0 w-full max-h-full flex items-start gap-2">
            {/* mt-0.5 optically aligns the smaller number with the first text line,
                which items-baseline used to do — but baseline alignment only
                considers the first line, so it can't be used once text wraps. */}
            <span className="shrink-0 mt-0.5 text-xs font-bold text-ink-soft">
              {clue.number}
              {direction === 'across' ? 'A' : 'D'}
            </span>
            {/* Wraps freely, but the height is capped so no clue length can
                squeeze the grid — the grid takes whatever height is left. Real
                clues here run from 26 chars (median) to 132 (the longest, which
                is the only one that still needs a fourth line at 390px). Past
                the cap this scrolls, so nothing is ever unreachable, and the
                full text is always one tap away in the clue sheet. */}
            {/* max-height is expressed in em so it lands on an exact multiple of
                the line box: leading-snug is 1.375, so 4.125em is precisely
                three lines. A px cap (e.g. max-h-14) slices the fourth line in
                half, which reads as broken rather than as "there is more,
                scroll". Keep this in step with the bar's h-[4.75rem] above. */}
            <span className="min-w-0 flex-1 max-h-[4.125em] overflow-y-auto overscroll-contain text-sm leading-snug text-ink">
              {clue.clue || <em className="text-ink-soft">No clue</em>}
            </span>
          </div>
        ) : (
          <span className="text-sm text-ink-soft italic">Select a cell</span>
        )}
      </button>

      <button type="button" tabIndex={-1} aria-label="Next clue" onClick={onNext} className={arrowClass}>
        ›
      </button>

      {/* Only visible in phone landscape, where the keyboard is hidden. */}
      <span className="landscape-only hidden shrink-0 items-center pr-3 text-[10px] leading-tight text-ink-soft">
        Rotate to type
      </span>
    </div>
  )
}
