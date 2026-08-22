// Where does a clue tip onto a fourth line in the mobile clue bar?
// Measures every clue in the library by writing it into the real bar's text
// span and reading scrollHeight, so wrapping is the browser's, not a guess.
import { chromium } from 'playwright'
import fs from 'fs'
const CLUES = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const b = await chromium.launch()
for (const [w, h] of [[320, 568], [375, 667], [390, 844], [430, 932]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' })
  const page = await ctx.newPage()
  await page.goto('http://localhost:3000/puzzles/ac04774b-7f4c-4a4d-beaa-421147663566', { waitUntil: 'networkidle' })
  await page.waitForSelector('.grid.select-none')
  await page.waitForTimeout(250)
  const r = await page.evaluate((clues) => {
    const bar = document.querySelector('button[aria-label="Next clue"]').closest('div')
    const span = bar.querySelector('span.overflow-y-auto')
    const cs = getComputedStyle(span)
    const lh = parseFloat(cs.lineHeight)
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;left:-9999px;top:0;width:${span.clientWidth}px;` +
      `font:${cs.font};letter-spacing:${cs.letterSpacing};white-space:normal;word-break:${cs.wordBreak};`
    document.body.appendChild(probe)
    const rows = clues.map(t => {
      probe.textContent = t
      return { len: t.length, lines: Math.round(probe.scrollHeight / lh), t }
    })
    // Sweep synthetic prose to find the character count where 4 lines starts
    const words = 'clue word about that some other maybe hint from with these thing'.split(' ')
    let s = ''
    const sweep = []
    for (let i = 0; i < 60; i++) {
      s += (s ? ' ' : '') + words[i % words.length]
      probe.textContent = s
      sweep.push({ len: s.length, lines: Math.round(probe.scrollHeight / lh) })
    }
    probe.remove()
    return { textWidth: span.clientWidth, lh, rows, sweep }
  }, CLUES)

  const fits = r.rows.filter(x => x.lines <= 3)
  const over = r.rows.filter(x => x.lines >= 4)
  const firstFour = r.sweep.find(x => x.lines >= 4)
  const lastThree = [...r.sweep].reverse().find(x => x.lines <= 3)
  console.log(`\n${w}px  (text column ${r.textWidth}px, line box ${r.lh}px)`)
  console.log(`  real clues: ${fits.length} fit in <=3 lines, ${over.length} spill to 4+`)
  console.log(`  longest that still fits in 3: ${Math.max(...fits.map(x => x.len))} chars`)
  console.log(`  shortest that spills to 4:    ${over.length ? Math.min(...over.map(x => x.len)) : '—'} chars`)
  console.log(`  synthetic prose: 3 lines up to ${lastThree.len} chars, 4th line from ${firstFour ? firstFour.len : '—'} chars`)
  for (const o of over.sort((a, b) => a.len - b.len)) console.log(`    ${o.len}ch -> ${o.lines}L  ${o.t.slice(0, 62)}`)
  await ctx.close()
}
await b.close()
