// A saved progress record is restored WHOLESALE with no validation, and the
// admin can change a published puzzle's grid. So: what happens to someone
// holding a record that no longer matches the grid?
import { chromium } from 'playwright'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'   // 15x15
const b = await chromium.launch()
const KEY = `crossword-progress-${ID}`
const mkCells = (n, letter) => Array.from({ length: n }, () =>
  Array.from({ length: n }, () => ({ userLetter: letter, isRevealed: false, isChecked: false, isCorrect: null })))

const cases = [
  ['record SMALLER than grid (5x5 on a 15x15)', { cells: mkCells(5, 'Z'), elapsed: 30 }],
  ['record LARGER than grid (21x21 on a 15x15)', { cells: mkCells(21, 'Z'), elapsed: 30 }],
  ['record right size, letters on every cell incl. black', { cells: mkCells(15, 'Z'), elapsed: 30 }],
  ['garbage shape (cells not an array)', { cells: 'nope', elapsed: 5 }],
  ['null cells', { cells: null, elapsed: 5 }],
]

for (const [label, rec] of cases) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errs = []
  page.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 120)))
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message.slice(0, 120)))
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, rec])
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  const r = await page.evaluate(() => {
    const grid = document.querySelector('.grid.select-none')
    if (!grid) return { rendered: false }
    const cells = [...grid.children]
    return {
      rendered: true,
      filledWhite: cells.filter(d => !d.className.includes('bg-black') &&
        [...d.querySelectorAll('span')].some(s => !s.className.includes('absolute') && s.textContent.trim())).length,
      blackWithText: cells.filter(d => d.className.includes('bg-black') && d.textContent.trim()).length,
      timer: document.querySelector('.font-mono.tabular-nums')?.textContent?.trim(),
    }
  })
  console.log(`${errs.length || !r.rendered ? 'PROBLEM' : 'ok     '}  ${label}`)
  console.log(`         grid rendered=${r.rendered} filledWhiteCells=${r.filledWhite ?? '-'} blackCellsShowingText=${r.blackWithText ?? '-'} timer=${r.timer ?? '-'}`)
  if (errs.length) console.log(`         ERRORS: ${JSON.stringify([...new Set(errs)].slice(0, 3))}`)
  await ctx.close()
}
await b.close()
