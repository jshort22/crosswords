'use client'

import { useState } from 'react'

interface Props {
  onReset: () => void
  onShowIncorrect: () => void
  /** 'sidebar' = desktop left panel, 'menu' = mobile header popover. */
  variant: 'sidebar' | 'menu'
}

// Reset + Show Incorrect, shared by the desktop sidebar and the mobile menu.
// The side effects for reset deliberately stay in SolverClient — that cluster
// (reset, setElapsed, celebrationPhase, restoredAsSolvedRef, localStorage) is
// what the completion-flow fix in 4b1c6e3 got right, and it depends on state
// that lives there. This component only owns its own confirmation UI.
export default function SolverActions({ onReset, onShowIncorrect, variant }: Props) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmCheck, setConfirmCheck] = useState(false)

  const isMenu = variant === 'menu'

  const buttonClass =
    'w-full rounded-full bg-surface shadow-key text-ink font-medium transition-colors ' +
    (isMenu
      ? 'text-sm px-4 py-3.5 text-left active:bg-sunken'
      : 'text-[13px] px-4 py-3 text-left hover:bg-sunken')

  const confirmYes =
    'flex-1 rounded-full bg-accent text-accent-ink font-bold transition-opacity hover:opacity-90 ' +
    (isMenu ? 'text-xs py-2.5' : 'text-xs py-2')

  const confirmNo =
    'flex-1 rounded-full bg-sunken text-ink-soft transition-colors ' +
    (isMenu ? 'text-xs py-2.5' : 'text-xs py-2')

  return (
    <>
      {!confirmReset ? (
        <button onClick={() => setConfirmReset(true)} className={buttonClass}>
          Reset puzzle
        </button>
      ) : (
        <div className="bg-sunken rounded-2xl p-3 space-y-2">
          <p className="text-xs text-ink-soft font-medium">Reset all answers?</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onReset()
                setConfirmReset(false)
              }}
              className={confirmYes}
            >
              Yes
            </button>
            <button onClick={() => setConfirmReset(false)} className={confirmNo}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {!confirmCheck ? (
        <button onClick={() => setConfirmCheck(true)} className={buttonClass}>
          Show incorrect
        </button>
      ) : (
        <div className="bg-sunken rounded-2xl p-3 space-y-2">
          <p className="text-xs text-ink-soft font-medium">Highlight wrong letters?</p>
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                onShowIncorrect()
                setConfirmCheck(false)
              }}
              className={confirmYes}
            >
              Yes
            </button>
            <button onClick={() => setConfirmCheck(false)} className={confirmNo}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  )
}
