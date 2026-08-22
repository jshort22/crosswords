'use client'

import type { Grid, Direction, ThemeSet, ClueRef } from '@/lib/crossword/types'
import {
  CLUE_THREE_LINE_LIMIT,
  clueOverflowsThreeLines,
  refToString,
  sameRef,
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
  themeSet: ThemeSet
  onChangeThemeSet: (set: ThemeSet) => void
}

// Both roles are CHECKBOXES. A puzzle can carry more than one marquee — it was
// a radio when the model allowed only one, which made a second marquee
// impossible by construction; now that several are legitimate, a radio would be
// actively wrong. The two roles stay mutually exclusive per answer: an answer
// cannot be both a revealer and one of the things it reveals, so ticking one
// clears the other.

// The labels sit in a header row rather than on all 140 rows. Repeating
// "Marquee"/"Themer" per clue drowned the clues themselves.
function ThemeColumnHeader() {
  return (
    <div className="flex gap-3 items-center pb-1 pl-11">
      <div className="flex-1" />
      <div className="shrink-0 flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-ink-soft">
        <span className="w-14 text-center">Marquee</span>
        <span className="w-14 text-center">Themer</span>
      </div>
    </div>
  )
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
  direction,
  entries,
  clues,
  onChange,
  themeSet,
  onChangeThemeSet,
}: {
  title: string
  direction: Direction
  entries: ClueEntry[]
  clues: Record<number, string>
  onChange: (c: Record<number, string>) => void
  themeSet: ThemeSet
  onChangeThemeSet: (set: ThemeSet) => void
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
          <ThemeColumnHeader />
          {entries.map(entry => {
            const ref: ClueRef = { number: entry.number, direction }
            const isMarquee = themeSet.marquees.some(m => sameRef(m, ref))
            const isThemer = themeSet.themers.some(t => sameRef(t, ref))
            const label = `${entry.number} ${direction === 'across' ? 'Across' : 'Down'}`
            return (
            <div key={entry.number} className="flex gap-3 items-start">
              <div className="w-8 text-right shrink-0 pt-2">
                <span className="text-sm font-semibold text-ink-soft">{entry.number}</span>
              </div>
              <div className="shrink-0 pt-2">
                <span className="text-xs font-mono text-accent-soft-ink bg-accent-soft px-1.5 py-0.5 rounded">
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

              {/* Roles. Taking one clears the other — an answer cannot be both
                  the revealer and one of the things it reveals. */}
              <div className="shrink-0 pt-2 flex items-center gap-3">
                <span className="w-14 flex justify-center">
                  <input
                    type="checkbox"
                    data-marquee-checkbox={refToString(ref)}
                    checked={isMarquee}
                    aria-label={`Mark ${label} as a marquee answer`}
                    onChange={e =>
                      onChangeThemeSet({
                        marquees: e.target.checked
                          ? [...themeSet.marquees.filter(m => !sameRef(m, ref)), ref]
                          : themeSet.marquees.filter(m => !sameRef(m, ref)),
                        themers: themeSet.themers.filter(t => !sameRef(t, ref)),
                      })
                    }
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                </span>
                <span className="w-14 flex justify-center">
                  <input
                    type="checkbox"
                    data-themer-checkbox={refToString(ref)}
                    checked={isThemer}
                    aria-label={`Mark ${label} as a theme answer`}
                    onChange={e =>
                      onChangeThemeSet({
                        marquees: themeSet.marquees.filter(m => !sameRef(m, ref)),
                        themers: e.target.checked
                          ? [...themeSet.themers.filter(t => !sameRef(t, ref)), ref]
                          : themeSet.themers.filter(t => !sameRef(t, ref)),
                      })
                    }
                    className="w-4 h-4 accent-accent cursor-pointer"
                  />
                </span>
              </div>
            </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function ClueEditor({
  grid,
  cluesAcross,
  cluesDown,
  onChangeAcross,
  onChangeDown,
  themeSet,
  onChangeThemeSet,
}: Props) {
  const acrossEntries = buildEntries(grid, 'across')
  const downEntries = buildEntries(grid, 'down')

  const marqueeCount = themeSet.marquees.length
  const hasTheme = marqueeCount > 0 || themeSet.themers.length > 0
  // Advisory, never blocking — same posture as the clue-length warning. A theme
  // set is optional, and a half-finished one should say so rather than fail to
  // save. A themer list with no marquee has no hub, so the solver drops it.
  const warning =
    marqueeCount === 0 && themeSet.themers.length > 0
      ? 'No marquee chosen, so these theme answers will not highlight. Tick at least one.'
      // Two marquees light each other, so only a LONE marquee has nothing to point at.
      : marqueeCount === 1 && themeSet.themers.length === 0
      ? 'A single marquee with no theme answers has nothing to highlight.'
      : null

  return (
    <div className="space-y-8">
      {/* With up to 140 rows, checked boxes are impossible to find by scrolling,
          so the set is stated here. */}
      <div data-theme-summary="" className="border border-line rounded-xl p-4 bg-sunken">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h3 className="text-sm font-bold uppercase tracking-widest text-ink-soft">Theme</h3>
          {hasTheme ? (
            <button
              type="button"
              onClick={() => onChangeThemeSet({ marquees: [], themers: [] })}
              className="text-xs text-ink-soft underline hover:text-ink"
            >
              Clear theme
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-ink">
          {hasTheme ? (
            <>
              <span className="font-semibold">
                {marqueeCount > 0 ? themeSet.marquees.map(refToString).join(', ') : '—'}
              </span>{' '}
              {marqueeCount === 1 ? 'marquee' : 'marquees'}
              {themeSet.themers.length > 0 && (
                <>
                  {' · '}
                  {themeSet.themers.length}{' '}
                  {themeSet.themers.length === 1 ? 'theme answer' : 'theme answers'}{' '}
                  <span className="text-ink-soft">
                    ({themeSet.themers.map(refToString).join(', ')})
                  </span>
                </>
              )}
            </>
          ) : (
            <span className="text-ink-soft">
              No theme set. Optional — tick one or more marquees and their theme answers
              below to have them highlight each other in the solver.
            </span>
          )}
        </p>
        {warning && (
          <p data-theme-warning="" className="mt-2 text-xs text-diff-4">
            {warning}
          </p>
        )}
      </div>

      <ClueSection
        title="Across"
        direction="across"
        entries={acrossEntries}
        clues={cluesAcross}
        onChange={onChangeAcross}
        themeSet={themeSet}
        onChangeThemeSet={onChangeThemeSet}
      />
      <ClueSection
        title="Down"
        direction="down"
        entries={downEntries}
        clues={cluesDown}
        onChange={onChangeDown}
        themeSet={themeSet}
        onChangeThemeSet={onChangeThemeSet}
      />
    </div>
  )
}
