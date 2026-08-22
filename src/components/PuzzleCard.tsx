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
            fill={cell.t === 'b' ? 'var(--cell-black)' : 'var(--cell)'}
            stroke="var(--cell-line)"
            strokeWidth={0.5}
          />
        ))
      )}
    </svg>
  )
}

export default function PuzzleCard({ puzzle }: Props) {
  return (
    <div className="bg-surface rounded-[20px] shadow-raise hover:-translate-y-1 transition-transform duration-200 flex flex-col overflow-hidden">
      <div className="flex items-center justify-center bg-sunken py-7">
        <div className="rounded-lg overflow-hidden">
          <GridThumbnail grid={puzzle.grid} rows={puzzle.grid_size_rows} cols={puzzle.grid_size_cols} />
        </div>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <h2 className="font-display font-semibold text-ink text-[19px] leading-tight tracking-[-0.02em] text-center">
          {puzzle.title}
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium px-2.5 py-1.5 rounded-full bg-sunken text-ink-soft">
            {puzzle.grid_size_rows}×{puzzle.grid_size_cols}
          </span>
          <span
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full ${
              difficultyColors[puzzle.difficulty] ?? 'bg-sunken text-ink-soft'
            }`}
          >
            {difficultyLabel(puzzle.difficulty)}
          </span>
        </div>
        {puzzle.author && <p className="text-sm text-ink-soft text-center">By {puzzle.author}</p>}
        <PuzzleCardActions puzzleId={puzzle.id} />
      </div>
    </div>
  )
}
