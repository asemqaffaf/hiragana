from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright

async def go(pg, tab):
    grp = {'plan':'home','chart':'letters','drill':'practice','write':'practice','read':'practice','progress':'progress','profile':'profile','phrases':'practice'}[tab]
    if grp == 'profile': await pg.click('#whoBtn'); await pg.wait_for_timeout(60); return
    await pg.click(f'nav [data-nav="{grp}"]')
    if grp == 'practice':
        sel = f'#subnav [data-sub="{tab}"]'
        if await pg.get_attribute(sel, 'aria-selected') != 'true': await pg.click(sel)
    await pg.wait_for_timeout(60)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ['en', 'ar']:
            for vw, vh in [(390, 844), (375, 667), (1280, 800)]:
                pg = await b.new_page(viewport={'width': vw, 'height': vh}); await pg.emulate_media(reduced_motion='reduce')
                await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
                await pg.click(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'X'); await submit_student(pg); await pg.wait_for_timeout(200)
                await go(pg, "write"); await pg.wait_for_timeout(300)
                t = await pg.evaluate("window.__hira.strokeTemplates('あ').pts"); bb = await pg.locator('#wpad').bounding_box()
                for s in t:
                    await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
                    for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
                    await pg.mouse.up()
                await pg.evaluate('window.scrollTo(0,0)'); await pg.wait_for_timeout(100)
                r = await pg.evaluate("""() => { const q = s => document.querySelector(s).getBoundingClientRect(); const nav = q('nav.tabs');
                  return {square: Math.round(q('#wsq').width), toolsBottom: Math.round(q('.tools').bottom), navTop: Math.round(nav.top), toolsVisible: q('.tools').bottom <= nav.top + 1}; }""")
                print(lang, f'{vw}x{vh}', r)
                if vw == 375: await pg.screenshot(path=f'shots/fit_{lang}_375.png')
                await pg.close()
        await b.close()
asyncio.run(main())
