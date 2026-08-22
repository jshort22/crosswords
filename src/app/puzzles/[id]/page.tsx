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
          <h1 className="font-display text-xl font-semibold text-ink mb-2">
            Couldn&apos;t load this puzzle
          </h1>
          <p className="text-ink-soft mb-6">
            The puzzle database is unreachable. This puzzle still exists &mdash; try again in a
            moment.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-soft hover:text-ink bg-sunken rounded-full px-4 py-2.5 transition-colors"
          >
            ← All puzzles
          </Link>
        </div>
      </div>
    )
  }

  if (!data) notFound()

  const puzzle = rowToPuzzle(data)

  return <SolverClient puzzle={puzzle} />
}
