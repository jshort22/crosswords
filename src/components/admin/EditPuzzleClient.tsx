'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { PuzzleRow } from '@/lib/supabase/types'
import { deserializeGrid, serializeGrid, numberGrid, difficultyLabel } from '@/lib/crossword/utils'
import GridEditor from './GridEditor'
import ClueEditor from './ClueEditor'

interface Props {
  puzzle: PuzzleRow
}

export default function EditPuzzleClient({ puzzle }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [title, setTitle] = useState(puzzle.title)
  const [difficulty, setDifficulty] = useState(puzzle.difficulty)
  const [grid, setGrid] = useState(() => numberGrid(deserializeGrid(puzzle.grid)))
  const [cluesAcross, setCluesAcross] = useState<Record<number, string>>(
    (puzzle.clues_across as Record<number, string>) ?? {}
  )
  const [cluesDown, setCluesDown] = useState<Record<number, string>>(
    (puzzle.clues_down as Record<number, string>) ?? {}
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = useCallback(
    async (publish?: boolean) => {
      setSaving(true)
      setError('')
      try {
        const payload = {
          title,
          difficulty,
          grid: serializeGrid(grid),
          grid_size_rows: grid.length,
          grid_size_cols: grid[0]?.length ?? 0,
          clues_across: cluesAcross as unknown,
          clues_down: cluesDown as unknown,
          updated_at: new Date().toISOString(),
          ...(publish !== undefined ? { is_published: publish } : {}),
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: err } = await (supabase.from('puzzles') as any)
          .update(payload)
          .eq('id', puzzle.id)

        if (err) throw new Error(err.message)
        router.push('/admin')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unknown error')
        setSaving(false)
      }
    },
    [supabase, puzzle.id, title, difficulty, grid, cluesAcross, cluesDown, router]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors shrink-0"
            >
              ← Admin
            </a>
            <h1 className="text-xl font-bold text-gray-900">{puzzle.title}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(!puzzle.is_published)}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-white text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {puzzle.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Metadata */}
        <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">Details</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-2">Difficulty</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    difficulty === d
                      ? 'bg-amber-400 border-amber-400 text-white'
                      : 'border-gray-200 text-gray-600 hover:border-amber-300'
                  }`}
                >
                  {difficultyLabel(d)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Grid</h2>
          <div className="overflow-x-auto">
            <GridEditor grid={grid} onChange={setGrid} />
          </div>
        </section>

        {/* Clues */}
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-800 mb-4">Clues</h2>
          <ClueEditor
            grid={grid}
            cluesAcross={cluesAcross}
            cluesDown={cluesDown}
            onChangeAcross={setCluesAcross}
            onChangeDown={setCluesDown}
          />
        </section>

        <div className="flex justify-end gap-3 pb-8">
          <button
            onClick={() => router.push('/admin')}
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  )
}
