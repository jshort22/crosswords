// The mobile clue bar's centre tap SWITCHES DIRECTION (NYT-style) instead of
// opening the full clue list. The list moved to the header's ... menu, and must
// stay reachable: it is the only way back to an answer that is filled in but
// wrong, because Tab and the clue-bar arrows both skip completed answers.
//
// Trap worth knowing (Session 16): the emulated iPhone 13 viewport is 390x664,
// not 390x844. Taps below ~660 silently miss and burn the full Playwright
// timeout.
import { chromium, devices } from 'playwright'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const b = await chromium.launch()
const page = await (await b.newContext({ ...devices['iPhone 13'] })).newPage()
const errs = []
page.on('console', m => m.type() === 'error' && errs.push(m.text()))
page.on('pageerror', e => errs.push(String(e)))
let pass = 0, fail = 0
const ok = (label, cond, detail='') => { cond ? pass++ : fail++
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`) }

await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
const bar = page.locator('[data-clue-bar-toggle]')
await bar.waitFor()

// The number chip reads "12A" / "12D", so it is also the direction readout.
const label = async () => (await bar.textContent()).trim().slice(0, 24)
const dir = async () => (await bar.getAttribute('aria-label'))
const activeCell = () => page.evaluate(() =>
  [...document.querySelectorAll('[data-grid] > div')].findIndex(d => d.hasAttribute('data-active')))

console.log('--- A. tapping the clue bar flips direction ---')
const a0 = await label(), cell0 = await activeCell()
ok('starts across', /A$/.test(a0.replace(/[^AD]*$/,'')) || a0.includes('A'), `chip "${a0}"`)
await bar.tap()
const a1 = await label(), cell1 = await activeCell()
ok('flipped to down', a1 !== a0, `"${a0}" -> "${a1}"`)
ok('cursor did NOT move', cell0 === cell1, `cell ${cell0} -> ${cell1}`)
await bar.tap()
const a2 = await label()
ok('flips back to across', a2 === a0, `"${a1}" -> "${a2}"`)
ok('aria-label announces the target', (await dir()).toLowerCase().includes('down'), await dir())

console.log('\n--- B. it no longer opens the clue sheet ---')
ok('no sheet after tapping the bar', await page.locator('div[aria-label="All clues"]').count() === 0)

console.log('\n--- C. typing still goes in the direction the bar shows ---')
await bar.tap()                                   // to down
const before = await activeCell()
await page.locator('div[aria-label="Letter keyboard"] button:text-is("A")').tap()
const after = await activeCell()
const cols = await page.evaluate(() => {
  const g = document.querySelector('[data-grid]')
  return getComputedStyle(g).gridTemplateColumns.split(' ').length })
ok('cursor advanced DOWN one row', after - before === cols, `${before} -> ${after} (cols ${cols})`)
await bar.tap()                                   // back to across

console.log('\n--- D. the clue list is still reachable, from the ... menu ---')
await page.locator('[aria-expanded]').first().tap()
const listBtn = page.locator('[data-clue-list-open]')
ok('menu has a Clue list item', await listBtn.count() === 1)
await listBtn.tap()
const sheet = page.locator('div[aria-label="All clues"]')
await sheet.waitFor({ timeout: 5000 }).catch(()=>{})
ok('clue sheet opened', await sheet.count() === 1)
ok('menu closed behind it', await page.locator('[data-clue-list-open]').count() === 0)

console.log('\n--- E. picking a clue from the sheet still jumps to it ---')
const before2 = await activeCell()
await page.evaluate(() => {
  const btns = document.querySelectorAll('div[aria-label="All clues"] ol button')
  btns[btns.length - 1].click()
})
await page.waitForTimeout(300)
ok('sheet closed after picking', await page.locator('div[aria-label="All clues"]').count() === 0)
ok('cursor jumped to the picked clue', (await activeCell()) !== before2, `cell ${before2} -> ${await activeCell()}`)

ok('no console/page errors', errs.length === 0, errs.slice(0,3).join(' | '))

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
