'use client'

import type { Grid } from '@/lib/crossword/types'
import {
  CLUE_THREE_LINE_LIMIT,
  clueOverflowsThreeLines,
  startsAcross,
  startsDown,
} from '@/lib/crossword/utils'

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
  const longCount = entries.filter(e => clueOverflowsThreeLines(clues[e.number] ?? '')).length

  return (
    <div>
      <div className="flex items-baseline gap-3 mb-3">
        <h3 className="text-sm font-bold uppercase tracking-widest text-ink-soft">{title}</h3>
        {/* With 140 clues in a 21x21, a warning on one row is easy to scroll
            straight past — so count them up here too. */}
        {longCount > 0 && (
          <span data-clue-tally="" className="text-xs text-diff-4">
            {longCount} {longCount === 1 ? 'clue' : 'clues'} over{' '}
            {CLUE_THREE_LINE_LIMIT} characters
          </span>
        )}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-ink-soft italic">No {title.toLowerCase()} clues — check your grid.</p>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => (
            <div key={entry.number} className="flex gap-3 items-start">
              <div className="w-8 text-right shrink-0 pt-2">
                <span className="text-sm font-semibold text-ink-soft">{entry.number}</span>
              </div>
              <div className="shrink-0 pt-2">
                <span className="text-xs font-mono text-accent bg-accent-soft px-1.5 py-0.5 rounded">
                  {entry.answer} ({entry.answer.replace(/_/g, '').length})
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  placeholder="Enter clue…"
                  value={clues[entry.number] ?? ''}
                  onChange={e =>
                    onChange({ ...clues, [entry.number]: e.target.value })
                  }
                  aria-describedby={
                    clueOverflowsThreeLines(clues[entry.number] ?? '')
                      ? `clue-len-${title}-${entry.number}`
                      : undefined
                  }
                  className={
                    'w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 ' +
                    (clueOverflowsThreeLines(clues[entry.number] ?? '')
                      ? 'border-accent focus:ring-accent'
                      : 'border-line focus:ring-accent')
                  }
                />
                {/* Advisory only — long clues are allowed. See
                    CLUE_THREE_LINE_LIMIT for where the number comes from. */}
                {clueOverflowsThreeLines(clues[entry.number] ?? '') && (
                  <p
                    id={`clue-len-${title}-${entry.number}`}
                    data-clue-warning=""
                    className="mt-1 text-xs text-diff-4"
                  >
                    {(clues[entry.number] ?? '').trim().length} characters — over{' '}
                    {CLUE_THREE_LINE_LIMIT}, so on a narrow phone this clue will
                    scroll inside the clue bar instead of showing all at once.
                    Still fine to use.
                  </p>
                )}
              </div>
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
