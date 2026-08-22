import { chromium } from 'playwright'
const [, , ID, LABEL, W, H] = process.argv
const b = await chromium.launch()
const ctx = await b.newContext({ viewport:{width:+W,height:+H}, isMobile:true, hasTouch:true,
  userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })
const page = await ctx.newPage()
await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil:'networkidle' })
await page.evaluate(() => localStorage.clear()); await page.reload({ waitUntil:'networkidle' })
await page.waitForSelector('.grid.select-none'); await page.waitForTimeout(300)
const r = await page.evaluate(async () => {
  const next = document.querySelector('button[aria-label="Next clue"]')
  const grid = document.querySelector('.grid.select-none')
  const bar = next.closest('div')
  const gridSizes = new Set(), barSizes = new Set()
  let scrolled = 0
  for (let i = 0; i < 300; i++) {
    gridSizes.add(Math.round(grid.getBoundingClientRect().width))
    barSizes.add(Math.round(bar.getBoundingClientRect().height))
    const t = bar.querySelector('span.overflow-y-auto')
    if (t && t.scrollHeight > t.clientHeight + 1) scrolled++
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 6))
  }
  return { grids:[...gridSizes], bars:[...barSizes], scrolled }
})
const ok = r.grids.length === 1 && r.bars.length === 1
console.log(`${LABEL.padEnd(14)} grid sizes seen: [${r.grids}]   bar heights seen: [${r.bars}]   clues that scroll: ${r.scrolled}   ${ok ? '✓ STABLE' : '✗ STILL JUMPING'}`)
await b.close()
