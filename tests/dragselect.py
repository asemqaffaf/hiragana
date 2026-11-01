"""Press and drag on the tab bar (the glass lens) and the segmented controls: the item under the finger is chosen on release; while the finger is down nothing is chosen yet."""
import os, asyncio, json
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
from playwright.async_api import async_playwright
SEL = "document.querySelector('nav.tabs [aria-selected=true]').dataset.nav"
async def touch(cdp, kind, x, y):
    pts = [] if kind == 'touchEnd' else [{'x': x, 'y': y, 'id': 1}]
    await cdp.send('Input.dispatchTouchEvent', {'type': kind, 'touchPoints': pts})
async def drag(pg, cdp, x0, y0, x1, y1, steps=8, hold_check=None):
    await touch(cdp, 'touchStart', x0, y0); await pg.wait_for_timeout(60)
    mid = None
    for i in range(1, steps + 1):
        await touch(cdp, 'touchMove', x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await pg.wait_for_timeout(25)
        if hold_check and i == steps: mid = await pg.evaluate(hold_check)
    await touch(cdp, 'touchEnd', x1, y1); await pg.wait_for_timeout(450)
    return mid
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, dev in (('en', 'iPhone 13'), ('ar', 'iPhone SE')):
            ctx = await b.new_context(**p.devices[dev]); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(700)
            cdp = await ctx.new_cdp_session(pg)
            c = lambda n: pg.evaluate(f"(()=>{{const r=document.querySelector('nav.tabs [data-nav=\"{n}\"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}})()")
            home, letters, practice, progress = [await c(n) for n in ('home', 'letters', 'practice', 'progress')]
            R[lang + '_start'] = await pg.evaluate(SEL)
            # drag from Today to Progress: preview while the finger is down, chosen on release
            mid = await drag(pg, cdp, *home, *progress, hold_check="[document.querySelector('nav.tabs [aria-selected=true]').dataset.nav, document.querySelectorAll('nav.tabs .lens').length, (document.querySelector('nav.tabs .lens .on')||{}).dataset?.nav, location.hash]")
            R[lang + '_drag_home_to_progress'] = [mid, await pg.evaluate(SEL), await pg.evaluate('location.hash')]
            # drag and come back to where it started: nothing changes
            home, progress = [await c(n) for n in ('home', 'progress')]
            await touch(cdp, 'touchStart', *progress); await pg.wait_for_timeout(50)
            for x in (practice[0], letters[0], practice[0], progress[0]): await touch(cdp, 'touchMove', x, progress[1]); await pg.wait_for_timeout(40)
            await touch(cdp, 'touchEnd', *progress); await pg.wait_for_timeout(400)
            R[lang + '_drag_back_to_start'] = [await pg.evaluate(SEL), await pg.evaluate('location.hash')]
            # drag off the end of the bar: the nearest item
            await drag(pg, cdp, *progress, 2 if lang == 'en' else 388, progress[1])
            R[lang + '_drag_past_the_edge'] = await pg.evaluate(SEL)
            # a plain tap still works, and so does a quick tap right after a drag
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(300)
            R[lang + '_tap_after'] = [await pg.evaluate(SEL), await pg.evaluate('location.hash')]
            # the segmented control under Practice
            await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(400)
            seg = lambda s: pg.evaluate(f"(()=>{{const r=document.querySelector('#subnav [data-sub=\"{s}\"]').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}})()")
            a, d = await seg('drill'), await seg('phrases')
            await drag(pg, cdp, *a, *d)
            R[lang + '_seg_drag'] = [await pg.evaluate("document.querySelector('#subnav [aria-selected=true]').dataset.sub"), await pg.evaluate('location.hash')]
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
