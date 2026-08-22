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
    'w-full rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 ' +
    'shadow-sm text-gray-700 dark:text-gray-200 font-medium transition-colors ' +
    (isMenu
      ? 'text-sm px-3 py-3 text-left active:bg-gray-100 dark:active:bg-gray-600'
      : 'text-sm px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-600')

  const confirmYes =
    'flex-1 rounded bg-orange-400 text-white font-semibold transition-colors ' +
    (isMenu ? 'text-xs py-2 active:bg-orange-500' : 'text-xs py-1 hover:bg-orange-500')

  const confirmNo =
    'flex-1 rounded border border-gray-200 text-gray-600 transition-colors ' +
    (isMenu ? 'text-xs py-2 active:bg-gray-100' : 'text-xs py-1 hover:bg-gray-50')

  return (
    <>
      {!confirmReset ? (
        <button onClick={() => setConfirmReset(true)} className={buttonClass}>
          Reset Puzzle
        </button>
      ) : (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-2 space-y-2">
          <p className="text-xs text-orange-700 font-medium">Reset all answers?</p>
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
          Show Incorrect
        </button>
      ) : (
        <div className="border border-orange-200 bg-orange-50 rounded-lg p-2 space-y-2">
          <p className="text-xs text-orange-700 font-medium">Highlight wrong letters?</p>
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
