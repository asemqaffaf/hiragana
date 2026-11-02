from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, datetime
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
        b = await p.chromium.launch(); pg = await b.new_page(viewport={'width': 390, 'height': 844}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.emulate_media(reduced_motion='reduce')
        await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        await pg.click('[data-lang="en"]')
        await pg.fill('#nsName', 'Tester'); await submit_student(pg); await pg.wait_for_timeout(200)
        R = {}
        await go(pg, "chart"); n = 0
        for view in ['basic', 'dak', 'yoon']:
            await pg.click(f'#tab-chart [data-view="{view}"]')
            for k in await pg.eval_on_selector_all('#tab-chart [data-open]', 'e=>e.map(x=>x.dataset.open)'):
                await pg.click(f'#tab-chart [data-open="{k}"]'); n += 1
                assert (await pg.text_content('#sheetRoot .hook')).strip(); await pg.keyboard.press('Escape')
        R['sheets'] = n
        await go(pg, "drill"); await pg.click('[data-len="10"]')
        for mode in ['read', 'choose', 'listen']:
            if mode != 'read': await pg.click('#rSetup'); await pg.click(f'[data-mode="{mode}"]')
            await pg.click('#startDrill')
            rom = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko'}
            for i in range(400):
                if await pg.locator('#rAgain').count(): break
                if await pg.locator('#qNext').count(): await pg.click('#qNext'); continue
                if mode == 'read': await pg.type('#qin', rom[await pg.text_content('#qk')]); await pg.wait_for_timeout(450)
                else: await pg.locator('[data-pick]').first.click(); await pg.wait_for_timeout(450)
            R['drill_' + mode] = await pg.text_content('.result')
        await go(pg, "read"); R['words'] = await pg.locator('#tab-read .words .word').count()
        await go(pg, "plan"); await pg.evaluate("document.querySelectorAll('#tab-plan details').forEach(d=>d.open=true)"); 
        await pg.fill('#startDate', (datetime.date.today() - datetime.timedelta(days=8)).isoformat()); await pg.dispatch_event('#startDate', 'change')
        await go(pg, "write"); await pg.wait_for_timeout(200)
        R['day9_write'] = await pg.eval_on_selector('.strip [aria-pressed="true"]', 'e=>e.dataset.wk')
        await go(pg, "plan"); await pg.evaluate("document.querySelectorAll('#tab-plan details').forEach(d=>d.open=true)"); R['footer'] = await pg.text_content('#sync')
        await pg.click('#resetBtn'); R['reset_armed'] = await pg.text_content('#resetBtn'); await pg.click('#resetBtn')
        R['after_reset_still_logged_in'] = await pg.text_content('#whoBtn .nm')
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
