// Theme links: selecting the marquee lights every theme answer; selecting a
// theme answer lights the marquee ONLY, not its siblings.
//
// Self-seeding — it writes a theme set straight into the row over the REST API,
// asserts, then restores whatever was there before. That keeps it repeatable and
// avoids "set this up in admin first" instructions that rot. It needs
// SUPABASE_URL / ANON_KEY in the environment:
//
//   cd <repo> && set -a && source .env.local && set +a
//   node theme-links.mjs [puzzleId]
//
// Requires the theme_set column to exist (supabase/schema.sql).
import { chromium } from 'playwright'

const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL || !KEY) { console.error('Set NEXT_PUBLIC_SUPABASE_URL and _ANON_KEY (source .env.local)'); process.exit(2) }
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

const rest = async (method, qs, body) => {
  const r = await fetch(`${URL}/rest/v1/puzzles?${qs}`, {
    method, headers: { ...H, Prefer: 'return=representation' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!r.ok) throw new Error(`${method} ${qs} -> ${r.status} ${await r.text()}`)
  return r.json()
}

const [row] = await rest('GET', `select=grid,theme_set&id=eq.${ID}`)
const original = row.theme_set
const grid = row.grid
const cols = grid[0].length
const white = (r, c) => r >= 0 && r < grid.length && c >= 0 && c < cols && grid[r][c].t === 'w'
const words = dir => {
  const out = []
  const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0]
  for (let r = 0; r < grid.length; r++) for (let c = 0; c < cols; c++)
    if (white(r, c) && !white(r - dr, c - dc) && white(r + dr, c + dc)) {
      const cells = []
      for (let rr = r, cc = c; white(rr, cc); rr += dr, cc += dc) cells.push([rr, cc])
      out.push({ number: grid[r][c].n, cells })
    }
  return out
}
const ACROSS = words('across'), DOWN = words('down')
// A marquee and three themers, all at least 3 long, none crossing each other's
// cells (a shared cell would make "lit because linked" ambiguous).
const pick = []
for (const w of [...ACROSS]) {
  if (w.cells.length < 3) continue
  if (pick.some(p => p.cells.some(([r, c]) => w.cells.some(([r2, c2]) => r === r2 && c === c2)))) continue
  pick.push(w)
  if (pick.length === 4) break
}
// Two marquees and two themers: a puzzle can have more than one revealer, and
// the interesting case is that marquees light EACH OTHER as well as the themers.
const [M1, M2, T1, T2] = pick
const MARQUEES = [M1, M2], THEMERS = [T1, T2]
const themeSet = {
  marquees: MARQUEES.map(m => `${m.number}A`),
  themers: THEMERS.map(t => `${t.number}A`),
}
console.log('seeding', JSON.stringify(themeSet))
await rest('PATCH', `id=eq.${ID}`, { theme_set: themeSet })

const b = await chromium.launch()
const SEL = '[data-grid] > div'
const idx = (r, c) => r * cols + c
let pass = 0, fail = 0
const ok = (l, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ': ' + d : ''}`) }

try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
  const errs = []
  const fresh = async () => {
    const page = await ctx.newPage()
    page.on('pageerror', e => errs.push(String(e)))
    page.on('console', m => m.type() === 'error' && errs.push(m.text()))
    await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.clear())
    await page.reload({ waitUntil: 'networkidle' })
    await page.waitForSelector(SEL)
    return page
  }
  // Never click straight at the target. Clicking the cell that is ALREADY active
  // toggles direction, and on a fresh load the cursor sits on the first white
  // cell — which is 1-Across's first cell, i.e. exactly the marquee in most
  // grids. That silently made the active answer 1 DOWN and lit nothing. So:
  // click a scratch cell first, then the target, then nudge with the arrows,
  // which forces a known direction (MOVE derives it from the delta).
  const scratch = (() => {
    const used = new Set(pick.flatMap(w => w.cells.map(([r, c]) => `${r},${c}`)))
    for (let r = grid.length - 1; r >= 0; r--)
      for (let c = 0; c < cols; c++)
        if (white(r, c) && !used.has(`${r},${c}`)) return [r, c]
    return null
  })()
  const linkedAt = async cell => {
    const page = await fresh()
    if (scratch) await page.locator(SEL).nth(idx(...scratch)).click()
    await page.locator(SEL).nth(idx(...cell)).click()
    // Force ACROSS regardless of what the click left behind.
    const [r, c] = cell
    if (white(r, c + 1)) { await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft') }
    else { await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight') }
    await page.waitForTimeout(120)
    const keys = await page.evaluate(s => [...document.querySelectorAll(s)]
      .map((d, i) => d.hasAttribute('data-linked') ? i : -1).filter(i => i >= 0), SEL)
    await page.close()
    return keys.sort((a, z) => a - z)
  }
  const cellsOf = w => w.cells.map(([r, c]) => idx(r, c)).sort((a, z) => a - z)

  const sortNum = a => [...a].sort((x, z) => x - z)

  console.log('\n--- a marquee lights every themer AND the other marquee ---')
  for (const [i, m] of MARQUEES.entries()) {
    const lit = await linkedAt(m.cells[0])
    const others = MARQUEES.filter((_, j) => j !== i)
    const expect = sortNum([...others, ...THEMERS].flatMap(cellsOf))
    ok(`marquee ${i + 1}: other marquee + all themers lit`,
       JSON.stringify(lit) === JSON.stringify(expect), `${lit.length} lit, expected ${expect.length}`)
    ok(`marquee ${i + 1} does not light itself`, !lit.some(x => cellsOf(m).includes(x)))
  }

  console.log('\n--- a theme answer lights ALL marquees, and no sibling themer ---')
  for (const [i, t] of THEMERS.entries()) {
    const lit = await linkedAt(t.cells[0])
    const expect = sortNum(MARQUEES.flatMap(cellsOf))
    ok(`themer ${i + 1} lights both marquees`, JSON.stringify(lit) === JSON.stringify(expect),
       `${lit.length} lit, expected ${expect.length}`)
    const siblingCells = THEMERS.filter((_, j) => j !== i).flatMap(cellsOf)
    ok(`themer ${i + 1} does NOT light its siblings`, !lit.some(x => siblingCells.includes(x)))
  }

  console.log('\n--- one marquee behaves exactly as it did before ---')
  await rest('PATCH', `id=eq.${ID}`, { theme_set: { marquees: [`${M1.number}A`], themers: themeSet.themers } })
  const solo = await linkedAt(M1.cells[0])
  ok('lone marquee lights just the themers',
     JSON.stringify(solo) === JSON.stringify(sortNum(THEMERS.flatMap(cellsOf))),
     `${solo.length} lit`)
  ok('themer lights the lone marquee',
     JSON.stringify(await linkedAt(T1.cells[0])) === JSON.stringify(cellsOf(M1)))
  await rest('PATCH', `id=eq.${ID}`, { theme_set: themeSet })

  console.log('\n--- the LEGACY single-marquee shape still works ---')
  // Rows written before multiple marquees were allowed are still in the DB.
  await rest('PATCH', `id=eq.${ID}`, { theme_set: { marquee: `${M1.number}A`, themers: themeSet.themers } })
  ok('legacy {marquee:"..."} still lights the themers',
     JSON.stringify(await linkedAt(M1.cells[0])) === JSON.stringify(sortNum(THEMERS.flatMap(cellsOf))))
  await rest('PATCH', `id=eq.${ID}`, { theme_set: themeSet })

  console.log('\n--- an unrelated answer lights nothing ---')
  const outsider = ACROSS.find(w => !pick.includes(w) && w.cells.length >= 3)
  if (outsider) ok('no linked cells', (await linkedAt(outsider.cells[0])).length === 0)

  console.log('\n--- the active word wins over a linked cell ---')
  const page = await fresh()
  if (scratch) await page.locator(SEL).nth(idx(...scratch)).click()
  await page.locator(SEL).nth(idx(...M1.cells[0])).click()
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(120)
  const both = await page.evaluate(s => [...document.querySelectorAll(s)]
    .filter(d => d.hasAttribute('data-linked') && d.hasAttribute('data-in-word')).length, SEL)
  ok('no cell is both linked and in-word', both === 0)
  await page.close()

  console.log('\n--- with no theme set, nothing is ever linked ---')
  await rest('PATCH', `id=eq.${ID}`, { theme_set: {} })
  ok('marquee cell lights nothing now', (await linkedAt(M1.cells[0])).length === 0)

  ok('no console/page errors', errs.length === 0, errs.slice(0, 3).join(' | '))
} finally {
  await rest('PATCH', `id=eq.${ID}`, { theme_set: original ?? {} })
  console.log(`\nrestored theme_set to ${JSON.stringify(original)}`)
  await b.close()
}
console.log(`${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
process.exit(fail ? 1 : 0)
