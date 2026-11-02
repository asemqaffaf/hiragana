from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def drag(cdp, x, y0, y1, steps=8):
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y0}]})
    for i in range(1, steps+1):
        await cdp.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x,'y':y0+(y1-y0)*i/steps}]}); await asyncio.sleep(0.02)
    await cdp.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE'),('en','iPhone SE landscape'),('ar','iPhone 13 landscape')]:
            ctx = await b.new_context(**p.devices[dev]); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            cdp = await ctx.new_cdp_session(pg)
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await submit_student(pg); await pg.wait_for_timeout(500)
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(1300)
            await pg.evaluate("window.scrollTo(0, 300)"); await pg.wait_for_timeout(100)
            y0 = await pg.evaluate("scrollY"); R[lang+dev[-3:]+'_start_scrollY'] = y0
            await pg.locator('#tab-chart [data-open]').nth(8).tap(); await pg.wait_for_timeout(600)
            R[lang+dev[-3:]+'_html_class'] = await pg.evaluate("document.documentElement.className"); R[lang+dev[-3:]+'_overflow'] = await pg.evaluate("getComputedStyle(document.documentElement).overflow")
            # swipe up on the backdrop above the sheet (scroll attempt)
            top = await pg.evaluate("document.querySelector('.sheet').getBoundingClientRect().top")
            await drag(cdp, 200, max(40, top-20), 10)   # drag up from the scrim
            R[lang+dev[-3:]+'_scrollY_after_backdrop_swipe'] = await pg.evaluate("scrollY")
            # swipe up and down inside the sheet text
            hy = await pg.evaluate("document.querySelector('.sheet .hook').getBoundingClientRect().y+6")
            await drag(cdp, 60, hy, hy-150); R[lang+dev[-3:]+'_scrollY_after_sheet_up'] = await pg.evaluate("scrollY")
            await pg.mouse.move(200, 20); await pg.mouse.wheel(0, 600); await pg.wait_for_timeout(200)
            R[lang+dev[-3:]+'_scrollY_after_wheel'] = await pg.evaluate("scrollY")
            # close, page scrolls again and keeps its place
            await pg.evaluate("document.querySelector('.sheet [data-close]').click()"); await pg.wait_for_timeout(500)
            R[lang+dev[-3:]+'_class_after_close'] = await pg.evaluate("document.documentElement.className")
            R[lang+dev[-3:]+'_scrollY_after_close'] = await pg.evaluate("scrollY")
            await pg.mouse.wheel(0, 200); await pg.wait_for_timeout(200)
            R[lang+dev[-3:]+'_scrolls_again'] = await pg.evaluate("scrollY") > y0
            # profile sheet: long one still scrolls inside
            await pg.tap('#whoBtn'); await pg.wait_for_timeout(600)
            R[lang+dev[-3:]+'_profile_is_sheet_or_tab'] = await pg.evaluate("!!document.querySelector('.sheet')")
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
