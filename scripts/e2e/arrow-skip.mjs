// Same seeded board, but navigate with the ‹ › clue-bar arrow / Tab instead of
// typing. These deliberately visit every clue — so how often do they land on an
// answer that is already complete?
import { chromium, devices } from 'playwright'
import fs from 'fs'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const R = grid.length, C = grid[0].length
const idx = (r, c) => r * C + c
const white = (r, c) => r >= 0 && r < R && c >= 0 && c < C && grid[r][c].t === 'w'
const across = [], down = []
for (let r = 0; r < R; r++) for (let c = 0; c < C; c++)
  if (white(r, c) && !white(r, c - 1) && white(r, c + 1)) {
    const cells = []; for (let cc = c; white(r, cc); cc++) cells.push([r, cc]); across.push({ n: grid[r][c].n, cells, dir: 'A' })
  }
for (let c = 0; c < C; c++) for (let r = 0; r < R; r++)
  if (white(r, c) && !white(r - 1, c) && white(r + 1, c)) {
    const cells = []; for (let rr = r; white(rr, c); rr++) cells.push([rr, c]); down.push({ n: grid[r][c].n, cells, dir: 'D' })
  }
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const SEL = '[data-grid] > div'
await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector(SEL)
const cellsLoc = page.locator(SEL)
const key = l => page.locator(`div[aria-label="Letter keyboard"] button:text-is("${l}")`)
// Seed the top 6 rows of Across
for (const w of across.filter(w => w.cells[0][0] < 6))
  for (const [r, c] of w.cells) { await cellsLoc.nth(idx(r, c)).tap(); await key(grid[r][c].l).tap() }

const snap = () => page.evaluate(s => {
  const cells = [...document.querySelectorAll(s)]
  return { i: cells.findIndex(d => d.hasAttribute('data-active')),
           letters: cells.map(d => d.textContent.replace(/[0-9]/g, '').trim()) }
}, SEL)
const barText = () => page.locator('div.touch-target button.flex-1').first().innerText()

await cellsLoc.nth(idx(0, 0)).tap()
let full = 0, total = 0
console.log('walking the ‹ › arrow 16 times from 1-Across:\n')
for (let k = 0; k < 16; k++) {
  await page.locator('button[aria-label="Next clue"]').tap()
  const s = await snap()
  const r = Math.floor(s.i / C), c = s.i % C
  const label = (await barText()).split('\n')[0].trim().slice(0, 4)
  const w = [...across, ...down].find(w => w.cells.some(([rr, cc]) => rr === r && cc === c) &&
                                            label.startsWith(String(w.n)) && label.includes(w.dir))
  const cells = w ? w.cells : []
  const blanks = cells.filter(([rr, cc]) => !s.letters[idx(rr, cc)]).length
  total++
  if (cells.length && blanks === 0) full++
  console.log(`  ${String(label).padEnd(5)} cursor [${r},${c}]  ${cells.length} cells, ${blanks} blank` +
    (cells.length && blanks === 0 ? '   <-- ALREADY COMPLETE, cursor sits on its first letter' : ''))
}
console.log(`\n${full} of ${total} arrow presses landed on an already-complete answer`)
await b.close()
