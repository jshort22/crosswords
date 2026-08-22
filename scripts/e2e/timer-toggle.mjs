// The ⋯ menu's timer switch hides the CLOCK FACE only. The clock must keep
// running underneath, so hiding it to take the pressure off doesn't also stop
// your time.
import { chromium, devices } from 'playwright'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('[data-grid]')

const T = () => page.locator('[data-timer]').first().innerText()
const secs = t => { const [m, s] = t.trim().split(':').map(Number); return m * 60 + s }
const menu = () => page.locator('button[aria-label="Puzzle actions"]').tap()
const sw = () => page.locator('[data-timer-toggle]')
let fail = 0
const check = (label, ok, detail = '') => { ok || fail++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`) }

await page.waitForTimeout(2500)
const visible = await T()
check('timer visible by default', /^\d+:\d\d$/.test(visible.trim()), `reads "${visible.trim()}"`)

console.log('\n--- open the menu, flip the switch off ---')
await menu()
check('switch present in the ⋯ menu', await sw().count() > 0)
check('switch reads on', await sw().getAttribute('aria-checked') === 'true')
await sw().tap()
await page.waitForTimeout(150)
check('menu stays open (it is a setting, not an action)', await sw().count() > 0)
check('switch now reads off', await sw().getAttribute('aria-checked') === 'false')

// Dismiss by tapping the backdrop (fixed inset-0 z-30), not the ⋯ button — the
// popover sits over that corner, so a tap there hits the menu instead.
// NOTE the emulated iPhone 13 viewport is 390x664, not 390x844: y=700 is off
// screen and a tap there silently does nothing (it cost 30s of timeout twice).
const closeMenu = async () => {
  await page.touchscreen.tap(195, 480)
  await page.waitForTimeout(200)
}
await closeMenu()
const hidden = await T()
check('clock face hidden', hidden.trim() === '--:--', `reads "${hidden.trim()}"`)

console.log('\n--- the clock must still be running while hidden ---')
const before = secs(visible)
await page.waitForTimeout(5000)
await menu()
await sw().tap()
await page.waitForTimeout(150)
await closeMenu()
const after = await T()
const grew = secs(after) - before
check('time kept accruing while hidden', grew >= 4 && grew <= 12, `${before}s -> ${secs(after)}s across ~5s hidden`)
check('switch reads on again', /^\d+:\d\d$/.test(after.trim()), `reads "${after.trim()}"`)

console.log(`\n${fail ? fail + ' FAILED' : 'all passed'}   PAGE_ERRORS=${JSON.stringify(errs)}`)
await b.close()
process.exit(fail ? 1 : 0)
