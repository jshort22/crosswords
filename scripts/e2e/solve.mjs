import { chromium } from 'playwright'
import fs from 'fs'

const [, , PUZZLE_ID, MODE] = process.argv
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const rows = grid.length, cols = grid[0].length
const white = []
for (let r = 0; r < rows; r++)
  for (let c = 0; c < cols; c++)
    if (grid[r][c].t === 'w') white.push({ r, c, l: grid[r][c].l, i: r * cols + c })

const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', m => logs.push(m.text()))

await page.goto(`http://localhost:3000/puzzles/${PUZZLE_ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })

const cellsSel = '[data-grid] > div'
await page.waitForSelector(cellsSel)

const type = async (cell, letter) => {
  await page.locator(cellsSel).nth(cell.i).click()
  await page.keyboard.press(letter)
}

// MODE "check": fill 20 cells WRONG, run Show Incorrect, then correct everything.
if (MODE === 'check') {
  const wrong = white.slice(0, 20)
  for (const cell of wrong) await type(cell, cell.l === 'A' ? 'B' : 'A')
  await page.getByRole('button', { name: 'Show Incorrect' }).click()
  await page.getByRole('button', { name: 'Yes' }).click()
  await page.waitForTimeout(300)
  const reds = await page.locator('[data-wrong]').count()
  console.log(`RED_AFTER_CHECK=${reds}`)
}

for (const cell of white) await type(cell, cell.l)

await page.waitForTimeout(400)
const timerAtComplete = await page.locator('[data-timer]').first().innerText()
const sweeping = await page.locator('.animate-sweep').count()
console.log(`SWEEP_VISIBLE=${sweeping > 0}`)

await page.waitForTimeout(3200)
const gold = await page.locator('[data-grid][data-celebrating]').count()
const modal = await page.locator('[data-complete-modal]').count()
const trophy = await page.locator('[data-complete-mark]').count()
const solved = await page.evaluate(id => localStorage.getItem(`crossword-solved-${id}`), PUZZLE_ID)
const progress = await page.evaluate(id => localStorage.getItem(`crossword-progress-${id}`), PUZZLE_ID)
const redsAtEnd = await page.locator('[data-wrong]').count()

console.log(`GOLD_CELLS=${gold}/${white.length}`)
console.log(`MODAL=${modal > 0}  TROPHY=${trophy > 0}`)
console.log(`RED_AT_END=${redsAtEnd}`)
console.log(`SOLVED_KEY=${solved}`)
console.log(`PROGRESS_KEY=${progress}`)

const t1 = await page.locator('[data-timer]').first().innerText()
await page.waitForTimeout(2500)
const t2 = await page.locator('[data-timer]').first().innerText()
console.log(`TIMER_STOPPED=${t1 === t2} (${t1} -> ${t2}, at-complete ${timerAtComplete})`)

// Can the solved grid still be typed into?
await page.getByRole('button', { name: 'Continue' }).click().catch(() => {})
await page.locator(cellsSel).nth(white[0].i).click()
await page.keyboard.press(white[0].l === 'Z' ? 'Y' : 'Z')
await page.waitForTimeout(300)
const goldAfterEdit = await page.locator('[data-grid][data-celebrating]').count()
const letterAfterEdit = await page.locator(cellsSel).nth(white[0].i).innerText()
const solvedAfterEdit = await page.evaluate(id => localStorage.getItem(`crossword-solved-${id}`), PUZZLE_ID)
console.log(`POST_SOLVE_EDIT: letter_changed=${letterAfterEdit.replace(/\d/g,'').trim() !== white[0].l} still_gold=${goldAfterEdit > 0} solved_key_intact=${!!solvedAfterEdit}`)

console.log('CONSOLE_ERRORS=' + JSON.stringify(logs.filter(l => /error|warn/i.test(l)).slice(0, 5)))
await browser.close()
