'use client'

import type { Clue } from '@/lib/crossword/types'
import CluePanel from './CluePanel'

interface Props {
  cluesAcross: Clue[]
  cluesDown: Clue[]
  activeAcrossNumber: number | null
  activeDownNumber: number | null
  onAcrossClick: (clue: Clue) => void
  onDownClick: (clue: Clue) => void
  onClose: () => void
}

// Full clue list as a bottom sheet. CluePanel is reused unchanged: its contract
// is "parent gives me a bounded height, I scroll inside it", which the flex
// children below satisfy exactly the way the desktop aside does. That's also
// why its scroll-to-active finally works here — the deleted md:hidden section
// never gave the <ol> a bounded height, so its scrollTop write was a no-op.
export default function ClueSheet({
  cluesAcross,
  cluesDown,
  activeAcrossNumber,
  activeDownNumber,
  onAcrossClick,
  onDownClick,
  onClose,
}: Props) {
  return (
    // z-40 keeps this under the completion modal's z-50.
    <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="All clues">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="absolute inset-x-0 bottom-0 top-16 flex flex-col overflow-hidden rounded-t-2xl bg-white dark:bg-gray-800 shadow-2xl pb-[env(safe-area-inset-bottom)]">
        <div className="shrink-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-3 py-2">
          <span className="text-sm font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400">
            Clues
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400 active:bg-gray-100 dark:active:bg-gray-700 rounded-lg transition-colors"
          >
            Done
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col border-b border-gray-200 dark:border-gray-700">
          <CluePanel
            title="Across"
            clues={cluesAcross}
            activeClueNumber={activeAcrossNumber}
            onClueClick={onAcrossClick}
          />
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          <CluePanel
            title="Down"
            clues={cluesDown}
            activeClueNumber={activeDownNumber}
            onClueClick={onDownClick}
          />
        </div>
      </div>
    </div>
  )
}
