// Full grid with at least one wrong letter: a CENTRED modal with a "Keep trying"
// button, shown once per attempt.
//
// It used to be an inline pill rendered inside the grid column, so it resized
// the grid at the moment you were reading it. The first assertion here is that
// the grid does not move — that is the whole reason it changed.
import { chromium } from 'playwright'
import fs from 'fs'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const cols = grid[0].length
const white = []
grid.forEach((row, r) => row.forEach((c, ci) => { if (c.t === 'w') white.push({ r, c: ci, l: c.l, i: r * cols + ci }) }))
const SEL = '[data-grid] > div'
const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e)))
let pass = 0, fail = 0
const ok = (l, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ': ' + d : ''}`) }

const load = async () => {
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
}
const type = async (cell, l) => { await page.locator(SEL).nth(cell.i).click(); await page.keyboard.press(l) }
const gridBox = () => page.locator('[data-grid]').boundingBox()
const modal = () => page.locator('[data-wrong-modal]')
const last = white[white.length - 1]
const wrongLetter = last.l === 'X' ? 'W' : 'X'
// Fill everything correctly except the last cell.
const fillWrong = async () => {
  for (const c of white.slice(0, -1)) await type(c, c.l)
  await type(last, wrongLetter)
  await page.waitForTimeout(450)
}

await load()
await page.evaluate(() => localStorage.clear())
await load()

console.log('--- first full-but-wrong grid ---')
const before = await gridBox()
await fillWrong()
ok('the modal appeared', await modal().count() === 1)
const after = await gridBox()
ok('the grid did NOT move or resize',
   before.x === after.x && before.y === after.y && before.width === after.width && before.height === after.height,
   `${before.width}x${before.height} @${before.x},${before.y} -> ${after.width}x${after.height} @${after.x},${after.y}`)
const box = await modal().locator('> div').boundingBox()
const vp = page.viewportSize()
const centred = Math.abs((box.x + box.width / 2) - vp.width / 2) < 2 && Math.abs((box.y + box.height / 2) - vp.height / 2) < 2
ok('it is centred in the viewport', centred, `centre ${(box.x + box.width / 2).toFixed(0)},${(box.y + box.height / 2).toFixed(0)} vs ${vp.width / 2},${vp.height / 2}`)
ok('no premature celebration', await page.locator('[data-grid][data-celebrating]').count() === 0)
ok('no completion modal', await page.locator('[data-complete-modal]').count() === 0)

console.log('\n--- the button says Keep trying and dismisses it ---')
const btn = modal().locator('button')
ok('button reads "Keep trying"', (await btn.innerText()).trim() === 'Keep trying', await btn.innerText())
await btn.click()
await page.waitForTimeout(250)
ok('dismissed', await modal().count() === 0)
const afterDismiss = await gridBox()
ok('grid still has not moved', afterDismiss.width === before.width && afterDismiss.y === before.y)

console.log('\n--- it does NOT come back on a second full-but-wrong grid ---')
// change a letter to break the "full" state, then make it full-and-wrong again
await type(last, last.l)            // correct -> completes; undo that immediately
await page.waitForTimeout(150)
await load()                        // reload: progress restored, still full
await page.waitForTimeout(300)
ok('no modal on reload of a full-but-wrong grid', await modal().count() === 0)

console.log('\n--- reset earns the message again ---')
await page.locator('button:has-text("Reset")').first().click()
await page.locator('button:has-text("Yes")').click()
await page.waitForTimeout(600)
ok('reset cleared the grid', await page.evaluate(s => [...document.querySelectorAll(s)]
  .filter(e => (e.textContent || '').replace(/[0-9]/g, '').trim()).length, SEL) === 0)
await fillWrong()
ok('the modal appears again after a reset', await modal().count() === 1)
await modal().locator('button').click()
await page.waitForTimeout(200)

console.log('\n--- fixing the last letter still celebrates ---')
await type(last, last.l)
await page.waitForTimeout(3400)
ok('gold sweep ran', await page.locator('[data-grid][data-celebrating]').count() === 1)
ok('completion modal shown', await page.locator('[data-complete-modal]').count() === 1)
ok('the wrong-answer modal is not also up', await modal().count() === 0)
ok('no page errors', errs.length === 0, errs.slice(0, 2).join(' | '))

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
