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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full text-center animate-pop-in">
        <div className="text-5xl mb-5">🏆</div>

        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-1 font-serif">
          Puzzle Complete!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm font-serif italic">{title}</p>

        <div className="flex justify-center gap-8 mb-6">
          <div>
            <div className="text-2xl font-bold font-mono text-amber-500">{formatTime(elapsedSeconds)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Time</div>
          </div>
          <div>
            <div className={`text-sm font-semibold px-3 py-1 rounded-full mt-1 ${difficultyColors[difficulty] ?? 'bg-gray-100 text-gray-600'}`}>
              {difficultyLabel(difficulty)}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-1">Difficulty</div>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-300 text-sm mb-6">
          You solved the puzzle! Great work!
        </p>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
