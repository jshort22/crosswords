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
    <div className="min-h-screen bg-sunken">
      <header className="bg-surface border-b border-line">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a
              href="/admin"
              className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink border border-line rounded-lg px-3 py-1.5 transition-colors shrink-0"
            >
              ← Admin
            </a>
            <h1 className="text-xl font-bold text-ink">{puzzle.title}</h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 rounded-lg border border-line text-sm font-medium text-ink hover:bg-sunken transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </button>
            <button
              onClick={() => handleSave(!puzzle.is_published)}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-accent hover:opacity-90 text-accent-ink text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {puzzle.is_published ? 'Unpublish' : 'Publish'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {error && (
          <div className="bg-danger-soft border border-danger rounded-xl p-3 text-sm text-danger">{error}</div>
        )}

        {/* Metadata */}
        <section className="bg-surface rounded-xl border border-line p-5 space-y-4">
          <h2 className="font-semibold text-ink">Details</h2>
          <div>
            <label className="block text-xs text-ink-soft mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full border border-line rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-soft mb-2">Difficulty</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(d => (
                <button
                  key={d}
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                    difficulty === d
                      ? 'bg-accent border-accent text-accent-ink'
                      : 'border-line text-ink-soft hover:border-accent'
                  }`}
                >
                  {difficultyLabel(d)}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Grid */}
        <section className="bg-surface rounded-xl border border-line p-5">
          <h2 className="font-semibold text-ink mb-4">Grid</h2>
          <div className="overflow-x-auto">
            <GridEditor grid={grid} onChange={setGrid} />
          </div>
        </section>

        {/* Clues */}
        <section className="bg-surface rounded-xl border border-line p-5">
          <h2 className="font-semibold text-ink mb-4">Clues</h2>
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
            className="px-5 py-2.5 rounded-xl border border-line text-ink-soft hover:bg-sunken font-medium text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-accent hover:opacity-90 text-accent-ink font-semibold text-sm disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  )
}
