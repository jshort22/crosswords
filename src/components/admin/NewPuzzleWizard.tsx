'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Grid } from '@/lib/crossword/types'
import { createEmptyGrid, numberGrid, serializeGrid, buildClues, difficultyLabel } from '@/lib/crossword/utils'
import StepIndicator from './StepIndicator'
import GridEditor from './GridEditor'
import ClueEditor from './ClueEditor'
import SolverClient from '@/components/solver/SolverClient'

// ── Step 1: Metadata ──────────────────────────────────────────────────────────

interface Metadata {
  title: string
  difficulty: number
}

function MetadataStep({
  value,
  onChange,
  onNext,
}: {
  value: Metadata
  onChange: (m: Metadata) => void
  onNext: () => void
}) {
  const valid = value.title.trim().length > 0 && value.difficulty >= 1 && value.difficulty <= 5

  return (
    <div className="space-y-5 max-w-md">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          value={value.title}
          onChange={e => onChange({ ...value, title: e.target.value })}
          placeholder="My Crossword"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Difficulty: <strong>{difficultyLabel(value.difficulty)}</strong>
        </label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map(d => (
            <button
              key={d}
              onClick={() => onChange({ ...value, difficulty: d })}
              className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                value.difficulty === d
                  ? 'bg-amber-400 border-amber-400 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-amber-300'
              }`}
            >
              {difficultyLabel(d)}
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={!valid}
          className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white text-lg font-bold transition-colors flex items-center justify-center"
          title="Next: Build Grid"
        >
          →
        </button>
      </div>
    </div>
  )
}

// ── Step 2: Grid Editor ───────────────────────────────────────────────────────

function GridEditorStep({
  grid,
  onGridChange,
  onNext,
  onBack,
}: {
  grid: Grid
  onGridChange: (g: Grid) => void
  onNext: () => void
  onBack: () => void
}) {
  const [rows, setRows] = useState(grid.length)
  const [cols, setCols] = useState(grid[0]?.length ?? 15)

  const applySize = () => {
    const newGrid = numberGrid(createEmptyGrid(rows, cols))
    onGridChange(newGrid)
  }

  // Validate: every white cell has a letter
  const allFilled = grid.every(row =>
    row.every(cell => cell.type === 'black' || cell.letter.trim() !== '')
  )

  const applyPreset = (r: number, c: number) => {
    setRows(r)
    setCols(c)
    onGridChange(numberGrid(createEmptyGrid(r, c)))
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Preset</label>
          <div className="flex gap-2">
            {([15, 21] as const).map(n => (
              <button
                key={n}
                onClick={() => applyPreset(n, n)}
                className={`py-1.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                  rows === n && cols === n
                    ? 'bg-amber-400 border-amber-400 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-amber-300'
                }`}
              >
                {n}×{n}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Rows</label>
          <input
            type="number"
            min={3}
            max={25}
            value={rows}
            onChange={e => setRows(Number(e.target.value))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cols</label>
          <input
            type="number"
            min={3}
            max={25}
            value={cols}
            onChange={e => setCols(Number(e.target.value))}
            className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
          />
        </div>
        <button
          onClick={applySize}
          className="py-1.5 px-4 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          Resize (clears grid)
        </button>
      </div>

      <div className="overflow-x-auto">
        <GridEditor grid={grid} onChange={onGridChange} />
      </div>

      {!allFilled && (
        <p className="text-xs text-orange-500">
          Some white cells are missing letters — you&apos;ll need to fill them all before publishing.
        </p>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-lg font-bold transition-colors flex items-center justify-center"
          title="Back"
        >
          ←
        </button>
        <button
          onClick={onNext}
          className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-lg font-bold transition-colors flex items-center justify-center"
          title="Next: Enter Clues"
        >
          →
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Clues ─────────────────────────────────────────────────────────────

type UploadStatus = 'idle' | 'uploading' | 'done' | 'error'

function CluesStep({
  grid,
  cluesAcross,
  cluesDown,
  sourceFileUrl,
  onChangeAcross,
  onChangeDown,
  onUpload,
  onNext,
  onBack,
}: {
  grid: Grid
  cluesAcross: Record<number, string>
  cluesDown: Record<number, string>
  sourceFileUrl: string | null
  onChangeAcross: (c: Record<number, string>) => void
  onChangeDown: (c: Record<number, string>) => void
  onUpload: (file: File) => Promise<void>
  onNext: () => void
  onBack: () => void
}) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle')
  const [uploadError, setUploadError] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [dragging, setDragging] = useState(false)

  const processFile = async (file: File) => {
    setUploadError('')
    setUploadStatus('uploading')
    try {
      await onUpload(file)
      setUploadStatus('done')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadStatus('error')
      return
    }

    // Auto-extract clues from PDFs
    if (file.name.toLowerCase().endsWith('.pdf')) {
      setExtracting(true)
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/extract-clues', { method: 'POST', body: form })
        const data = await res.json() as { cluesAcross?: Record<string, string>; cluesDown?: Record<string, string>; error?: string }
        if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
        const toNumKeys = (r: Record<string, string>): Record<number, string> =>
          Object.fromEntries(Object.entries(r).map(([k, v]) => [parseInt(k, 10), v]))
        if (data.cluesAcross && Object.keys(data.cluesAcross).length > 0)
          onChangeAcross(toNumKeys(data.cluesAcross))
        if (data.cluesDown && Object.keys(data.cluesDown).length > 0)
          onChangeDown(toNumKeys(data.cluesDown))
      } catch (err) {
        setUploadError(`Clue extraction failed: ${err instanceof Error ? err.message : String(err)}`)
      }
      setExtracting(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); if (uploadStatus !== 'uploading') setDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false) }
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (uploadStatus === 'uploading') return
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  const isPdf = sourceFileUrl?.toLowerCase().includes('.pdf')

  return (
    <div className="space-y-5">
      <div className={`flex gap-6 ${sourceFileUrl ? 'flex-col lg:flex-row' : ''}`}>
        {/* PDF reference panel */}
        <div className={sourceFileUrl ? 'lg:w-1/2 space-y-2' : 'space-y-2'}>
          <label
            className={`flex items-center gap-2 border border-dashed rounded-xl px-4 py-3 transition-colors ${
              uploadStatus === 'uploading'
                ? 'opacity-60 cursor-not-allowed border-gray-200'
                : dragging
                ? 'border-amber-400 bg-amber-50 cursor-copy'
                : 'cursor-pointer hover:border-amber-300 border-gray-200'
            }`}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <span className="text-lg">{uploadStatus === 'uploading' ? '⏳' : extracting ? '🔍' : uploadStatus === 'done' ? '✅' : '📄'}</span>
            <span className="text-sm text-gray-500">
              {uploadStatus === 'uploading'
                ? 'Uploading…'
                : extracting
                ? 'Reading clues…'
                : sourceFileUrl
                ? 'Replace PDF / image'
                : 'Upload PDF or image as reference'}
            </span>
            <input
              type="file"
              accept="image/*,.pdf"
              className="sr-only"
              disabled={uploadStatus === 'uploading' || extracting}
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
            />
          </label>

          {uploadError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
          )}

          {sourceFileUrl && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              {isPdf ? (
                <iframe
                  src={`${sourceFileUrl}#page=2`}
                  className="w-full"
                  style={{ height: '60vh' }}
                  title="PDF clues reference"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sourceFileUrl} alt="Clues reference" className="w-full object-contain" style={{ maxHeight: '60vh' }} />
              )}
            </div>
          )}
        </div>

        {/* Clue editor */}
        <div className={sourceFileUrl ? 'lg:w-1/2' : 'w-full'}>
          <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
            <ClueEditor
              grid={grid}
              cluesAcross={cluesAcross}
              cluesDown={cluesDown}
              onChangeAcross={onChangeAcross}
              onChangeDown={onChangeDown}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 text-lg font-bold transition-colors flex items-center justify-center"
          title="Back"
        >
          ←
        </button>
        <button
          onClick={onNext}
          className="w-10 h-10 rounded-full bg-amber-400 hover:bg-amber-500 text-white text-lg font-bold transition-colors flex items-center justify-center"
          title="Next: Preview & Publish"
        >
          →
        </button>
      </div>
    </div>
  )
}

