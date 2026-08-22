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
  await link.click()
  await page.waitForTimeout(2500)

  console.log('\n--- controls exist ---')
  const radios = page.locator('[data-marquee-radio]')
  const boxes  = page.locator('[data-themer-checkbox]')
  ok('marquee radios rendered', await radios.count() > 0, `${await radios.count()}`)
  ok('themer checkboxes rendered', await boxes.count() > 0, `${await boxes.count()}`)
  ok('summary says no theme yet', (await page.locator('[data-theme-summary]').innerText()).includes('No theme set'))

  console.log('\n--- pick a marquee and two themers ---')
  const marqRef = await radios.nth(0).getAttribute('data-marquee-radio')
  await radios.nth(0).check()
  const t1 = await boxes.nth(1).getAttribute('data-themer-checkbox')
  const t2 = await boxes.nth(2).getAttribute('data-themer-checkbox')
  await boxes.nth(1).check(); await boxes.nth(2).check()
  const summary = await page.locator('[data-theme-summary]').innerText()
  ok('summary shows the marquee', summary.includes(marqRef), summary.replace(/\s+/g,' ').slice(0,90))
  ok('summary counts 2 theme answers', summary.includes('2 theme answers'))

  console.log('\n--- the roles are mutually exclusive ---')
  // make the FIRST themer the marquee; it must leave the themer list
  await page.locator(`[data-marquee-radio="${t1}"]`).check()
  const s2 = await page.locator('[data-theme-summary]').innerText()
  ok(`${t1} is now the marquee`, s2.includes(t1))
  ok(`${t1} was dropped from themers`, await page.locator(`[data-themer-checkbox="${t1}"]`).isChecked() === false)
  ok('only one marquee radio checked', await page.locator('[data-marquee-radio]:checked').count() === 1)
  // put it back
  await page.locator(`[data-marquee-radio="${marqRef}"]`).check()
  await page.locator(`[data-themer-checkbox="${t1}"]`).check()

  console.log('\n--- save ---')
  await page.locator('button:has-text("Save")').first().click()
  await page.waitForTimeout(3500)
  const after = (await get(puzzleId)).theme_set
  console.log('  DB now:', JSON.stringify(after))
  ok('marquee persisted', after && after.marquee === marqRef, `${after && after.marquee} vs ${marqRef}`)
  ok('both themers persisted', after && after.themers && after.themers.length === 2 &&
     after.themers.includes(t1) && after.themers.includes(t2), JSON.stringify(after && after.themers))

  console.log('\n--- reopen the editor: controls reflect saved state ---')
  await page.goto(`http://localhost:3000/admin/puzzles/${puzzleId}/edit`,{waitUntil:'networkidle'})
  await page.waitForTimeout(2500)
  ok('marquee radio checked on load', await page.locator(`[data-marquee-radio="${marqRef}"]`).isChecked())
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
