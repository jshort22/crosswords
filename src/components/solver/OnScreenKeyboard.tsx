'use client'

import { useCallback, useEffect, useRef } from 'react'

interface Props {
  onLetter: (letter: string) => void
  onDelete: () => void
  /** True once the puzzle is solved — the grid is read-only from then on. */
  disabled?: boolean
}

const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'] as const

// Hold-to-repeat on the delete key, roughly matching a physical keyboard: a
// pause long enough that a normal tap never repeats, then a steady rate. 80ms
// clears about twelve cells a second — brisk enough to wipe a long answer, slow
// enough to stop where you meant to. Deliberately NOT applied to the letter
// keys: holding a letter should never type "AAAA" into a crossword.
const REPEAT_DELAY_MS = 400
const REPEAT_INTERVAL_MS = 80

// A custom keyboard rather than a hidden <input>: a real input means fighting
// iOS over when the keyboard appears, how it resizes the visual viewport, and
// autocorrect/autocapitalise. Rendering our own keeps the layout height fixed
// and known, which is what lets the grid size itself reliably. Letters only —
// no space, shift, or return, since a crossword cell takes one letter.
export default function OnScreenKeyboard({ onLetter, onDelete, disabled = false }: Props) {
  const delayRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeatRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // The repeat calls through a ref, NOT the captured prop. `onDelete` is a
  // useCallback over solver state, so it is a new function after every single
  // deletion — an interval closing over the one that existed at pointerdown
  // would keep deleting against the state as it was when the hold began.
  const onDeleteRef = useRef(onDelete)
  useEffect(() => { onDeleteRef.current = onDelete }, [onDelete])

  const stopRepeat = useCallback(() => {
    if (delayRef.current) { clearTimeout(delayRef.current); delayRef.current = null }
    if (repeatRef.current) { clearInterval(repeatRef.current); repeatRef.current = null }
  }, [])

  // Covers unmounting mid-hold (navigating away) and the puzzle completing
  // while the key is held — either would otherwise leave a live interval.
  useEffect(() => stopRepeat, [stopRepeat])
  useEffect(() => { if (disabled) stopRepeat() }, [disabled, stopRepeat])

  const startDelete = (e: React.PointerEvent) => {
    e.preventDefault()
    if (disabled) return
    stopRepeat()                                  // a second pointerdown must not stack intervals
    onDelete()                                    // first delete lands immediately
    delayRef.current = setTimeout(() => {
      repeatRef.current = setInterval(() => onDeleteRef.current(), REPEAT_INTERVAL_MS)
    }, REPEAT_DELAY_MS)
  }
  // Key height scales with viewport height. A square grid inside a tall phone
  // leaves slack that nothing else can use — an iPhone SE has ~40px spare, a
  // 14 Pro Max ~260px — so it goes to the keys, where it buys easier typing.
  // Floor is 2.75rem (44px, the iOS minimum touch target); ceiling keeps keys
  // from looking absurd on the tallest devices.
  const keyClass =
    'flex-1 min-w-0 h-[clamp(2.75rem,7.5svh,3.75rem)] rounded-[10px] font-semibold text-base flex items-center justify-center ' +
    'bg-surface text-ink shadow-key ' +
    'transition-colors active:bg-accent-soft active:text-accent-soft-ink ' +
    (disabled ? 'opacity-40' : '')

  // pointerdown rather than click: fires immediately (no ~300ms tap delay) and
  // preventDefault suppresses the synthesised mouse/focus sequence, which would
  // otherwise steal focus from the grid container that handles physical keys.
  const press = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault()
    if (disabled) return
    fn()
  }

  return (
    <div
      className="touch-target landscape-hide shrink-0 md:hidden bg-sunken px-1.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex flex-col gap-1.5"
      // Padding, not margin, so the keyboard's background extends into the
      // home-indicator strip instead of leaving a band of page colour.
      aria-label="Letter keyboard"
    >
      {ROWS.map((row, i) => (
        <div
          key={row}
          className="flex gap-1"
          // Row 2 is inset the way a real QWERTY keyboard is.
          style={i === 1 ? { paddingLeft: '5%', paddingRight: '5%' } : undefined}
        >
          {row.split('').map(letter => (
            <button
              key={letter}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onPointerDown={press(() => onLetter(letter))}
              className={keyClass}
            >
              {letter}
            </button>
          ))}
          {i === ROWS.length - 1 && (
            <button
              type="button"
              tabIndex={-1}
              disabled={disabled}
              onPointerDown={startDelete}
              // Every way a hold can end. pointerup/cancel cover the normal
              // release and the browser taking over the gesture; pointerleave
              // covers sliding a finger off the key, which fires no pointerup
              // on that element.
              onPointerUp={stopRepeat}
              onPointerCancel={stopRepeat}
              onPointerLeave={stopRepeat}
              aria-label="Delete"
              className={keyClass + ' flex-[1.6] !bg-sunken text-ink-soft'}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 6H9l-6 6 6 6h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1z" />
                <path d="M16 10l-4 4M12 10l4 4" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
