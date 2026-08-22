// Difficulty should show where you PICK a puzzle and not while you solve it.
import { chromium, devices } from 'playwright'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const b = await chromium.launch()
const has = async (page, word) => (await page.locator(`text=${word}`).count()) > 0

const desk = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await desk.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
console.log(`library shows "Beginner": ${await has(desk, 'Beginner')}   (want true)`)

for (const [label, opts] of [['desktop', { viewport: { width: 1440, height: 900 } }],
                             ['mobile ', { ...devices['iPhone 13'] }]]) {
  const page = await (await b.newContext(opts)).newPage()
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-grid]')
  await page.waitForTimeout(400)
  const m = await page.evaluate(() => {
    const h = document.querySelector('header')
    const g = document.querySelector('[data-grid]').getBoundingClientRect()
    return { header: Math.round(h.getBoundingClientRect().height), grid: Math.round(g.width),
             headerText: h.innerText.replace(/\s+/g, ' ').trim() }
  })
  console.log(`solver ${label}  header ${m.header}px, grid ${m.grid}px`)
  console.log(`   header reads: "${m.headerText}"`)
  for (const w of ['Beginner', 'Easy', 'Medium', 'Hard', 'Expert'])
    if (await has(page, w)) console.log(`   !! still shows "${w}"`)
}
await b.close()
