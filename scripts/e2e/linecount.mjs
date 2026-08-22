// How many rendered lines does each clue take in the mobile clue bar?
// Reads scrollHeight of the (clipped) text span, which reports the FULL
// content height, and divides by the measured line box.
import { chromium } from 'playwright'
const [, , ID, LABEL, W, H] = process.argv
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })
const page = await ctx.newPage()
await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.grid.select-none')
await page.waitForTimeout(300)

const r = await page.evaluate(async () => {
  const next = document.querySelector('button[aria-label="Next clue"]')
  const bar = next.closest('div')
  const span = () => bar.querySelector('span.overflow-y-auto')
  const lh = parseFloat(getComputedStyle(span()).lineHeight)
  const seen = new Map()
  for (let i = 0; i < 400; i++) {
    const t = span()
    if (t) {
      const txt = t.textContent.trim()
      if (!seen.has(txt)) {
        seen.set(txt, { lines: Math.round(t.scrollHeight / lh), len: txt.length, w: Math.round(t.clientWidth) })
      }
    }
    next.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await new Promise(r => setTimeout(r, 5))
  }
  return { lh, textWidth: [...seen.values()][0]?.w, rows: [...seen.entries()].map(([txt, v]) => ({ txt, ...v })) }
})

const hist = {}
for (const row of r.rows) hist[row.lines] = (hist[row.lines] || 0) + 1
const maxLines = Math.max(...r.rows.map(x => x.lines))
console.log(`\n${LABEL}  ${W}x${H}   text column ${r.textWidth}px, line box ${r.lh}px`)
console.log(`  distinct clues seen: ${r.rows.length}`)
console.log(`  lines:  ` + Object.keys(hist).sort((a,b)=>a-b).map(k => `${k}L×${hist[k]}`).join('  '))
for (const row of r.rows.filter(x => x.lines >= 4).sort((a,b)=>b.lines-a.lines))
  console.log(`  ${row.lines}L (${row.len}ch): ${row.txt.slice(0,80)}`)
console.log(`  MAX LINES = ${maxLines}`)
await b.close()
