'use client'

import type { Grid } from '@/lib/crossword/types'
import { startsAcross, startsDown } from '@/lib/crossword/utils'

interface ClueEntry {
  number: number
  answer: string
  clue: string
}

interface Props {
  grid: Grid
  cluesAcross: Record<number, string>
  cluesDown: Record<number, string>
  onChangeAcross: (clues: Record<number, string>) => void
  onChangeDown: (clues: Record<number, string>) => void
}

function buildEntries(grid: Grid, direction: 'across' | 'down'): ClueEntry[] {
  const entries: ClueEntry[] = []
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c]
      if (!cell.number) continue
      if (direction === 'across' && startsAcross(grid, r, c)) {
        const letters: string[] = []
        let cc = c
        while (cc < grid[r].length && grid[r][cc].type === 'white') {
          letters.push(grid[r][cc].letter || '_')
          cc++
        }
        entries.push({ number: cell.number, answer: letters.join(''), clue: '' })
      }
      if (direction === 'down' && startsDown(grid, r, c)) {
        const letters: string[] = []
        let rr = r
        while (rr < grid.length && grid[rr][c].type === 'white') {
          letters.push(grid[rr][c].letter || '_')
          rr++
        }
        entries.push({ number: cell.number, answer: letters.join(''), clue: '' })
      }
    }
  }
  return entries
}

function ClueSection({
  title,
  entries,
  clues,
  onChange,
}: {
  title: string
  entries: ClueEntry[]
  clues: Record<number, string>
  onChange: (c: Record<number, string>) => void
}) {
  return (
    <div>
      <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-3">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No {title.toLowerCase()} clues — check your grid.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.number} className="flex gap-3 items-start">
              <div className="w-8 text-right shrink-0 pt-2">
                <span className="text-sm font-semibold text-gray-500">{entry.number}</span>
              </div>
              <div className="shrink-0 pt-2">
                <span className="text-xs font-mono text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                  {entry.answer} ({entry.answer.replace(/_/g, '').length})
                </span>
              </div>
              <input
                type="text"
                placeholder="Enter clue…"
                value={clues[entry.number] ?? ''}
                onChange={e =>
                  onChange({ ...clues, [entry.number]: e.target.value })
                }
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ClueEditor({ grid, cluesAcross, cluesDown, onChangeAcross, onChangeDown }: Props) {
  const acrossEntries = buildEntries(grid, 'across')
  const downEntries = buildEntries(grid, 'down')

  return (
    <div className="space-y-8">
      <ClueSection
        title="Across"
        entries={acrossEntries}
        clues={cluesAcross}
        onChange={onChangeAcross}
      />
      <ClueSection
        title="Down"
        entries={downEntries}
        clues={cluesDown}
        onChange={onChangeDown}
      />
    </div>
  )
}