// ── Step 5: Preview & Publish ─────────────────────────────────────────────────

function PreviewStep({
  metadata,
  grid,
  cluesAcross,
  cluesDown,
  sourceFileUrl,
  onBack,
  onPublish,
}: {
  metadata: Metadata
  grid: Grid
  cluesAcross: Record<number, string>
  cluesDown: Record<number, string>
  sourceFileUrl: string | null
  onBack: () => void
  onPublish: (publish: boolean) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Build preview puzzle
  const { across, down } = buildClues(grid, cluesAcross, cluesDown)
  const previewPuzzle = {
    id: 'preview',
    title: metadata.title,
    author: null,
    difficulty: metadata.difficulty,
    rows: grid.length,
    cols: grid[0]?.length ?? 0,
    grid,
    cluesAcross: across,
    cluesDown: down,
    sourceFileUrl,
    isPublished: false,
    createdAt: new Date().toISOString(),
  }

  const allFilled = grid.every(row => row.every(cell => cell.type === 'black' || cell.letter.trim() !== ''))

  const missingClues = [
    ...across.filter(c => !c.clue).map(c => `${c.number} Across`),
    ...down.filter(c => !c.clue).map(c => `${c.number} Down`),
  ]

  const handleSave = async (publish: boolean) => {
    setSaving(true)
    setError('')
    try {
      await onPublish(publish)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm space-y-1">
        <p><strong>Title:</strong> {metadata.title}</p>
        <p><strong>Difficulty:</strong> {difficultyLabel(metadata.difficulty)}</p>
        <p><strong>Grid:</strong> {grid.length}×{grid[0]?.length}</p>
        <p><strong>Across clues:</strong> {across.length} ({across.filter(c => c.clue).length} filled)</p>
        <p><strong>Down clues:</strong> {down.length} ({down.filter(c => c.clue).length} filled)</p>
      </div>

      {!allFilled && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
          <strong>Grid incomplete:</strong> some white cells are missing solution letters. Publishing is disabled until all cells are filled.
        </div>
      )}

      {missingClues.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-xs text-orange-700">
          <strong>Missing clues:</strong> {missingClues.join(', ')}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700">
          {error}
        </div>
      )}

      <details className="border border-gray-200 rounded-xl overflow-hidden">
        <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50">
          Preview puzzle (interactive)
        </summary>
        <div className="overflow-auto max-h-[60vh] p-4 bg-gray-50">
          <SolverClient puzzle={previewPuzzle} />
        </div>
      </details>

      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={saving}
          className="w-10 h-10 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 text-lg font-bold transition-colors flex items-center justify-center"
          title="Back"
        >
          ←
        </button>
        <div className="flex gap-3">
          <button
            onClick={() => handleSave(false)}
            disabled={saving}
            className="py-2.5 px-4 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 font-medium text-sm transition-colors disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save as Draft'}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !allFilled}
            title={!allFilled ? 'Fill all grid cells before publishing' : undefined}
            className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-500 disabled:opacity-40 text-white font-semibold text-sm transition-colors"
          >
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Wizard orchestrator ───────────────────────────────────────────────────────

export default function NewPuzzleWizard() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState(0)
  const [metadata, setMetadata] = useState<Metadata>({ title: '', difficulty: 3 })
  const [sourceFileUrl, setSourceFileUrl] = useState<string | null>(null)
  const [grid, setGrid] = useState<Grid>(() => numberGrid(createEmptyGrid(15, 15)))
  const [cluesAcross, setCluesAcross] = useState<Record<number, string>>({})
  const [cluesDown, setCluesDown] = useState<Record<number, string>>({})

  const handleUpload = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `uploads/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('puzzle-sources').upload(path, file)
    if (error) throw new Error(error.message)
    const { data } = supabase.storage.from('puzzle-sources').getPublicUrl(path)
    setSourceFileUrl(data.publicUrl)
  }, [supabase])


  const handlePublish = useCallback(async (publish: boolean) => {
    const serializedGrid = serializeGrid(grid)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('puzzles') as any).insert({
      title: metadata.title,
      author: null,
      difficulty: metadata.difficulty,
      grid_size_rows: grid.length,
      grid_size_cols: grid[0]?.length ?? 0,
      grid: serializedGrid,
      clues_across: cluesAcross as unknown,
      clues_down: cluesDown as unknown,
      solution: serializedGrid,
      source_file_url: sourceFileUrl,
      is_published: publish,
    })

    if (error) throw new Error(error.message)
    router.push(`/admin`)
  }, [supabase, metadata, grid, cluesAcross, cluesDown, sourceFileUrl, router])

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3 mb-3">
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            ← Admin
          </a>
          <StepIndicator current={step} />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {['Puzzle Details', 'Build Grid', 'Enter Clues', 'Preview & Publish'][step]}
        </h1>

        {step === 0 && (
          <MetadataStep value={metadata} onChange={setMetadata} onNext={() => setStep(1)} />
        )}
        {step === 1 && (
          <GridEditorStep
            grid={grid}
            onGridChange={setGrid}
            onNext={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <CluesStep
            grid={grid}
            cluesAcross={cluesAcross}
            cluesDown={cluesDown}
            sourceFileUrl={sourceFileUrl}
            onChangeAcross={setCluesAcross}
            onChangeDown={setCluesDown}
            onUpload={handleUpload}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}
        {step === 3 && (
          <PreviewStep
            metadata={metadata}
            grid={grid}
            cluesAcross={cluesAcross}
            cluesDown={cluesDown}
            sourceFileUrl={sourceFileUrl}
            onBack={() => setStep(2)}
            onPublish={handlePublish}
          />
        )}
      </main>
    </div>
  )
}
