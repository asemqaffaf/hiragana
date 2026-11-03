from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio
from playwright.async_api import async_playwright

async def go(pg, tab):
    grp = {'plan':'home','chart':'letters','drill':'practice','write':'practice','read':'practice','progress':'progress','profile':'profile','phrases':'practice'}[tab]
    if grp == 'profile': await pg.click('#whoBtn'); await pg.wait_for_timeout(2000); return
    await pg.click(f'nav [data-nav="{grp}"]')
    if grp == 'practice':
        sel = f'#subnav [data-sub="{tab}"]'
        if await pg.get_attribute(sel, 'aria-selected') != 'true': await pg.click(sel)
    await pg.wait_for_timeout(2000)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 390, 'height': 844})
        await disable_cloud(pg); await pg.goto(BASE); await pg.wait_for_timeout(2000)
        await pg.click('[data-lang="en"]')
        await pg.fill('#nsName', 'S'); await submit_student(pg); await pg.wait_for_timeout(2000)
        for tab in ['plan', 'progress', 'chart', 'drill', 'write', 'read', 'phrases', 'profile']:
            await go(pg, tab); await pg.wait_for_timeout(2000)
            r = await pg.evaluate("""() => { const W = document.documentElement.clientWidth; const out = [];
              document.querySelectorAll('body *').forEach(e => { const r = e.getBoundingClientRect(); if (r.width && r.right > W + 1 && !e.closest('.strip')) out.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ' ' + Math.round(r.right)); });
              return [document.documentElement.scrollWidth, out.slice(0, 6)]; }""")
            print(tab, r)
            assert r[0] <= 390, (tab, r)
        await b.close()
asyncio.run(main())
