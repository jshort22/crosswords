// The admin clue editor must warn (never block) on clues too long for the
// mobile clue bar's three lines.
import { chromium } from 'playwright'
const ID = 'ac04774b-7f4c-4a4d-beaa-421147663566' // the 21x21, 140 clues
const b = await chromium.launch()
const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('console', m => m.type() === 'error' && errors.push(m.text()))

await page.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' })
await page.fill('input[type="password"]', 'rebus')
await page.click('button[type="submit"]')
await page.waitForURL('**/admin', { timeout: 15000 })
await page.goto(`http://localhost:3000/admin/puzzles/${ID}/edit`, { waitUntil: 'networkidle' })
await page.waitForSelector('input[placeholder="Enter clue…"]')

const inputs = page.locator('input[placeholder="Enter clue…"]')
console.log(`clue inputs rendered: ${await inputs.count()}`)

// Existing 132-char clue should already be flagged on load
const tallyText = () => page.locator('span.text-amber-700').allTextContents()
console.log(`tallies on load: ${JSON.stringify(await tallyText())}`)
console.log(`row warnings on load: ${await page.locator('p.text-amber-700').count()}`)

const first = inputs.first()
// Scope the assertion to THIS row — other clues in the puzzle are already long
const row = page.locator('input[placeholder="Enter clue…"]').first().locator('xpath=..')
const rowWarn = async () => await row.locator('p.text-amber-700').count() > 0 ? 'yes' : 'no'
console.log(`\n--- boundary: 99 / 100 / 101 chars in THIS row ---`)
for (const n of [99, 100, 101]) {
  await first.fill('word '.repeat(40).slice(0, n))
  await page.waitForTimeout(120)
  console.log(`  ${n} chars -> warns: ${await rowWarn()}`)
}
console.log(`  (trailing whitespace ignored) 100 chars + 20 spaces -> warns: ${
  await (async () => { await first.fill('a'.repeat(100) + ' '.repeat(20)); await page.waitForTimeout(120); return rowWarn() })()}`)

console.log(`--- 101 chars (over, must warn) ---`)
await first.fill('y'.repeat(101))
await page.waitForTimeout(120)
const warn = row.locator('p.text-amber-700').first()
console.log(`  warning shown: ${await rowWarn()}`)
console.log(`  copy: ${(await warn.textContent()).replace(/\s+/g, ' ').trim()}`)
console.log(`  input border turned amber: ${(await first.getAttribute('class')).includes('border-amber-400')}`)
console.log(`  aria-describedby wired: ${await first.getAttribute('aria-describedby')}`)
console.log(`  tallies: ${JSON.stringify(await tallyText())}`)

console.log(`--- no hard cap: type 400 chars ---`)
const long = 'z'.repeat(400)
await first.fill(long)
await page.waitForTimeout(120)
console.log(`  maxLength attr: ${await first.getAttribute('maxlength')}`)
console.log(`  value kept all 400 chars: ${(await first.inputValue()).length === 400}`)

console.log(`--- clearing it removes the warning ---`)
await first.fill('Short clue')
await page.waitForTimeout(120)
console.log(`  row warnings: ${await page.locator('p.text-amber-700').count()}`)
console.log(`  tallies: ${JSON.stringify(await tallyText())}`)
console.log(`\nCONSOLE_ERRORS=${JSON.stringify(errors)}`)
await b.close()
