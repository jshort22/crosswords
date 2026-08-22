'use client'

interface Props {
  onClose: () => void
}

// Shown when the grid is full but at least one letter is wrong.
//
// This used to be an inline pill below the grid, which appeared and disappeared
// inside the grid column — so the grid resized underneath you at the exact
// moment you were reading the message. A centred modal takes no layout space at
// all, so nothing moves.
//
// It is shown ONCE per attempt (see the storage key in SolverClient). The point
// of the message is "the grid is full but not right"; once that has landed,
// repeating it on every subsequent full-but-wrong grid is nagging.
export default function WrongAnswerModal({ onClose }: Props) {
  return (
    /* data-wrong-modal is a TEST HOOK. The old banner was asserted on by its
       copy, which is exactly the coupling the redesign broke last time. */
    <div
      data-wrong-modal=""
      role="dialog"
      aria-modal="true"
      aria-labelledby="wrong-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm"
    >
      <div className="bg-surface rounded-[26px] shadow-float p-8 mx-4 max-w-sm w-full text-center animate-pop-in">
        <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-danger-soft flex items-center justify-center text-danger">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
        </div>

        <h2 id="wrong-modal-title" className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-ink mb-2">
          Not quite
        </h2>
        <p className="text-ink-soft mb-6 text-sm">
          The grid is full, but at least one letter is wrong.
        </p>

        <button
          onClick={onClose}
          // Focus belongs inside a modal dialog, so autoFocus stays. But the
          // browser's default focus ring is blue, which is off-palette against
          // Daylight — restyled rather than removed, since removing a visible
          // focus indicator fails WCAG 2.4.7. Offset against the card so it
          // reads on the accent fill.
          autoFocus
          className="w-full py-3.5 rounded-full bg-accent text-accent-ink font-bold transition-opacity hover:opacity-90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        >
          Keep trying
        </button>
      </div>
    </div>
  )
}
