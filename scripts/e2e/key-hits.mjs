// The on-screen keyboard's keys are separated by a 4px flex gap (6px between
// rows), and those gaps used to be DEAD — a tap landing in one hit the row
// container and did nothing. That is what "sometimes the key doesn't take"
// actually was. `.key-hit` in globals.css extends each key's hit area to the
// middle of every gap so the targets tile with no holes.
//
// Two things have to hold at once, and only one of them is obvious:
//   1. no dead pixels across a whole key pitch
//   2. no OVERSHOOT — an expanded key must not steal its neighbour's edge and
//      type the wrong letter
//
// TWO TRAPS, both of which produced confident wrong answers here:
//
//  1. Do not reload between taps. Reloading for every x and clicking before
//     React had hydrated produced phantom "dead" offsets in the MIDDLE of keys.
//     Load once, wait for hydration, then tap.
//
//  2. Do not measure this by counting filled grid cells. After ~100 taps the
//     cursor sits on cells that already have letters, so a real keypress
//     OVERWRITES instead of adding and a cell count reads it as a miss — that
//     scored 5/24 live gaps against code that was actually fine. This question
//     is purely geometric ("did the tap land on a button?"), so instrument the
//     pointerdown events and read which button received them. Note this is the
//     opposite instrument from hold-delete.mjs, which must count cells precisely
//     because the bug it guards fires plenty of events against stale state.
import { chromium, devices } from 'playwright'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const SEL = '[data-grid] > div'
const b = await chromium.launch()
let pass = 0, fail = 0
const ok = (l, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ': ' + d : ''}`) }

for (const devName of ['iPhone SE', 'iPhone 13', 'iPhone 14 Pro Max']) {
  const d = devices[devName]
  if (!d) { console.log(`(${devName} unknown to this Playwright)`); continue }
  const page = await (await b.newContext({ ...d })).newPage()
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
  await page.waitForFunction(() => !!document.querySelector('div[aria-label="Letter keyboard"] button'))
  await page.waitForTimeout(400)                       // hydration

  const geo = await page.evaluate(() => {
    const kb = document.querySelector('div[aria-label="Letter keyboard"]')
    const rows = [...kb.children]
    return {
      kbHeight: Math.round(kb.getBoundingClientRect().height),
      rows: rows.map(r => [...r.querySelectorAll('button')].map(x => {
        const q = x.getBoundingClientRect()
        return { t: (x.textContent || '').trim() || 'DEL', x: q.x, w: q.width, y: q.y, h: q.height }
      })),
    }
  })
  // Record which button each pointerdown actually reached. null = it hit the row
  // container, i.e. a dead pixel.
  await page.evaluate(() => {
    window.__hits = []
    document.querySelector('div[aria-label="Letter keyboard"]').addEventListener(
      'pointerdown',
      e => {
        const b = e.target instanceof Element ? e.target.closest('button') : null
        window.__hits.push(b ? ((b.getAttribute('aria-label') === 'Delete') ? 'DEL' : b.textContent.trim()) : null)
      },
      true
    )
  })
  const tap = async (x, y) => {
    await page.evaluate(() => { window.__hits = [] })
    await page.mouse.click(x, y)
    await page.waitForTimeout(20)
    return page.evaluate(() => window.__hits[0] ?? null)
  }

  console.log(`\n=== ${devName} — keyboard ${geo.kbHeight}px ===`)

  // 1. every key centre works
  let centres = 0, total = 0
  for (const row of geo.rows) for (const k of row) {
    total++
    if (await tap(k.x + k.w / 2, k.y + k.h / 2) === k.t) centres++
  }
  ok('every key centre hits the right key', centres === total, `${centres}/${total}`)

  // 2. every horizontal gap is live
  let gapHits = 0, gaps = 0
  for (const row of geo.rows) for (let i = 1; i < row.length; i++) {
    gaps++
    const gx = (row[i - 1].x + row[i - 1].w + row[i].x) / 2
    const got = await tap(gx, row[i].y + row[i].h / 2)
    // Either neighbour is correct; the point is that it is not a hole.
    if (got === row[i - 1].t || got === row[i].t) gapHits++
  }
  ok('every key gap is live', gapHits === gaps, `${gapHits}/${gaps}`)

  // 3. every row gap is live
  let rowGapHits = 0
  for (let i = 1; i < geo.rows.length; i++) {
    const above = geo.rows[i - 1][3], below = geo.rows[i][3]
    const gy = (above.y + above.h + below.y) / 2
    if (await tap(below.x + below.w / 2, gy) !== null) rowGapHits++
  }
  ok('every row gap is live', rowGapHits === geo.rows.length - 1, `${rowGapHits}/${geo.rows.length - 1}`)

  // 4. no dead pixels AND no wrong letters across one full pitch
  const A = geo.rows[0][4], B = geo.rows[0][5]
  let dead = 0, wrong = 0
  for (let x = Math.round(A.x); x <= Math.round(B.x + B.w); x++) {
    const got = await tap(x, A.y + A.h / 2)
    if (got === null) { dead++; continue }
    if (got !== A.t && got !== B.t) wrong++
  }
  ok(`no dead pixels across the "${A.t}"→"${B.t}" pitch`, dead === 0, `${dead} dead px`)
  ok('no key steals its neighbour (only the two adjacent letters)', wrong === 0, `${wrong} wrong`)

  await page.close()
}
console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
