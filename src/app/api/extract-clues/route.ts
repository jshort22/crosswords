import { NextRequest } from 'next/server'

async function extractTextLines(data: Uint8Array): Promise<string[]> {
  const [pdfjsLib, pdfjsWorker] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore – no types for the worker build
    import('pdfjs-dist/legacy/build/pdf.worker.mjs'),
  ])
  // Run worker in-thread by exposing the worker module on globalThis
  ;(globalThis as Record<string, unknown>).pdfjsWorker = pdfjsWorker
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'unused'

  const pdf = await pdfjsLib.getDocument({ data }).promise

  const allLines: string[] = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    // Group text items by Y position (PDF Y=0 is bottom, so sort descending)
    const byY = new Map<number, { x: number; str: string }[]>()
    for (const raw of content.items) {
      const item = raw as { str: string; transform: number[] }
      if (!item.str?.trim()) continue
      const y = Math.round(item.transform[5])
      if (!byY.has(y)) byY.set(y, [])
      byY.get(y)!.push({ x: item.transform[4], str: item.str })
    }

    const sortedYs = [...byY.keys()].sort((a, b) => b - a)
    for (const y of sortedYs) {
      const line = byY.get(y)!
        .sort((a, b) => a.x - b.x)
        .map(i => i.str)
        .join(' ')
        .trim()
      if (line) allLines.push(line)
    }
  }

  return allLines
}

function parseClues(lines: string[]): {
  cluesAcross: Record<string, string>
  cluesDown: Record<string, string>
} {
  const cluesAcross: Record<string, string> = {}
  const cluesDown: Record<string, string> = {}
  let section: 'across' | 'down' | null = null
  let currentNum: number | null = null
  let currentClue = ''

  const commit = () => {
    if (currentNum === null || !currentClue.trim()) return
    // Strip trailing all-caps answer (e.g., "APES", "RUSTPROOF", "THECLAW")
    const clue = currentClue.trim().replace(/\s+[A-Z]{2,}$/, '').trim()
    if (!clue) return
    if (section === 'across') cluesAcross[String(currentNum)] = clue
    else if (section === 'down') cluesDown[String(currentNum)] = clue
    currentNum = null
    currentClue = ''
  }

  for (const line of lines) {
    if (/^across$/i.test(line)) { commit(); section = 'across'; continue }
    if (/^down$/i.test(line)) { commit(); section = 'down'; continue }
    if (!section) continue

    const match = line.match(/^(\d+)\s+(.+)$/)
    if (match) {
      commit()
      currentNum = parseInt(match[1], 10)
      currentClue = match[2]
    } else if (currentNum !== null) {
      currentClue += ' ' + line
    }
  }
  commit()

  return { cluesAcross, cluesDown }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ error: 'No file provided' }, { status: 400 })
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return Response.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const lines = await extractTextLines(bytes)
    const result = parseClues(lines)

    return Response.json(result)
  } catch (err) {
    console.error('[extract-clues]', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Extraction failed' },
      { status: 500 }
    )
  }
}
