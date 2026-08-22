// Holding the on-screen delete key must keep deleting. The physical key already
// repeats via the OS; this is the mobile keyboard's ⌫, which fired once per tap.
//
// The trap being guarded: onDelete is a useCallback over solver state, so it is
// a NEW function after every deletion. An interval closing over the one that
// existed at pointerdown would keep deleting against stale state — it would
// delete one cell and then spin, or clear the same cell repeatedly. So the test
// that matters is "N cells cleared", not "the key fired N times".
import { chromium, devices } from 'playwright'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
const errs = []
page.on('pageerror', e => errs.push(String(e)))
page.on('console', m => m.type() === 'error' && errs.push(m.text()))
const SEL = '[data-grid] > div'
let pass = 0, fail = 0
const ok = (l, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ': ' + d : ''}`) }

const filled = () => page.evaluate(s => [...document.querySelectorAll(s)]
  .filter(d => (d.textContent || '').replace(/[0-9]/g, '').trim()).length, SEL)
const key = l => page.locator(`div[aria-label="Letter keyboard"] button:text-is("${l}")`)
const del = () => page.locator('button[aria-label="Delete"]')

const fresh = async () => {
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
}
// A real press-and-hold: pointer down, wait, pointer up.
const hold = async (ms) => {
  const box = await del().boundingBox()
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
}

await fresh()
console.log('--- type a run of letters, then hold delete ---')
for (let i = 0; i < 12; i++) await key('A').tap()
const typed = await filled()
ok('typed a run of letters', typed >= 10, `${typed} cells filled`)

await hold(1200)                       // 400ms delay + ~800ms of repeats at 80ms
await page.waitForTimeout(200)
const afterHold = await filled()
console.log(`  after a 1200ms hold: ${typed} -> ${afterHold} filled`)
ok('the hold deleted more than one cell', typed - afterHold > 1, `${typed - afterHold} cleared`)
ok('it did NOT clear only one (the stale-callback failure mode)', typed - afterHold >= 5,
   `${typed - afterHold} cleared — a stale onDelete would stop at 1`)

console.log('\n--- a short tap still deletes exactly one ---')
await fresh()
for (let i = 0; i < 6; i++) await key('A').tap()
const before2 = await filled()
await del().tap()
await page.waitForTimeout(250)
const after2 = await filled()
ok('a tap clears exactly one cell', before2 - after2 === 1, `${before2} -> ${after2}`)

console.log('\n--- releasing stops it ---')
await fresh()
for (let i = 0; i < 12; i++) await key('A').tap()
await hold(700)
const atRelease = await filled()
await page.waitForTimeout(700)         // if the interval leaked, this keeps deleting
const later = await filled()
ok('deletion stops on release', later === atRelease, `${atRelease} -> ${later} after waiting`)

console.log('\n--- sliding off the key stops it ---')
await fresh()
for (let i = 0; i < 12; i++) await key('A').tap()
const box = await del().boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.waitForTimeout(600)
await page.mouse.move(box.x + box.width / 2, box.y - 120)   // slide off
const atLeave = await filled()
await page.waitForTimeout(600)
const afterLeave = await filled()
await page.mouse.up()
ok('sliding off stops the repeat', afterLeave === atLeave, `${atLeave} -> ${afterLeave}`)

console.log('\n--- holding past the start of the grid is safe ---')
await fresh()
for (let i = 0; i < 3; i++) await key('A').tap()
await hold(2500)                       // far longer than there is anything to delete
ok('grid empties and nothing breaks', (await filled()) === 0, `${await filled()} left`)
ok('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '))

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
