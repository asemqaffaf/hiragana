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

async def write_clean(pg, k='あ'):
    t = await pg.evaluate(f"window.__hira.strokeTemplates('{k}').pts"); bb = await pg.locator('#wpad').bounding_box()
    for s in t:
        await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
        for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
        await pg.mouse.up()
    await pg.wait_for_timeout(100)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        R = {}; errs = []
        for lang in ['en', 'ar']:
            pg = await b.new_page(viewport={'width': 390, 'height': 844}); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.emulate_media(reduced_motion='reduce')
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.click(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'S'); await pg.click('#newStudent button[type=submit]'); await pg.wait_for_timeout(200)
            # a drill round so the rounds chart has data
            await go(pg, "drill"); await pg.click('[data-len="10"]'); await pg.click('#startDrill')
            rom = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko'}
            for i in range(40):
                if await pg.locator('#rAgain').count(): break
                if await pg.locator('#qNext').count(): await pg.click('#qNext'); continue
                await pg.type('#qin', rom[await pg.text_content('#qk')] if i % 3 else 'x')
                if i % 3 == 0: await pg.press('#qin', 'Enter')
                await pg.wait_for_timeout(480)
            await go(pg, "write"); await pg.wait_for_timeout(200)
            R[lang + '_checklist0'] = await pg.text_content('#wComplete')
            for n in range(3):
                if n: await pg.click('#wAgain')
                await write_clean(pg)
            R[lang + '_after3'] = [await pg.text_content('#wStat'), await pg.is_visible('#wCompleteBtn')]
            await pg.click('#wSay'); await pg.wait_for_timeout(300)
            R[lang + '_afterHear'] = [await pg.text_content('#wComplete'), await pg.is_visible('#wCompleteBtn'), await pg.text_content('#wCompleteBtn')]
            await pg.screenshot(path=f'shots/cl_ready_{lang}.png')
            await pg.click('#wCompleteBtn'); await pg.wait_for_timeout(150)
            R[lang + '_completed'] = [await pg.text_content('#wStat'), await pg.text_content('#wComplete'), await pg.get_attribute('.strip [data-wk="あ"]', 'class')]
            await pg.click('#wUncomplete'); R[lang + '_undo'] = [await pg.text_content('#wComplete'), await pg.get_attribute('.strip [data-wk="あ"]', 'class')]
            await pg.click('#wCompleteBtn'); await pg.wait_for_timeout(100)
            await pg.reload(); await pg.wait_for_timeout(400)
            await go(pg, "chart"); R[lang + '_chart_badge'] = await pg.get_attribute('#tab-chart [data-open="あ"]', 'class')
            await go(pg, "progress"); await pg.wait_for_timeout(200)
            R[lang + '_tiles'] = await pg.eval_on_selector_all('.pstat div', 'e=>e.map(x=>x.innerText.replace(/\\n/g," "))')
            R[lang + '_road'] = await pg.eval_on_selector_all('.road li', 'e=>e.map(x=>x.className + ": " + x.querySelector("b").textContent)')
            R[lang + '_rounds'] = await pg.locator('.rounds i').count()
            R[lang + '_back'] = await pg.text_content('#backLabel')
            await pg.screenshot(path=f'shots/pg_{lang}.png', full_page=True)
            await pg.close()
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
