// The full-but-wrong modal must not have disturbed the completion flow.
//
// Runs the SAME set of assertions down two paths and compares them:
//   A. a clean solve, never seeing the wrong-answer modal
//   B. a solve that goes THROUGH it — fill with one wrong letter, dismiss the
//      modal, fix the letter, complete
//
// Path B is the new one and the one at risk: dismissing a modal mid-solve, then
// completing, must produce byte-identical end state to never having seen it.
import { chromium } from 'playwright'
import fs from 'fs'
const ID = process.argv[2] ?? 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json', 'utf8'))
const cols = grid[0].length
const white = []
grid.forEach((row, r) => row.forEach((c, ci) => { if (c.t === 'w') white.push({ r, c: ci, l: c.l, i: r * cols + ci }) }))
const SEL = '[data-grid] > div'
const b = await chromium.launch()
let pass = 0, fail = 0
const ok = (l, c, d = '') => { c ? pass++ : fail++; console.log(`  ${c ? 'PASS' : 'FAIL'}  ${l}${d ? ': ' + d : ''}`) }

async function run(path) {
  const page = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
  const errs = []
  page.on('pageerror', e => errs.push(String(e)))
  page.on('console', m => m.type() === 'error' && errs.push(m.text()))
  await page.goto(`http://localhost:3000/puzzles/${ID}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector(SEL)
  const type = async (cell, l) => { await page.locator(SEL).nth(cell.i).click(); await page.keyboard.press(l) }
  const last = white[white.length - 1]

  let sawWrongModal = false
  if (path === 'through-the-modal') {
    for (const c of white.slice(0, -1)) await type(c, c.l)
    await type(last, last.l === 'X' ? 'W' : 'X')          // full, one wrong
    await page.waitForTimeout(500)
    sawWrongModal = await page.locator('[data-wrong-modal]').count() === 1
    await page.locator('[data-wrong-modal] button').click()
    await page.waitForTimeout(250)
    await type(last, last.l)                              // fix it -> completes
  } else {
    for (const c of white) await type(c, c.l)
  }

  const timerAtComplete = await page.locator('[data-timer]').innerText().catch(() => null)
  await page.waitForTimeout(3600)                          // sweep 2200 + gold + modal 600

  const res = {
    sawWrongModal,
    celebrating: await page.locator('[data-grid][data-celebrating]').count(),
    completeModal: await page.locator('[data-complete-modal]').count(),
    trophy: await page.locator('[data-complete-mark]').count(),
    wrongModalStillUp: await page.locator('[data-wrong-modal]').count(),
    timerAtComplete,
    timerAfter: await page.locator('[data-timer]').innerText().catch(() => null),
    solved: await page.evaluate(id => localStorage.getItem('crossword-solved-' + id), ID),
    progress: await page.evaluate(id => localStorage.getItem('crossword-progress-' + id), ID),
  }
  // timer must be frozen: read again after a further 2s
  await page.waitForTimeout(2000)
  res.timerLater = await page.locator('[data-timer]').innerText().catch(() => null)

  // and the solved grid must reject further input
  await page.locator('[data-complete-modal] button').click().catch(() => {})
  await page.waitForTimeout(300)
  const before = await page.locator(SEL).nth(white[0].i).innerText()
  await type(white[0], white[0].l === 'Z' ? 'Q' : 'Z')
  await page.waitForTimeout(200)
  res.readOnly = (await page.locator(SEL).nth(white[0].i).innerText()) === before
  res.goldAfterEdit = await page.locator('[data-grid][data-celebrating]').count()
  res.errs = errs
  await page.close()
  return res
}

const A = await run('clean')
const B = await run('through-the-modal')

console.log('\n--- A. clean solve ---')
ok('never saw the wrong-answer modal', A.sawWrongModal === false)
console.log('\n--- B. solve that went through the wrong-answer modal ---')
ok('the wrong-answer modal did appear', B.sawWrongModal === true)

for (const [name, r] of [['A clean', A], ['B via modal', B]]) {
  console.log(`\n--- ${name}: completion behaviour ---`)
  ok(`${name}: grid turned gold`, r.celebrating === 1, `data-celebrating=${r.celebrating}`)
  ok(`${name}: completion modal shown`, r.completeModal === 1)
  ok(`${name}: trophy shown`, r.trophy === 1)
  ok(`${name}: wrong-answer modal is gone`, r.wrongModalStillUp === 0)
  ok(`${name}: timer froze`, r.timerAfter === r.timerLater && r.timerAfter === r.timerAtComplete,
     `at-complete ${r.timerAtComplete} -> ${r.timerAfter} -> ${r.timerLater}`)
  ok(`${name}: solved record written`, !!r.solved && /"elapsed":\d+/.test(r.solved), String(r.solved))
  ok(`${name}: in-progress record cleared`, r.progress === null, String(r.progress))
  ok(`${name}: solved grid is read-only`, r.readOnly === true)
  ok(`${name}: still gold after an attempted edit`, r.goldAfterEdit === 1)
  ok(`${name}: no console or page errors`, r.errs.length === 0, r.errs.slice(0, 2).join(' | '))
}

console.log('\n--- the two paths end in the same state ---')
const shape = r => JSON.stringify({ celebrating: r.celebrating, completeModal: r.completeModal, trophy: r.trophy,
  wrongModalStillUp: r.wrongModalStillUp, progress: r.progress, readOnly: r.readOnly, goldAfterEdit: r.goldAfterEdit,
  frozen: r.timerAfter === r.timerLater })
ok('identical end state', shape(A) === shape(B), `\n      A=${shape(A)}\n      B=${shape(B)}`)

console.log(`\n${fail ? `${fail} FAILED, ` : ''}${pass} passed`)
await b.close()
process.exit(fail ? 1 : 0)
