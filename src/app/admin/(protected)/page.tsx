import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { difficultyLabel } from '@/lib/crossword/utils'

export const revalidate = 0

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: puzzles } = await supabase
    .from('puzzles')
    .select('id, title, difficulty, grid_size_rows, grid_size_cols, is_published, created_at')
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              ← Home
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Puzzle Admin</h1>
          </div>
          <Link
            href="/admin/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-white font-semibold text-sm transition-colors"
          >
            + New Puzzle
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {!puzzles || puzzles.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4">No puzzles yet.</p>
            <Link
              href="/admin/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold transition-colors"
            >
              Create your first puzzle
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Size</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 hidden md:table-cell">Difficulty</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {puzzles.map(puzzle => (
                  <tr key={puzzle.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-900">{puzzle.title}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {puzzle.grid_size_rows}×{puzzle.grid_size_cols}
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                      {difficultyLabel(puzzle.difficulty)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          puzzle.is_published
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {puzzle.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/puzzles/${puzzle.id}/edit`}
                        className="text-xs text-amber-600 hover:text-amber-800 font-medium"
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
