import { chromium, devices } from 'playwright'
const ID = process.argv[2]
const b = await chromium.launch()
const cases = [
  ['phone-portrait', { ...devices['iPhone 13'] }],
  ['phone-landscape', { ...devices['iPhone 13 landscape'] }],
  ['desktop', { viewport: { width: 1440, height: 900 } }],
]
for (const [label, opts] of cases) {
  const ctx = await b.newContext(opts)
  const page = await ctx.newPage()
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.grid.select-none')
  await page.waitForTimeout(500)
  const m = await page.evaluate(() => {
    const g = document.querySelector('.grid.select-none').getBoundingClientRect()
    const kbd = document.querySelector('div[aria-label="Letter keyboard"]')
    const bar = document.querySelector('button[aria-label="Next clue"]')
    const menu = document.querySelector('button[aria-label="Puzzle actions"]')
    const vis = el => !!el && el.getBoundingClientRect().height > 0
    return {
      grid: `${Math.round(g.width)}x${Math.round(g.height)}`,
      fits: g.bottom <= innerHeight + 1 && g.right <= innerWidth + 1,
      kbd: vis(kbd), bar: vis(bar), menu: vis(menu),
      pageScroll: document.documentElement.scrollHeight > innerHeight + 1,
    }
  })
  console.log(`${label.padEnd(17)} grid=${m.grid.padEnd(9)} fits=${String(m.fits).padEnd(5)} kbd=${String(m.kbd).padEnd(5)} cluebar=${String(m.bar).padEnd(5)} menu=${String(m.menu).padEnd(5)} pageScroll=${m.pageScroll}`)
  await page.screenshot({ path: `/tmp/final-${label}.png` })
  await ctx.close()
}
await b.close()
