import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToPuzzle } from '@/lib/crossword/utils'
import SolverClient from '@/components/solver/SolverClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PuzzlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  // maybeSingle() reports "no matching row" as data: null with no error, so a
  // genuinely missing puzzle stays distinguishable from a backend failure.
  // single() would surface both as an error and collapse the two cases.
  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (error) {
    console.error(`[PuzzlePage] Failed to load puzzle ${id}:`, error.message)
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2 font-serif">
            Couldn&apos;t load this puzzle
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            The puzzle database is unreachable. This puzzle still exists &mdash; try again in a
            moment.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 transition-colors"
          >
            ← All Puzzles
          </Link>
        </div>
      </div>
    )
  }

  if (!data) notFound()

  const puzzle = rowToPuzzle(data)

  return <SolverClient puzzle={puzzle} />
}
