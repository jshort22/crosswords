import type { PuzzleRow } from '@/lib/supabase/types'
import type { Json } from '@/lib/supabase/types'
import { difficultyLabel, difficultyColors } from '@/lib/crossword/utils'
import PuzzleCardActions from './PuzzleCardActions'

interface Props {
  puzzle: PuzzleRow
}

function GridThumbnail({ grid, rows, cols }: { grid: Json; rows: number; cols: number }) {
  const cells = grid as Array<Array<{ t: string }>>
  if (!cells?.length) return null

  const size = 120
  const cellW = size / cols
  const cellH = size / rows

  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {cells.map((row, r) =>
        row.map((cell, c) => (
          <rect
            key={`${r}-${c}`}
            x={c * cellW}
            y={r * cellH}
            width={cellW}
            height={cellH}
            fill={cell.t === 'b' ? '#1c1c1c' : '#ffffff'}
            stroke="#d1d5db"
            strokeWidth={0.5}
          />
        ))
      )}
    </svg>
  )
}

export default function PuzzleCard({ puzzle }: Props) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-700 border-b border-gray-100 dark:border-gray-600 py-4">
        <div className="rounded-lg overflow-hidden">
          <GridThumbnail grid={puzzle.grid} rows={puzzle.grid_size_rows} cols={puzzle.grid_size_cols} />
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h2 className="font-bold text-gray-900 dark:text-white text-lg leading-tight text-center font-serif">
          {puzzle.title}
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
            Grid: {puzzle.grid_size_rows}×{puzzle.grid_size_cols}
          </span>
          <span
            className={`text-xs font-semibold px-2 py-1 rounded-full ${
              difficultyColors[puzzle.difficulty] ?? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
            }`}
          >
            Difficulty: {difficultyLabel(puzzle.difficulty)}
          </span>
        </div>
        {puzzle.author && <p className="text-sm text-gray-500 dark:text-gray-400 text-center">By {puzzle.author}</p>}
        <PuzzleCardActions puzzleId={puzzle.id} />
      </div>
    </div>
  )
}
