"""iPhone mode (no Vibration API): each repeat-menu button carries a switch overlay for the real-tap haptic, and still works."""
from student_auth import disable_cloud, submit_student
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
import asyncio, json
from playwright.async_api import async_playwright


async def hold(cdp, x, y, ms):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    await asyncio.sleep(ms / 1000)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


async def main():
    R = {}; errs = []
    async with async_playwright() as p:
        kw = {'executable_path': os.environ['CHROME_PATH'], 'args': ['--no-sandbox']} if os.environ.get('CHROME_PATH') else {}
        kw['args'] = kw.get('args', []) + ['--autoplay-policy=no-user-gesture-required']
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("Object.defineProperty(navigator, 'vibrate', {value: undefined, configurable: true})")
        await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        await pg.tap('[data-lang="en"]'); await pg.fill('#nsName', 'Aya'); await submit_student(pg); await pg.wait_for_timeout(700)
        cdp = await ctx.new_cdp_session(pg)
        await pg.tap('nav.tabs [data-tab="letters"], nav.tabs button:nth-child(2)'); await pg.wait_for_timeout(400)
        kb = pg.locator('.kb[data-open]').first
        box = await kb.bounding_box()
        await hold(cdp, box['x'] + box['width'] / 2, box['y'] + box['height'] / 2, 650); await pg.wait_for_timeout(300)
        R['menu_open'] = await pg.locator('.rep-pop').count() == 1
        R['overlay_on_each_chip'] = await pg.locator('.rep-pop .rep-tw > label.rep-tk > input[switch]').count() == 6
        lab = pg.locator('.rep-pop .rep-tw:has(.rep-n[data-n="4"]) label.rep-tk')
        lb = await lab.bounding_box(); cb = await pg.locator('.rep-n[data-n="4"]').bounding_box()
        R['overlay_covers_chip'] = abs(lb['width'] - cb['width']) < 2 and abs(lb['height'] - cb['height']) < 2
        await pg.touchscreen.tap(lb['x'] + lb['width'] / 2, lb['y'] + lb['height'] / 2); await pg.wait_for_timeout(500)
        R['tap_starts_repeat'] = await pg.locator('.rep-now').count() == 1 and await pg.locator('.rep-pop').count() == 0
        R['count_text'] = await pg.locator('.rep-now-c').first.text_content() if await pg.locator('.rep-now-c').count() else None; print(R)
        R['stop_has_overlay'] = await pg.locator('.rep-now .rep-tw label.rep-tk').count() == 1
        sb = await pg.locator('.rep-now .rep-tk').bounding_box()
        await pg.touchscreen.tap(sb['x'] + sb['width'] / 2, sb['y'] + sb['height'] / 2); await pg.wait_for_timeout(600)
        R['stop_works'] = await pg.locator('.rep-now').count() == 0
        R['errors'] = errs
        print(json.dumps(R, indent=1)); await b.close()
    bad = [k for k, v in R.items() if v is False or (k == 'errors' and v)]
    assert not bad, bad
asyncio.run(main())
