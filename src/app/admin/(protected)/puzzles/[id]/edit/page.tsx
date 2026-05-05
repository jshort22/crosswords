import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EditPuzzleClient from '@/components/admin/EditPuzzleClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function EditPuzzlePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('puzzles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !data) notFound()

  return <EditPuzzleClient puzzle={data} />
}
