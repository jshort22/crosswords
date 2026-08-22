import { chromium, devices } from 'playwright'
const [, , ID, LABEL] = process.argv
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const page = await ctx.newPage()
await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.grid.select-none')

// Walk every clue, recording bar height + whether text is clipped
const stats = await page.evaluate(async () => {
  const next = document.querySelector('button[aria-label="Next clue"]')
  const bar = () => next.closest('div')
  const textSpan = () => bar().querySelector('span.overflow-y-auto')
  const out = []
  for (let i = 0; i < 300; i++) {
    const t = textSpan()
    if (t) {
      out.push({
        h: Math.round(bar().getBoundingClientRect().height),
        clipped: t.scrollHeight > t.clientHeight + 1,
        len: t.textContent.trim().length,
      })
    }
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 8))
  }
  const g = document.querySelector('.grid.select-none').getBoundingClientRect()
  return { out, gridFits: g.bottom <= innerHeight + 1, grid: Math.round(g.width) }
})
const hs = stats.out.map(o => o.h)
const clipped = stats.out.filter(o => o.clipped)
console.log(`${LABEL}: sampled ${stats.out.length} clues`)
console.log(`  bar height: min ${Math.min(...hs)}px  max ${Math.max(...hs)}px`)
console.log(`  clues needing internal scroll: ${clipped.length}${clipped.length ? '  (longest ' + Math.max(...clipped.map(c => c.len)) + ' chars)' : ''}`)
console.log(`  grid still fits: ${stats.gridFits}  (grid ${stats.grid}px)`)
await b.close()
