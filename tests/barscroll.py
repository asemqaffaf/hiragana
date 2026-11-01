"""A finger on the tab bar never scrolls the page; a vertical swipe on the page itself still does."""
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
        await pg.tap('[data-lang="en"]')
        await pg.fill('#nsName','A'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(700)
        await pg.tap('nav [data-nav="progress"]'); await pg.wait_for_timeout(1200)
        cdp = await ctx.new_cdp_session(pg)
        async def t(k,x,y): await cdp.send('Input.dispatchTouchEvent',{'type':k,'touchPoints':([] if k=='touchEnd' else [{'x':x,'y':y,'id':1}])})
        R={}
        c = await pg.evaluate("(()=>{const r=document.querySelector('nav.tabs [data-nav=progress]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
        pad = await pg.evaluate("(()=>{const r=document.querySelector('nav.tabs').getBoundingClientRect();return [r.left+r.width/2,r.top+2]})()")
        for name in ('on_button','on_bar_edge'):
            await pg.evaluate("window.scrollTo(0,300)"); await pg.wait_for_timeout(500)
            x,y = await pg.evaluate("(()=>{const r=document.querySelector('nav.tabs "+("[data-nav=progress]" if False else "")+"').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()") if name=='on_bar_edge' else await pg.evaluate("(()=>{const r=document.querySelector('nav.tabs [data-nav=progress]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]})()")
            if name=='on_bar_edge': y -= 24
            y0 = await pg.evaluate("scrollY")
            await t('touchStart',x,y); await pg.wait_for_timeout(60)
            for i in range(1,16): await t('touchMove',x,y-i*18); await pg.wait_for_timeout(16)
            mid = await pg.evaluate("scrollY")
            await t('touchEnd',x,y-270); await pg.wait_for_timeout(500)
            R[name]=[y0, mid, await pg.evaluate("scrollY"), await pg.evaluate("document.querySelector('nav.tabs [aria-selected=true]').dataset.nav")]
        # a vertical swipe on the page itself still scrolls
        await pg.evaluate("window.scrollTo(0,0)"); await pg.wait_for_timeout(200)
        await t('touchStart',200,400); await pg.wait_for_timeout(40)
        for i in range(1,12): await t('touchMove',200,400-i*25); await pg.wait_for_timeout(16)
        await t('touchEnd',200,125); await pg.wait_for_timeout(400)
        R['page_swipe_scrollY']=await pg.evaluate("scrollY"); R['errors']=errs
        print(json.dumps(R)); await b.close()
asyncio.run(main())
