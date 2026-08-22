// Backspace must delete BACKWARDS THROUGH THE PUZZLE, not stop at every word.
//
// The bug: RETREAT used prevCellInWord, which deliberately stays inside the
// word and returns the SAME cell at a word's first square. So backspace cleared
// a word fine and then died at the black square — holding the key did nothing
// at all. ADVANCE has a word-jump for this case; RETREAT never got one.
//
// Positioning trap (see skipfilled.mjs): clicking the already-active cell
// toggles direction, so go() clicks a scratch cell first, then nudges with the
// arrows to force a known direction.
import { chromium } from 'playwright'
import fs from 'fs'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const rows = grid.length, cols = grid[0].length
const idx = (r, c) => r * cols + c
const white = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].t === 'w'

// Clue lists in the same order the app builds them (reading order of starts).
const words = dir => {
  const out = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0]
      if (white(r, c) && !white(r - dr, c - dc) && white(r + dr, c + dc)) {
        const cells = []
        for (let rr = r, cc = c; white(rr, cc); rr += dr, cc += dc) cells.push([rr, cc])
        out.push(cells)
      }
    }
  return out
}
const ACROSS = words('across'), DOWN = words('down')

// Three consecutive across words, and a scratch cell outside all of them.
let k = -1
for (let i = 1; i + 2 < ACROSS.length; i++)
  if ([i, i + 1, i + 2].every(j => ACROSS[j].length >= 3)) { k = i; break }
const [W0, W1, W2] = [ACROSS[k], ACROSS[k + 1], ACROSS[k + 2]]
const used = new Set([...W0, ...W1, ...W2].map(([r, c]) => `${r},${c}`))
let scratch = null
for (let r = rows - 1; r >= 0 && !scratch; r--)
  for (let c = 0; c < cols; c++)
    if (white(r, c) && !used.has(`${r},${c}`)) { scratch = [r, c]; break }

const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
page.on('console', m => m.type() === 'error' && errs.push(m.text()))
page.on('pageerror', e => errs.push(String(e)))
const SEL = '[data-grid] > div'
let pass = 0, fail = 0

const fresh = async () => {
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
}
const active = () => page.evaluate(s =>
  [...document.querySelectorAll(s)].findIndex(d => d.hasAttribute('data-active')), SEL)
const letters = () => page.evaluate(s =>
  [...document.querySelectorAll(s)].map(d => (d.textContent || '').replace(/[0-9]/g, '').trim()), SEL)
const letterAt = async (r, c) => (await letters())[idx(r, c)]
const fmt = i => i < 0 ? 'none' : `[${Math.floor(i / cols)},${i % cols}]`
const go = async ([r, c], dir = 'across') => {
  await page.locator(SEL).nth(idx(...scratch)).click()
  await page.locator(SEL).nth(idx(r, c)).click()
  const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0]
  const fwd = dir === 'across' ? 'ArrowRight' : 'ArrowDown'
  const back = dir === 'across' ? 'ArrowLeft' : 'ArrowUp'
  if (white(r + dr, c + dc)) { await page.keyboard.press(fwd); await page.keyboard.press(back) }
  else { await page.keyboard.press(back); await page.keyboard.press(fwd) }
}
const press = async (key, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(key) }
const ok = (label, cond, detail = '') => {
  cond ? pass++ : fail++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`)
}
const atCell = async (label, cell) => {
  const got = await active()
  ok(label, got === idx(...cell), `cursor ${fmt(got)}, expected [${cell}]`)
}

console.log(`across words #${k}/${k+1}/${k+2} lengths ${W0.length}/${W1.length}/${W2.length}; scratch [${scratch}]`)

console.log('\n--- A. within a word (regression: unchanged) ---')
await fresh()
await go(W1[0])
await press('A', W1.length)                       // fills W1, auto-advances onward
await go(W1[W1.length - 1])
await press('Backspace')                          // clears the cell it is on
ok('backspace clears the current letter', (await letterAt(...W1[W1.length - 1])) === '')
await atCell('cursor stays put on that first press', W1[W1.length - 1])
await press('Backspace')                          // now empty -> step left and clear
await atCell('second press steps left within the word', W1[W1.length - 2])
ok('and deletes there', (await letterAt(...W1[W1.length - 2])) === '')

console.log('\n--- B. THE BUG: at a word\'s first cell it must cross the boundary ---')
await fresh()
await go(W0[0]); await press('A', W0.length)      // fill W0
await go(W1[0]); await press('A', W1.length)      // fill W1
await go(W1[0])                                   // sit on W1's first cell
await press('Backspace')                          // clears it, cursor holds
await atCell('after clearing the first cell, cursor holds', W1[0])
await press('Backspace')                          // <-- used to do NOTHING
const tail = W0[W0.length - 1]
await atCell('crosses into the previous word', tail)
ok('and deletes that word\'s last letter', (await letterAt(...tail)) === '', `cell [${tail}]`)

console.log('\n--- C. held backspace empties everything it typed ---')
await fresh()
await go(W0[0])
const typed = W0.length + W1.length + W2.length
await press('A', typed)                           // auto-advance carries across words
const before = (await letters()).filter(Boolean).length
ok('typing filled cells across words', before >= typed, `${before} letters on the grid`)
const seen = new Set()
for (let i = 0; i < before + 10; i++) { seen.add(await active()); await press('Backspace') }
const after = (await letters()).filter(Boolean).length
ok('held backspace emptied the grid', after === 0, `${before} letters -> ${after}`)
ok('cursor never got stuck', seen.size > 3, `${seen.size} distinct cursor positions`)

console.log('\n--- D. same across a DOWN word boundary ---')
await fresh()
let d = -1
for (let i = 1; i < DOWN.length; i++) if (DOWN[i].length >= 3 && DOWN[i - 1].length >= 3) { d = i; break }
const [D0, D1] = [DOWN[d - 1], DOWN[d]]
await go(D0[0], 'down'); await press('A', D0.length)
await go(D1[0], 'down'); await press('A', D1.length)
await go(D1[0], 'down')
await press('Backspace')
await press('Backspace')
const dtail = D0[D0.length - 1]
await atCell('down: crosses into the previous down word', dtail)
ok('down: and deletes there', (await letterAt(...dtail)) === '', `cell [${dtail}]`)

console.log('\n--- E. nothing was written into a black square ---')
const blacks = (await letters()).filter((t, i) => t && grid[Math.floor(i / cols)][i % cols].t !== 'w')
ok('no letters in black cells', blacks.length === 0, `${blacks.length} found`)
ok('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '))

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
