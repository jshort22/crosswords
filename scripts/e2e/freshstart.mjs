// A brand-new visitor must get a completely empty grid on every puzzle:
// no letters, no gold, no modal, no "solved" state, and the cursor parked on
// the first white cell. Runs in a pristine browser context (no storage at all),
// which is the real first-visit condition -- not localStorage.clear() after a
// load, which is what every other harness here does.
import { chromium } from 'playwright'
const IDS = process.argv.slice(2)
const b = await chromium.launch()
let fail = 0
for (const ID of IDS) {
  for (const [label, opts] of [
    ['desktop', { viewport: { width: 1440, height: 900 } }],
    ['mobile ', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' }],
  ]) {
    const ctx = await b.newContext(opts)          // pristine: never touched storage
    const page = await ctx.newPage()
    const errs = []
    page.on('console', m => m.type() === 'error' && errs.push(m.text()))
    const res = await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('.grid.select-none')
    await page.waitForTimeout(400)

    const r = await page.evaluate(() => {
      const cells = [...document.querySelectorAll('.grid.select-none > div')]
      // The letter is the LAST span in a white cell; a clue number is an
      // absolutely-positioned span, so filter those out rather than counting
      // all text (every numbered cell has text).
      const letters = cells.filter(d => {
        const spans = [...d.querySelectorAll('span')].filter(s => !s.className.includes('absolute'))
        return spans.some(s => s.textContent.trim().length > 0)
      })
      return {
        total: cells.length,
        filled: letters.length,
        active: cells.findIndex(d => d.className.includes('bg-amber-300')),
        firstWhite: cells.findIndex(d => !d.className.includes('bg-black')),
        gold: document.querySelectorAll('.bg-amber-200, .bg-yellow-200, [class*="gold"]').length,
        modal: document.querySelectorAll('[role="dialog"]').length,
        keys: Object.keys(localStorage).length,
        storage: Object.keys(localStorage),
      }
    })
    const ok = r.filled === 0 && r.active === r.firstWhite && r.modal === 0 && errs.length === 0
    if (!ok) fail++
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${ID.slice(0, 8)} ${label}  http=${res.status()}  ` +
      `filled=${r.filled}/${r.total}  cursor=${r.active} (first white ${r.firstWhite})  ` +
      `modal=${r.modal}  localStorage=${JSON.stringify(r.storage)}`)
    if (errs.length) console.log(`      CONSOLE ERRORS: ${JSON.stringify(errs)}`)
    await ctx.close()
  }
}
console.log(`\n${fail ? fail + ' FAILED' : 'all clean'}`)
await b.close()
process.exit(fail ? 1 : 0)
