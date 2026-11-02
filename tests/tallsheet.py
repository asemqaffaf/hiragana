from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def drag(cdp, x, y0, y1, steps=8, end=True):
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y0}]})
    for i in range(1, steps+1):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y0+(y1-y0)*i/steps}]}); await asyncio.sleep(0.03)
    if end: await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for name in ['iPhone SE landscape', 'iPhone 13 landscape']:
            ctx = await b.new_context(**p.devices[name]); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            cdp = await ctx.new_cdp_session(pg)
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap('[data-lang="en"]'); await pg.fill('#nsName','M'); await submit_student(pg); await pg.wait_for_timeout(500)
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(1300)
            await pg.locator('#tab-chart [data-open]').nth(8).tap(); await pg.wait_for_timeout(700)
            m = lambda: pg.evaluate("(()=>{const s=document.querySelector('.sheet');return {scrollY:Math.round(scrollY),sheetTop:Math.round(s.scrollTop),canScroll:s.scrollHeight>s.clientHeight+1,open:true,vh:innerHeight}})()")
            R[name+'_open'] = await m()
            vh = (await m())['vh']
            # swipe up inside the sheet text -> sheet scrolls, page does not
            await drag(cdp, 200, vh-60, vh-200); await pg.wait_for_timeout(200)
            R[name+'_after_swipe_up'] = await m()
            # swipe down on the body while scrolled: scrolls back, must NOT close
            await drag(cdp, 200, vh-150, vh-40); await pg.wait_for_timeout(500)
            R[name+'_still_open_after_down_when_scrolled'] = await pg.locator('.sheet').count() == 1
            R[name+'_after_swipe_down'] = await m() if await pg.locator('.sheet').count() else 'closed'
            # handle always closes
            if await pg.locator('.sheet').count():
                await pg.evaluate("document.querySelector('.sheet').scrollTop=0")
                gb = await pg.evaluate("(()=>{const r=document.querySelector('.sheet .grab').getBoundingClientRect();return [r.x+r.width/2,r.y+3]})()")
                await drag(cdp, gb[0], gb[1], gb[1]+190, steps=6); await pg.wait_for_timeout(600)
                R[name+'_handle_drag_closed'] = await pg.locator('.sheet').count() == 0
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, indent=1)); await b.close()
asyncio.run(main())
