import { chromium } from 'playwright'
import fs from 'fs'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const cols = grid[0].length
const white = []
grid.forEach((row, r) => row.forEach((c, ci) => { if (c.t === 'w') white.push({ r, c: ci, l: c.l, i: r * cols + ci }) }))

const b = await chromium.launch(); const page = await b.newPage()
const sel = '[data-grid] > div'
const go = async () => { await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await page.waitForSelector(sel) }
const ls = k => page.evaluate(k => localStorage.getItem(k), k)
const type = async (cell, l) => { await page.locator(sel).nth(cell.i).click(); await page.keyboard.press(l) }

await go(); await page.evaluate(() => localStorage.clear()); await go()

console.log('--- A. partial solve, then reload mid-solve ---')
for (const c of white.slice(0, 30)) await type(c, c.l)
await page.waitForTimeout(2200)
const midProgress = JSON.parse(await ls(`crossword-progress-${ID}`))
const midTimer = await page.locator('[data-timer]').first().innerText()
await go()
await page.waitForTimeout(500)
const afterTimer = await page.locator('[data-timer]').first().innerText()
const filled = await page.locator(sel).evaluateAll(ns => ns.filter(n => n.innerText.replace(/[0-9]/g,'').trim().length).length)
console.log(`saved_elapsed=${midProgress.elapsed} timer_before=${midTimer} timer_after_reload=${afterTimer} letters_restored=${filled}/30`)

console.log('--- B. complete it ---')
for (const c of white) await type(c, c.l)
await page.waitForTimeout(3400)
console.log(`gold=${await page.locator('[data-grid][data-celebrating]').count()} modal=${await page.locator('[data-complete-modal]').count() > 0} solved=${await ls(`crossword-solved-${ID}`)}`)
await page.getByRole('button', { name: 'Continue' }).click()

console.log('--- C. revisit a solved puzzle ---')
await go(); await page.waitForTimeout(1500)
const sweep = await page.locator('.animate-sweep').count()
const modal2 = await page.locator('[data-complete-modal]').count()
const gold2 = await page.locator('[data-grid][data-celebrating]').count()
const t1 = await page.locator('[data-timer]').first().innerText()
await page.waitForTimeout(2500)
const t2 = await page.locator('[data-timer]').first().innerText()
console.log(`sweep_replayed=${sweep > 0} modal_replayed=${modal2 > 0} gold=${gold2} timer=${t1}->${t2} frozen=${t1===t2}`)
console.log(`STALE_PROGRESS_WRITTEN=${await ls(`crossword-progress-${ID}`)}`)

console.log('--- D. reset the solved puzzle ---')
await page.getByRole('button', { name: 'Reset Puzzle' }).click()
await page.getByRole('button', { name: 'Yes' }).click()
await page.waitForTimeout(2200)
const goldAfter = await page.locator('[data-grid][data-celebrating]').count()
const filledAfter = await page.locator(sel).evaluateAll(ns => ns.filter(n => n.innerText.replace(/[0-9]/g,'').trim().length).length)
const tR = await page.locator('[data-timer]').first().innerText()
console.log(`gold_cleared=${goldAfter === 0} letters_cleared=${filledAfter === 0} timer_restarted=${tR} solved_key=${await ls(`crossword-solved-${ID}`)}`)

console.log('--- E. re-solve after reset ---')
for (const c of white) await type(c, c.l)
await page.waitForTimeout(3400)
console.log(`gold=${await page.locator('[data-grid][data-celebrating]').count()} modal=${await page.locator('[data-complete-modal]').count() > 0} solved=${await ls(`crossword-solved-${ID}`)}`)
await b.close()
