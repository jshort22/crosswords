import { chromium } from 'playwright'
import fs from 'fs'
const ID = 'a4f31732-5143-4fc9-b73c-a197db1fb41d'
const grid = JSON.parse(fs.readFileSync('/tmp/grid.json','utf8'))
const cols = grid[0].length
const white = []
grid.forEach((row,r)=>row.forEach((c,ci)=>{if(c.t==='w')white.push({r,c:ci,l:c.l,i:r*cols+ci})}))
const b = await chromium.launch(); const page = await b.newPage()
const sel = '.grid.select-none > div'
await page.goto(`http://localhost:3000/puzzles/${ID}`,{waitUntil:'networkidle'})
await page.evaluate(()=>localStorage.clear())
await page.goto(`http://localhost:3000/puzzles/${ID}`,{waitUntil:'networkidle'})
await page.waitForSelector(sel)
const type = async (cell,l)=>{await page.locator(sel).nth(cell.i).click();await page.keyboard.press(l)}

const last = white[white.length-1]
for (const c of white.slice(0,-1)) await type(c, c.l)
await type(last, last.l === 'X' ? 'W' : 'X')   // final letter wrong
await page.waitForTimeout(500)
console.log(`ERROR_BANNER_SHOWN=${await page.locator('text=At least one letter is wrong').count() > 0}`)
console.log(`gold_prematurely=${await page.locator('.grid.select-none.bg-amber-400').count() > 0}`)
console.log(`modal_prematurely=${await page.locator('text=Puzzle Complete!').count() > 0}`)

await type(last, last.l)  // now fix it
await page.waitForTimeout(400)
console.log(`BANNER_CLEARED=${await page.locator('text=At least one letter is wrong').count() === 0}`)
await page.waitForTimeout(3300)
console.log(`gold=${await page.locator('.grid.select-none.bg-amber-400').count()} modal=${await page.locator('text=Puzzle Complete!').count()>0} trophy=${await page.locator('text=🏆').count()>0}`)
console.log(`solved=${await page.evaluate(id=>localStorage.getItem('crossword-solved-'+id),ID)}`)
await b.close()
