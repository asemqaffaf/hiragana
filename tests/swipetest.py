import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def drag(cdp, x, y0, y1, steps=12, dt=16, release=True):
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y0}]})
    for i in range(1, steps+1):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y0+(y1-y0)*i/steps}]}); await asyncio.sleep(dt/1000)
    if release: await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev]); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            cdp = await ctx.new_cdp_session(pg)
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(300)
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(1300)
            async def open_sheet():
                if await pg.locator('.sheet').count(): await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''"); await pg.wait_for_timeout(100)
                await pg.locator('#tab-chart [data-open]').first.tap(); await pg.wait_for_timeout(600)
            vh = await pg.evaluate('innerHeight'); 
            # 1 small drag from the handle: springs back
            await open_sheet(); box = await pg.evaluate("(()=>{const r=document.querySelector('.sheet .grab').getBoundingClientRect();return [r.x+r.width/2,r.y+3]})()")
            await drag(cdp, box[0], box[1], box[1]+50, release=False); await pg.wait_for_timeout(50)
            R[lang+'_follow_transform'] = await pg.evaluate("document.querySelector('.sheet').style.transform")
            R[lang+'_scrim_fading'] = await pg.evaluate("+document.querySelector('.scrim').style.opacity")
            await pg.screenshot(path=f'shots/swipe_{lang}_mid.png')
            await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]}); await pg.wait_for_timeout(450)
            R[lang+'_small_drag_still_open'] = await pg.locator('.sheet').count()
            await pg.wait_for_timeout(500); R[lang+'_sprung_back'] = await pg.evaluate("document.querySelector('.sheet').style.transform + '|' + document.querySelector('.sheet').getBoundingClientRect().bottom + '|' + innerHeight + '|' + getComputedStyle(document.querySelector('.sheet')).animationName")
            # 2 long drag from the sheet body (scrollTop 0): closes
            y = await pg.evaluate("(()=>{const r=document.querySelector('.sheet .hook').getBoundingClientRect();return r.y+8})()")
            await drag(cdp, 60, y, y+260); await pg.wait_for_timeout(500)
            R[lang+'_long_drag_closed'] = await pg.locator('.sheet').count() == 0
            R[lang+'_hash_after'] = await pg.evaluate('location.hash'); R[lang+'_scroll0'] = await pg.evaluate('0')
            # 3 fast flick: closes
            await open_sheet(); box = await pg.evaluate("(()=>{const r=document.querySelector('.sheet .grab').getBoundingClientRect();return [r.x+r.width/2,r.y+3]})()")
            await drag(cdp, box[0], box[1], box[1]+120, steps=3, dt=0); await pg.wait_for_timeout(500)
            R[lang+'_flick_closed'] = await pg.locator('.sheet').count() == 0
            # 4 drag up on the body: does not move the sheet
            await open_sheet(); y = await pg.evaluate("(()=>{const r=document.querySelector('.sheet .hook').getBoundingClientRect();return r.y+8})()")
            await drag(cdp, 60, y, y-120); await pg.wait_for_timeout(300)
            R[lang+'_up_drag'] = [await pg.locator('.sheet').count(), await pg.evaluate("document.querySelector('.sheet').style.transform")]
            # 5 sideways drag ignored
            await pg.evaluate("document.querySelector('.sheet').style.transform=''")
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
