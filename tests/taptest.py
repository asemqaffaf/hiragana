import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required']); R = {}; errs = []
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev], color_scheme='dark'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(1200)
            # layout after going back, repeatedly
            ok = []
            for nav in ['letters','practice','progress','letters']:
                await pg.tap(f'nav [data-nav="{nav}"]'); await pg.wait_for_timeout(80)
                await pg.tap('#backBtn'); await pg.wait_for_timeout(120)
                ok.append(await pg.evaluate("(()=>{const t=document.querySelector('#tab-plan');return getComputedStyle(t).display+'|'+(document.documentElement.scrollWidth===innerWidth)+'|'+t.className})()"))
            R[lang+'_after_back'] = ok
            # whole example row plays (tap the left, away from the speaker button)
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(1300)
            await pg.locator('#tab-chart [data-open]').first.tap(); await pg.wait_for_timeout(600)
            row = pg.locator('.sheet .morex .mx').first
            async with pg.expect_response(lambda r: '/audio/' in r.url) as ri: await row.tap(position={'x': 12, 'y': 12})
            R[lang+'_sheet_row_audio'] = (await ri.value).status in (200, 304)
            R[lang+'_sheet_row_playing_class'] = await row.evaluate("e=>e.classList.contains('playing')")
            await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''")
            # read tab word box, phrases box
            for tab, sel in [('read','#tab-read .word'), ('phrases','#tab-phrases .word')]:
                await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(150)
                await pg.evaluate(f"document.querySelector('[data-sub=\"{tab}\"], #subnav [data-tab=\"{tab}\"]') && document.querySelector('[data-sub=\"{tab}\"], #subnav [data-tab=\"{tab}\"]').click()")
                await pg.wait_for_timeout(250)
                n = await pg.locator(sel).count()
                if n:
                    async with pg.expect_response(lambda r: '/audio/' in r.url) as ri: await pg.locator(sel).first.tap(position={'x': 10, 'y': 10})
                    R[lang+'_'+tab+'_box_audio'] = (await ri.value).status in (200, 304)
                else: R[lang+'_'+tab+'_box_audio'] = 'no boxes found'
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
