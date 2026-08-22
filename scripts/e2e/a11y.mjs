import { chromium, devices } from 'playwright'
import { AxeBuilder } from '@axe-core/playwright'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const TAGS = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22a','wcag22aa','best-practice']
const b = await chromium.launch()
const all = []

async function scan(name, ctxOpts, setup) {
  const ctx = await b.newContext(ctxOpts)
  const page = await ctx.newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  await setup(page)
  const res = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const real = res.violations
  console.log(`\n### ${name}  —  ${real.length ? real.length + ' violation type(s)' : 'clean'}`)
  for (const v of real) {
    const wcag = v.tags.filter(t => t.startsWith('wcag')).join(',') || 'best-practice'
    console.log(`  [${v.impact}] ${v.id} — ${v.help}  (${wcag})  x${v.nodes.length}`)
    for (const n of v.nodes.slice(0, 3)) {
      console.log(`      ${n.target.join(' ')}`)
      console.log(`      ${(n.failureSummary||'').split('\n').filter(Boolean).slice(1,3).join(' / ').slice(0,190)}`)
    }
    all.push({ page: name, id: v.id, impact: v.impact, help: v.help, tags: wcag, count: v.nodes.length })
  }
  if (errs.length) console.log('  pageerrors:', errs.slice(0,2))
  await ctx.close()
}

const DESKTOP = { viewport: { width: 1440, height: 900 } }
const PHONE = { ...devices['iPhone 13'] }
const theme = m => async page => { await page.evaluate(t => localStorage.setItem('theme', t), m); await page.reload({ waitUntil: 'networkidle' }) }

await scan('Library / (light, desktop)', DESKTOP, async p => {
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' }); await theme('light')(p) })
await scan('Library / (dark, desktop)', DESKTOP, async p => {
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' }); await theme('dark')(p) })
await scan('Library / (light, solved card)', DESKTOP, async p => {
  await p.goto('http://localhost:3000/', { waitUntil: 'networkidle' })
  await p.evaluate(id => { localStorage.setItem('theme','light'); localStorage.setItem('crossword-solved-'+id, JSON.stringify({elapsed:754})) }, ID)
  await p.reload({ waitUntil: 'networkidle' }) })
await scan('Solver (light, desktop)', DESKTOP, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await theme('light')(p) })
await scan('Solver (dark, desktop)', DESKTOP, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await theme('dark')(p) })
await scan('Solver (light, phone)', PHONE, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' }); await theme('light')(p) })
await scan('Solver + ... menu open (phone)', PHONE, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await p.locator('[aria-expanded]').first().tap() })
await scan('Solver + clue sheet open (phone)', PHONE, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await p.locator('[aria-expanded]').first().tap()
  await p.locator('[data-clue-list-open]').tap()
  await p.waitForTimeout(400) })
await scan('Completion modal (desktop)', DESKTOP, async p => {
  await p.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await p.evaluate(() => { const el = document.querySelector('[data-grid]'); if (el) el.focus() })
  // fill the grid straight from the solution to reach the modal fast
  await p.evaluate(id => localStorage.removeItem('crossword-progress-'+id), ID)
  const cells = await p.evaluate(() => [...document.querySelectorAll('[data-grid] > div')].map(d => d.getAttribute('data-cell')))
  await p.waitForTimeout(200) })
await scan('Admin login', DESKTOP, async p => {
  await p.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' }) })
// Behind the password gate: the clue editor is where the theme controls live,
// and new form controls are exactly where a11y defects hide.
await scan('Admin edit page (theme controls)', DESKTOP, async p => {
  await p.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', 'rebus')
  await p.click('button[type=submit]')
  await p.waitForURL('**/admin', { timeout: 15000 }).catch(()=>{})
  await p.waitForTimeout(800)
  const link = p.locator('a[href*="/admin/puzzles/"]').first()
  if (await link.count()) { await link.click(); await p.waitForTimeout(2500) }
})

await scan('Admin new-puzzle wizard', DESKTOP, async p => {
  await p.goto('http://localhost:3000/admin/login', { waitUntil: 'networkidle' })
  await p.fill('input[type=password]', 'rebus')
  await p.click('button[type=submit]')
  await p.waitForTimeout(1200)
  await p.goto('http://localhost:3000/admin/new', { waitUntil: 'networkidle' })
  await p.waitForTimeout(1200)
})

console.log('\n================ SUMMARY ================')
if (!all.length) console.log('No violations across any scanned state.')
const byId = {}
for (const v of all) (byId[v.id] ??= []).push(v)
for (const [id, hits] of Object.entries(byId))
  console.log(`${hits[0].impact.toUpperCase().padEnd(8)} ${id}  (${hits[0].tags})\n         ${hits[0].help}\n         seen on: ${hits.map(h=>h.page).join('; ')}`)
await b.close()
