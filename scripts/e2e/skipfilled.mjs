// Auto-advance must skip cells/answers that are already filled, WITHOUT
// ejecting you out of an answer you are deliberately retyping, and without
// changing what Tab / the clue-bar arrows do.
//
// NOTE on positioning: clicking the cell that is ALREADY active toggles
// direction (SET_ACTIVE), and auto-advance means the cursor is usually already
// sitting on the cell you were about to click. So never click straight to a
// target — go() clicks a scratch cell first, then nudges right/left, which
// forces direction back to across (MOVE derives direction from the delta).
import { chromium, devices } from 'playwright'
import fs from 'fs'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const rows = grid.length, cols = grid[0].length
const idx = (r, c) => r * cols + c
const white = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols && grid[r][c].t === 'w'

const across = []
for (let r = 0; r < rows; r++)
  for (let c = 0; c < cols; c++)
    if (white(r, c) && !white(r, c - 1) && white(r, c + 1)) {
      const cells = []
      for (let cc = c; white(r, cc); cc++) cells.push([r, cc])
      across.push(cells)
    }

let k = -1
for (let i = 0; i + 2 < across.length; i++)
  if ([i, i + 1, i + 2].every(j => across[j].length >= 3)) { k = i; break }
const [W, W1, W2] = [across[k], across[k + 1], across[k + 2]]
const used = new Set([...W, ...W1, ...W2].map(([r, c]) => `${r},${c}`))
let scratch = null
for (let r = rows - 1; r >= 0 && !scratch; r--)
  for (let c = 0; c < cols; c++)
    if (white(r, c) && !used.has(`${r},${c}`)) { scratch = [r, c]; break }

const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
page.on('console', m => m.type() === 'error' && errs.push(m.text()))
const SEL = '.grid.select-none > div'
let pass = 0, fail = 0

const fresh = async () => {
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
}
const active = () => page.evaluate(s =>
  [...document.querySelectorAll(s)].findIndex(d => d.className.includes('bg-amber-300')), SEL)
const fmt = i => `[${Math.floor(i / cols)},${i % cols}]`
const go = async ([r, c]) => {
  await page.locator(SEL).nth(idx(...scratch)).click()
  await page.locator(SEL).nth(idx(r, c)).click()
  if (white(r, c + 1)) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft') }
  else { await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight') }
}
const press = async (key, n = 1) => { for (let i = 0; i < n; i++) await page.keyboard.press(key) }
const fillWord = async cells => { await go(cells[0]); await press('A', cells.length) }
const expect = async (label, cell) => {
  const got = await active()
  const ok = got === idx(...cell)
  ok ? pass++ : fail++
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: cursor ${fmt(got)}, expected ${JSON.stringify(cell)}`)
}

console.log(`across words #${k}/${k + 1}/${k + 2}, lengths ${W.length}/${W1.length}/${W2.length}; scratch ${JSON.stringify(scratch)}`)

console.log(`\n--- A. typing skips a crossing letter already in the word ---`)
await fresh()
await go(W[1]); await press('X')
await go(W[0]); await press('Y')
await expect('skipped the filled W[1]', W[2])

console.log(`\n--- B. completing a word jumps OVER the next word when it is full ---`)
await fresh()
await fillWord(W1)
await go(W[0]); await press('A', W.length)
await expect('landed in W2, not the full W1', W2[0])

console.log(`\n--- C. retyping an already-complete answer steps through it (no eject) ---`)
await go(W[0]); await press('Z')
await expect('stayed in W', W[1])
await press('Z')
await expect('still stepping through W', W[2])

console.log(`\n--- D. Tab still walks into a full word (arrows unchanged) ---`)
await go(W[0])
await press('Tab')
await expect('Tab reached the full W1', W1[0])
await press('Shift+Tab')
await expect('Shift+Tab came back', W[0])

console.log(`\n--- E. a gap skipped past is still reachable, not orphaned ---`)
await fresh()
await go(W[1]); await press('X')
await go(W[0]); await press('Y')            // skips to W[2]
await press('A', W.length - 2)              // fill W[2..] and on past the end of W
await go(W[1]); await press('Backspace')    // reopen the gap (backspace clears in place)
await go(W[0]); await press('Q')
await expect('came back for the reopened gap', W[1])

console.log(`\n--- F. finishing a RETYPED full word still skips a full next word ---`)
// The "no eject" rule governs movement inside the word only. Once the word is
// exhausted, "I was retyping it" is no reason to land on a full clue.
await fresh()
await fillWord(W1)
await go(W[0]); await press('B', W.length)   // complete W -> lands in W2
await go(W[0]); await press('C', W.length)   // retype full W to its end
await expect('landed in W2, not the full W1', W2[0])

console.log(`\n--- G. Tab into a PARTIALLY filled word lands on its first blank ---`)
await fresh()
await go(W1[0]); await press('A')            // fill only W1's first cell
await go(W[0]); await press('Tab')
await expect('skipped the filled first cell', W1[1])

console.log(`\n--- H. clicking a clue in the list lands on its first blank ---`)
// State carried over from G: W1's first cell is filled, the rest of it blank.
// Click W1's own entry in the Across list (index k+1) and it must skip that
// filled first cell too.
await page.locator('ol').first().locator('button').nth(k + 1).click()
await expect('clue-list click skipped the filled first cell', W1[1])

console.log(`\n${pass} passed, ${fail} failed`)
console.log(`CONSOLE_ERRORS=${JSON.stringify(errs)}`)
await b.close()

// The mobile clue-bar arrows are a SEPARATE path from Tab/NEXT_WORD (goClue in
// SolverClient walks one continuous Across-then-Down sequence), so check them too.
const mb = await chromium.launch()
const mpage = await (await mb.newContext({ ...devices['iPhone 13'] })).newPage()
await mpage.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await mpage.evaluate(() => localStorage.clear())
await mpage.reload({ waitUntil: 'networkidle' })
await mpage.waitForSelector(SEL)
const mactive = () => mpage.evaluate(s =>
  [...document.querySelectorAll(s)].findIndex(d => d.className.includes('bg-amber-300')), SEL)
// Fill the first cell of across word #1, then arrow into it from word #0
await mpage.locator(SEL).nth(idx(...W1[0])).tap()
await mpage.locator('div[aria-label="Letter keyboard"] button:text-is("A")').tap()
await mpage.locator(SEL).nth(idx(...W[0])).tap()
await mpage.locator('button[aria-label="Next clue"]').tap()
const mgot = await mactive()
const mok = mgot === idx(...W1[1])
console.log(`\n--- mobile clue-bar arrow ---`)
console.log(`  ${mok ? 'PASS' : 'FAIL'}  \u2039 \u203a landed on first blank: cursor ${fmt(mgot)}, expected ${JSON.stringify(W1[1])}`)
await mb.close()
process.exit(fail || !mok ? 1 : 0)
