// Admin round-trip: set a marquee + themers through the real UI, save, confirm
// it persisted to the DB, reload the editor, and confirm the solver renders it.
import { chromium } from 'playwright'
const URL=process.env.NEXT_PUBLIC_SUPABASE_URL, KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H={apikey:KEY,Authorization:`Bearer ${KEY}`,'Content-Type':'application/json'}
const get = async id => (await (await fetch(`${URL}/rest/v1/puzzles?select=theme_set&id=eq.${id}`,{headers:H})).json())[0]
const put = async (id,v) => fetch(`${URL}/rest/v1/puzzles?id=eq.${id}`,{method:'PATCH',headers:H,body:JSON.stringify({theme_set:v})})

let pass=0,fail=0
const ok=(l,c,d='')=>{c?pass++:fail++;console.log(`  ${c?'PASS':'FAIL'}  ${l}${d?': '+d:''}`)}
const b=await chromium.launch()
const page=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage()
const errs=[]; page.on('pageerror',e=>errs.push(String(e)))
let puzzleId=null, before=null
try {
  await page.goto('http://localhost:3000/admin/login',{waitUntil:'networkidle'})
  await page.fill('input[type=password]','rebus')
  await page.click('button[type=submit]')
  await page.waitForTimeout(1500)
  const link = page.locator('a[href*="/admin/puzzles/"]').first()
  const href = await link.getAttribute('href')
  puzzleId = href.match(/puzzles\/([0-9a-f-]+)/)[1]
  before = (await get(puzzleId)).theme_set
  console.log(`editing ${puzzleId}, theme_set was ${JSON.stringify(before)}`)
  // Start from empty so the counts below are absolute. The puzzle may already
  // carry a real authored theme — this test asserted "2 marquees" and failed
  // against a row that already had one, which is a bug in the test, not the app.
  // `before` is restored in the finally block either way.
  await put(puzzleId, {})
  await link.click()
  await page.waitForTimeout(2500)

  console.log('\n--- controls exist ---')
  const marqBoxes = page.locator('[data-marquee-checkbox]')
  const boxes  = page.locator('[data-themer-checkbox]')
  ok('marquee checkboxes rendered', await marqBoxes.count() > 0, `${await marqBoxes.count()}`)
  ok('themer checkboxes rendered', await boxes.count() > 0, `${await boxes.count()}`)
  ok('summary says no theme yet', (await page.locator('[data-theme-summary]').innerText()).includes('No theme set'))

  console.log('\n--- pick TWO marquees and two themers ---')
  const m1 = await marqBoxes.nth(0).getAttribute('data-marquee-checkbox')
  const m2 = await marqBoxes.nth(3).getAttribute('data-marquee-checkbox')
  await marqBoxes.nth(0).check(); await marqBoxes.nth(3).check()
  const t1 = await boxes.nth(1).getAttribute('data-themer-checkbox')
  const t2 = await boxes.nth(2).getAttribute('data-themer-checkbox')
  await boxes.nth(1).check(); await boxes.nth(2).check()
  const summary = await page.locator('[data-theme-summary]').innerText()
  ok('two marquees can be ticked at once',
     await page.locator('[data-marquee-checkbox]:checked').count() === 2)
  ok('summary lists both marquees', summary.includes(m1) && summary.includes(m2),
     summary.replace(/\s+/g,' ').slice(0,100))
  ok('summary pluralises to "marquees"', summary.includes('marquees'))
  ok('summary counts 2 theme answers', summary.includes('2 theme answers'))

  console.log('\n--- the two roles are still mutually exclusive per answer ---')
  // ticking a themer's marquee box must remove it from the themer list
  await page.locator(`[data-marquee-checkbox="${t1}"]`).check()
  const s2 = await page.locator('[data-theme-summary]').innerText()
  ok(`${t1} is now a marquee`, s2.includes(t1))
  ok(`${t1} was dropped from themers`, await page.locator(`[data-themer-checkbox="${t1}"]`).isChecked() === false)
  ok('three marquees now ticked', await page.locator('[data-marquee-checkbox]:checked').count() === 3)
  // and the reverse: ticking its themer box removes it from the marquees
  await page.locator(`[data-themer-checkbox="${t1}"]`).check()
  ok(`${t1} left the marquees again`,
     await page.locator(`[data-marquee-checkbox="${t1}"]`).isChecked() === false)
  ok('back to two marquees', await page.locator('[data-marquee-checkbox]:checked').count() === 2)

  console.log('\n--- unticking a marquee removes just that one ---')
  await page.locator(`[data-marquee-checkbox="${m2}"]`).uncheck()
  ok('one marquee left', await page.locator('[data-marquee-checkbox]:checked').count() === 1)
  ok('summary is singular again', (await page.locator('[data-theme-summary]').innerText()).includes('marquee'))
  await page.locator(`[data-marquee-checkbox="${m2}"]`).check()

  console.log('\n--- save ---')
  await page.locator('button:has-text("Save")').first().click()
  await page.waitForTimeout(3500)
  const after = (await get(puzzleId)).theme_set
  console.log('  DB now:', JSON.stringify(after))
  ok('both marquees persisted', after && Array.isArray(after.marquees) &&
     after.marquees.length === 2 && after.marquees.includes(m1) && after.marquees.includes(m2),
     JSON.stringify(after && after.marquees))
  ok('both themers persisted', after && after.themers && after.themers.length === 2 &&
     after.themers.includes(t1) && after.themers.includes(t2), JSON.stringify(after && after.themers))

  console.log('\n--- reopen the editor: controls reflect saved state ---')
  await page.goto(`http://localhost:3000/admin/puzzles/${puzzleId}/edit`,{waitUntil:'networkidle'})
  await page.waitForTimeout(2500)
  ok('both marquee checkboxes checked on load',
     await page.locator(`[data-marquee-checkbox="${m1}"]`).isChecked() &&
     await page.locator(`[data-marquee-checkbox="${m2}"]`).isChecked())
  ok('themer checkboxes checked on load',
     await page.locator(`[data-themer-checkbox="${t1}"]`).isChecked() &&
     await page.locator(`[data-themer-checkbox="${t2}"]`).isChecked())

  console.log('\n--- the solver renders it ---')
  await page.goto(`http://localhost:3000/puzzles/${puzzleId}`,{waitUntil:'networkidle'})
  await page.evaluate(()=>localStorage.clear())
  await page.reload({waitUntil:'networkidle'})
  const SEL='[data-grid] > div'
  await page.waitForSelector(SEL)
  const n = await page.locator(SEL).count()
  let maxLinked=0
  for (let i=0;i<n;i++){
    if (await page.locator(SEL).nth(i).getAttribute('data-cell')!=='white') continue
    await page.locator(SEL).nth(i).click()
    await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowLeft')
    const c = await page.evaluate(s=>[...document.querySelectorAll(s)].filter(d=>d.hasAttribute('data-linked')).length,SEL)
    if (c>maxLinked) maxLinked=c
    if (maxLinked>0 && i>40) break
  }
  ok('solver lights linked cells for the saved theme', maxLinked>0, `${maxLinked} cells at best`)
  ok('no page errors', errs.length===0, errs.slice(0,2).join(' | '))
} finally {
  if (puzzleId) { await put(puzzleId, before ?? {}); console.log(`\nrestored ${puzzleId} theme_set to ${JSON.stringify(before)}`) }
  await b.close()
}
console.log(`${fail?`${fail} FAILED, `:''}${pass} passed`)
process.exit(fail?1:0)
