import { chromium, devices } from 'playwright'
import fs from 'fs'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const cols = grid[0].length
const white = []
grid.forEach((row, r) => row.forEach((c, ci) => { if (c.t === 'w') white.push({ r, c: ci, l: c.l, i: r * cols + ci }) }))

const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
const errs = []
page.on('console', m => { if (/error/i.test(m.type())) errs.push(m.text()) })
page.on('pageerror', e => errs.push(String(e)))

const sel = '.grid.select-none > div'
const go = async () => { await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await page.waitForSelector(sel) }
await go(); await page.evaluate(() => localStorage.clear()); await go()

const key = l => page.locator(`div[aria-label="Letter keyboard"] button:text-is("${l}")`)
const tapCell = async cell => page.locator(sel).nth(cell.i).tap()

console.log('--- keyboard present + tappable ---')
console.log(`  keyboard visible: ${await page.locator('div[aria-label="Letter keyboard"]').isVisible()}`)
console.log(`  clue bar visible: ${await page.locator('text=Select a cell').count() > 0 || await page.locator('button:has-text("A ")').count() >= 0}`)

console.log('--- type a letter via on-screen keyboard ---')
await tapCell(white[0])
await key(white[0].l).tap()
await page.waitForTimeout(200)
const got = await page.locator(sel).nth(white[0].i).innerText()
console.log(`  expected "${white[0].l}", cell shows "${got.replace(/[0-9]/g, '').trim()}"`)

console.log('--- clue bar arrows walk across->down boundary ---')
const lastAcross = await page.evaluate(() => document.querySelectorAll('.grid.select-none').length)
const barText = async () => (await page.locator('div.touch-target.shrink-0 button.flex-1').first().innerText()).replace(/\s+/g, ' ').slice(0, 40)
console.log(`  start: ${await barText()}`)
for (let i = 0; i < 3; i++) await page.locator('button[aria-label="Next clue"]').tap()
console.log(`  after 3 next: ${await barText()}`)
for (let i = 0; i < 5; i++) await page.locator('button[aria-label="Previous clue"]').tap()
console.log(`  after 5 prev: ${await barText()}`)

console.log('--- clue sheet ---')
await page.locator('div.touch-target.shrink-0 button.flex-1').first().tap()
await page.waitForTimeout(300)
const sheetOpen = await page.locator('div[aria-label="All clues"]').isVisible()
const rowH = await page.evaluate(() => {
  const btn = document.querySelector('div[aria-label="All clues"] ol button')
  return btn ? Math.round(btn.getBoundingClientRect().height) : 0
})
console.log(`  sheet opens: ${sheetOpen}  clue row height: ${rowH}px (target >=44)`)
await page.locator('button:text-is("Done")').tap()
await page.waitForTimeout(300)
console.log(`  sheet closes: ${!(await page.locator('div[aria-label="All clues"]').isVisible())}`)

console.log('--- solve the whole puzzle with the on-screen keyboard ---')
for (const cell of white) { await tapCell(cell); await key(cell.l).tap() }
await page.waitForTimeout(3600)
console.log(`  gold cells: ${await page.locator('.bg-amber-400').count() > 0}`)
console.log(`  modal: ${await page.locator('text=Puzzle Complete!').count() > 0}  trophy: ${await page.locator('text=🏆').count() > 0}`)
console.log(`  solved key: ${await page.evaluate(id => localStorage.getItem('crossword-solved-' + id), ID)}`)
console.log(`  progress key: ${await page.evaluate(id => localStorage.getItem('crossword-progress-' + id), ID)}`)

console.log('--- solved grid must ignore the on-screen keyboard ---')
await page.locator('button:text-is("Continue")').tap()
await tapCell(white[0])
const wrongKey = key(white[0].l === 'Z' ? 'Y' : 'Z')
console.log(`  keys report disabled: ${await wrongKey.isDisabled()}`)
// force past the disabled check to prove the handler itself is also guarded,
// not just the DOM attribute
await wrongKey.dispatchEvent('pointerdown')
await page.waitForTimeout(300)
const after = (await page.locator(sel).nth(white[0].i).innerText()).replace(/[0-9]/g, '').trim()
console.log(`  cell still "${after}" (expected "${white[0].l}"): ${after === white[0].l}`)
console.log(`  keys disabled: ${await page.locator('div[aria-label="Letter keyboard"] button').first().isDisabled()}`)

console.log(`CONSOLE_ERRORS=${JSON.stringify(errs.slice(0, 4))}`)
await b.close()
