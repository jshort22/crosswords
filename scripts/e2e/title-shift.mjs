// Does the puzzle title move as the clock ticks?
import { chromium, devices } from 'playwright'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const b = await chromium.launch()
for (const [label, opts] of [['mobile ', { ...devices['iPhone 13'] }],
                             ['desktop', { viewport: { width: 1440, height: 900 } }]]) {
  const page = await (await b.newContext(opts)).newPage()
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('[data-grid]')

  // Does the font actually give us tabular figures?
  const tab = await page.evaluate(() => {
    const t = document.querySelector('[data-timer]')
    const cs = getComputedStyle(t)
    const probe = document.createElement('span')
    probe.style.cssText = `position:absolute;left:-9999px;font:${cs.font};font-variant-numeric:${cs.fontVariantNumeric};`
    document.body.appendChild(probe)
    const w = s => { probe.textContent = s; return probe.getBoundingClientRect().width }
    const ones = w('1111'), eights = w('8888')
    probe.remove()
    return { family: cs.fontFamily.split(',')[0], variant: cs.fontVariantNumeric,
             ones: +ones.toFixed(2), eights: +eights.toFixed(2), tabular: Math.abs(ones - eights) < 0.5 }
  })
  console.log(`\n${label}  font ${tab.family}, font-variant-numeric: ${tab.variant}`)
  console.log(`  width of "1111" ${tab.ones}px vs "8888" ${tab.eights}px -> tabular figures: ${tab.tabular}`)

  const seen = new Map()
  for (let i = 0; i < 26; i++) {
    const s = await page.evaluate(() => {
      const h = document.querySelector('h1')
      const t = document.querySelector('[data-timer]')
      return { x: +h.getBoundingClientRect().x.toFixed(2), w: +h.getBoundingClientRect().width.toFixed(2),
               tw: +t.getBoundingClientRect().width.toFixed(2), t: t.textContent.trim() }
    })
    if (!seen.has(s.x)) seen.set(s.x, [])
    seen.get(s.x).push(s.t)
    await page.waitForTimeout(420)
  }
  const xs = [...seen.keys()].sort((a, b) => a - b)
  console.log(`  distinct title x positions over ~11s: ${xs.length}  ->  [${xs.join(', ')}]`)
  if (xs.length > 1) console.log(`  total drift: ${(xs[xs.length - 1] - xs[0]).toFixed(2)}px   ${xs.map(x => x + ' @ ' + seen.get(x).slice(0, 3).join('/')).join('   ')}`)
}
await b.close()
