'use client'

import { difficultyLabel, difficultyColors } from '@/lib/crossword/utils'
import { formatTime } from '@/lib/crossword/utils'

interface Props {
  title: string
  difficulty: number
  elapsedSeconds: number
  onClose: () => void
}

export default function CompletionModal({ title, difficulty, elapsedSeconds, onClose }: Props) {
  return (
    /* data-complete-modal and data-complete-mark are TEST HOOKS. The harnesses
       used to assert on the copy ("Puzzle Complete!") and on the trophy emoji,
       so rewording the modal or swapping the emoji for an icon silently broke
       every one of them. Keep these attributes stable. */
    <div
      data-complete-modal=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm"
    >
      <div className="bg-surface rounded-[26px] shadow-float p-8 mx-4 max-w-sm w-full text-center animate-pop-in">
        {/* Trophy, matching the mark on the library card — the reward reads the
            same in both places. --gold-ink rather than --gold: the celebration
            gold is a fill colour and only makes 2.42:1 as a small mark. */}
        <div data-complete-mark="" className="mx-auto mb-5 w-14 h-14 rounded-full bg-gold-soft flex items-center justify-center text-gold-ink">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <path d="M6 2h12v7a6 6 0 0 1-12 0V2Z" />
            <path d="M10 14.5V17c0 .8-.6 1.2-1.2 1.5-.9.5-1.8 1.6-1.8 3.5" />
            <path d="M14 14.5V17c0 .8.6 1.2 1.2 1.5.9.5 1.8 1.6 1.8 3.5" />
            <path d="M4 22h16" />
          </svg>
        </div>

        <h2 className="font-display text-[30px] font-extrabold tracking-[-0.03em] text-ink mb-1">
          Puzzle complete
        </h2>
        <p className="text-ink-soft mb-6 text-sm">{title}</p>

        <div className="flex justify-center gap-8 mb-6">
          <div>
            <div className="text-2xl font-bold tabular-nums text-accent">{formatTime(elapsedSeconds)}</div>
            <div className="text-[11px] text-ink-soft uppercase tracking-[0.14em] mt-1">Time</div>
          </div>
          <div>
            <div className={`text-sm font-semibold px-3 py-1 rounded-full mt-1 ${difficultyColors[difficulty] ?? 'bg-sunken text-ink-soft'}`}>
              {difficultyLabel(difficulty)}
            </div>
            <div className="text-[11px] text-ink-soft uppercase tracking-[0.14em] mt-1">Difficulty</div>
          </div>
        </div>

        <p className="text-ink-soft text-sm mb-6">Nicely done.</p>

        <button
          onClick={onClose}
          className="w-full py-3.5 rounded-full bg-accent text-accent-ink font-bold transition-opacity hover:opacity-90"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
