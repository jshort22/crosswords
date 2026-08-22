import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PuzzleCard from '@/components/PuzzleCard'
import ThemeToggle from '@/components/ThemeToggle'

export default async function HomePage() {
  const supabase = await createClient()

  const { data: puzzles, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[HomePage] Failed to load puzzles:', error.message)
  }

  return (
    <div className="min-h-screen">
      <header className="pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 pt-5">
          <div className="bg-surface rounded-[18px] shadow-raise px-5 py-4 flex items-center justify-between">
          <h1 className="font-display text-[26px] font-extrabold tracking-[-0.03em] text-ink">
              Crossword Puzzles
            </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="hide-in-standalone text-xs font-medium text-ink-soft hover:text-ink bg-sunken rounded-full px-3.5 py-2.5 transition-colors"
            >
              Admin
            </Link>
          </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
        {error ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">⚠️</div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">
              Couldn&apos;t load puzzles
            </h2>
            <p className="text-ink-soft mb-6">
              The puzzle database is unreachable. This is a server problem, not an empty library
              &mdash; your puzzles are safe. Try again in a moment.
            </p>
          </div>
        ) : !puzzles || puzzles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔤</div>
            <h2 className="font-display text-xl font-semibold text-ink mb-2">No puzzles yet</h2>
            <p className="text-ink-soft mb-6">Head to the admin area to create your first crossword.</p>
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-accent text-accent-ink font-bold text-sm transition-opacity hover:opacity-90"
            >
              Create a Puzzle
            </Link>
          </div>
        ) : (() => {
          const byDifficulty = (a: typeof puzzles[0], b: typeof puzzles[0]) => a.difficulty - b.difficulty
          const small = puzzles.filter(p => p.grid_size_rows <= 15).sort(byDifficulty)
          const large = puzzles.filter(p => p.grid_size_rows > 15).sort(byDifficulty)
          return (
            <div className="space-y-10">
              {small.length > 0 && (
                <section>
                  <h2 className="font-display text-xs font-semibold tracking-[0.14em] uppercase text-accent mb-4">
                    15×15
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {small.map(puzzle => (
                      <PuzzleCard key={puzzle.id} puzzle={puzzle} />
                    ))}
                  </div>
                </section>
              )}
              {large.length > 0 && (
                <section>
                  <h2 className="font-display text-xs font-semibold tracking-[0.14em] uppercase text-accent mb-4">
                    21×21
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {large.map(puzzle => (
                      <PuzzleCard key={puzzle.id} puzzle={puzzle} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )
        })()}
      </main>
    </div>
  )
}
