import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PuzzleCard from '@/components/PuzzleCard'
import ThemeToggle from '@/components/ThemeToggle'

export const revalidate = 60

export default async function HomePage() {
  const supabase = await createClient()

  const { data: puzzles } = await supabase
    .from('puzzles')
    .select('*')
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <h1 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight font-serif">
            Crossword Puzzles
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/admin"
              className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 transition-colors"
            >
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {!puzzles || puzzles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔤</div>
            <h2 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No puzzles yet</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Head to the admin area to create your first crossword.</p>
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
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
                  <h2 className="text-sm font-black tracking-widest uppercase text-gray-600 dark:text-gray-400 mb-4 pb-2">
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
                  <h2 className="text-sm font-black tracking-widest uppercase text-gray-600 dark:text-gray-400 mb-4 pb-2">
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
