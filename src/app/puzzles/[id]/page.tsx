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

  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !data) notFound()

  const puzzle = rowToPuzzle(data)

  return <SolverClient puzzle={puzzle} />
}
