// The clock should tick while you are in the puzzle, hold while you are out of
// it, and pick up where it left off when you come back -- within one session.
// No cross-device syncing is in scope.
import { chromium } from 'playwright'
import fs from 'fs'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const cols = grid[0].length
const firstWhite = (() => {
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols; c++)
    if (grid[r][c].t === 'w') return r * cols + c
})()

const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
const SEL = '[data-grid] > div'
const T = async () => (await page.locator('[data-timer]').first().innerText()).trim()
const secs = t => { const [m, s] = t.split(':').map(Number); return m * 60 + s }
const open = async () => { await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await page.waitForSelector(SEL) }
const wait = ms => page.waitForTimeout(ms)
let fail = 0
const check = (label, cond, detail) => { cond ? 0 : fail++; console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`) }

await open()
await page.evaluate(() => localStorage.clear())
await open()

console.log(`--- 1. ticks while you are in the puzzle ---`)
const t0 = secs(await T()); await wait(5000); const t1 = secs(await T())
check('advanced ~5s', t1 - t0 >= 4 && t1 - t0 <= 7, `${t0}s -> ${t1}s`)

console.log(`\n--- 2. type a letter, then LEAVE the puzzle for 6s and come back ---`)
await page.locator(SEL).nth(firstWhite).click()
await page.keyboard.press('A')
const atExit = secs(await T())
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
await wait(6000)
await open()
const onReturn = secs(await T())
check('clock held while out of the puzzle', onReturn - atExit <= 2,
  `left at ${atExit}s, back at ${onReturn}s (a running clock would show ~${atExit + 6}s)`)
check('letter still there', await page.locator(SEL).nth(firstWhite).innerText().then(t => t.includes('A')))

console.log(`\n--- 3. resumes ticking after coming back ---`)
const r0 = secs(await T()); await wait(4000); const r1 = secs(await T())
check('advanced again', r1 - r0 >= 3 && r1 - r0 <= 6, `${r0}s -> ${r1}s`)

console.log(`\n--- 4. survives a reload mid-solve ---`)
const b0 = secs(await T()); await page.reload({ waitUntil: 'networkidle' }); await page.waitForSelector(SEL); await wait(300)
const b1 = secs(await T())
check('picked up where it left off', Math.abs(b1 - b0) <= 3, `${b0}s -> ${b1}s`)  // a loaded machine can spend >2s on the reload itself

console.log(`\n--- 5. two exits in a row do not double-count or reset ---`)
const c0 = secs(await T())
for (let i = 0; i < 2; i++) { await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' }); await wait(2500); await open() }
const c1 = secs(await T())
check('still monotonic, no reset to 0', c1 >= c0 && c1 - c0 <= 4, `${c0}s -> ${c1}s across two 2.5s absences`)

console.log(`\n--- 6. merely LOOKING at a puzzle without typing ---`)
await page.evaluate(() => localStorage.clear())
await open()
await wait(5000)
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
await wait(500)
await open()
const browsed = secs(await T())
const rec = await page.evaluate(id => localStorage.getItem(`crossword-progress-${id}`), ID)
console.log(`  clock on re-entry after 5s of just looking: ${browsed}s`)
console.log(`  a progress record was written with no letters typed: ${rec ? 'yes' : 'no'}`)

console.log(`\n--- 7. clock stops for good once solved ---`)
console.log(`  (covered by solve.mjs TIMER_STOPPED and revisit.mjs frozen=true)`)

console.log(`\n${fail ? fail + ' FAILED' : 'all passed'}   PAGE_ERRORS=${JSON.stringify(errs)}`)
await b.close()
process.exit(fail ? 1 : 0)
