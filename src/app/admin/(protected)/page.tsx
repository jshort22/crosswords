import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { difficultyLabel } from '@/lib/crossword/utils'

export const revalidate = 0

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: puzzles, error } = await supabase
    .from('puzzles')
    .select('id, title, difficulty, grid_size_rows, grid_size_cols, is_published, created_at')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[AdminPage] Failed to load puzzles:', error.message)
  }

  return (
    <div className="min-h-screen bg-sunken">
      <header className="bg-surface border-b border-line">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink border border-line rounded-lg px-3 py-1.5 transition-colors"
            >
              ← Home
            </Link>
            <h1 className="text-xl font-bold text-ink">Puzzle Admin</h1>
          </div>
          <Link
            href="/admin/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent hover:opacity-90 text-accent-ink font-semibold text-sm transition-colors"
          >
            + New Puzzle
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {error ? (
          <div className="rounded-xl border border-danger bg-danger-soft px-4 py-6 text-center">
            <p className="font-semibold text-danger mb-1">Couldn&apos;t load puzzles</p>
            <p className="text-sm text-danger mb-3">
              The database query failed &mdash; this is not an empty library. Check that the Supabase
              project is running and not paused.
            </p>
            <code className="inline-block text-xs text-danger/70 bg-danger-soft rounded px-2 py-1">
              {error.message}
            </code>
          </div>
        ) : !puzzles || puzzles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-ink-soft mb-4">No puzzles yet.</p>
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 text-accent-ink font-semibold transition-colors"
            >
              Create your first puzzle
            </Link>
          </div>
        ) : (
          <div className="bg-surface rounded-xl border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line bg-sunken">
                  <th className="text-left px-4 py-3 font-semibold text-ink-soft">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-soft hidden md:table-cell">Size</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-soft hidden md:table-cell">Difficulty</th>
                  <th className="text-left px-4 py-3 font-semibold text-ink-soft">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {puzzles.map(puzzle => (
                  <tr key={puzzle.id} className="border-b border-line hover:bg-sunken/50">
                    <td className="px-4 py-3 font-medium text-ink">{puzzle.title}</td>
                    <td className="px-4 py-3 text-ink-soft hidden md:table-cell">
                      {puzzle.grid_size_rows}×{puzzle.grid_size_cols}
                    </td>
                    <td className="px-4 py-3 text-ink-soft hidden md:table-cell">
                      {difficultyLabel(puzzle.difficulty)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          puzzle.is_published
                            ? 'bg-diff-1-soft text-diff-1'
                            : 'bg-sunken text-ink-soft'
                        }`}
                      >
                        {puzzle.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/puzzles/${puzzle.id}/edit`}
                        className="text-xs text-accent hover:text-accent-soft-ink font-medium"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
