from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
ROM = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko'}
async def write_clean(pg, k):
    t = await pg.evaluate(f"window.__hira.strokeTemplates('{k}').pts"); bb = await pg.locator('#wpad').bounding_box()
    for s in t:
        await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
        for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
        await pg.mouse.up()
    await pg.wait_for_timeout(80)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        R = {}; errs = []
        for lang in ['en', 'ar']:
            pg = await b.new_page(viewport={'width': 390, 'height': 844}); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.emulate_media(reduced_motion='reduce')
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.click(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'L'); await submit_student(pg); await pg.wait_for_timeout(250)
            R[lang + '_nav'] = await pg.eval_on_selector_all('nav.tabs .tl', 'e=>e.map(x=>x.textContent)')
            R[lang + '_steps'] = await pg.eval_on_selector_all('.steps li', 'e=>e.map(x=>x.className + ": " + x.querySelector("b").textContent)')
            R[lang + '_start'] = await pg.text_content('#goNext')
            await pg.screenshot(path=f'shots/today_{lang}.png')
            await pg.click('#goNext'); await pg.wait_for_timeout(300)
            R[lang + '_meet'] = [await pg.text_content('.meettop .small'), await pg.text_content('.meetrom')]
            await pg.screenshot(path=f'shots/meet_{lang}.png')
            for i in range(10): await pg.click('#meetNext'); await pg.wait_for_timeout(60)
            R[lang + '_after_meet'] = [await pg.evaluate('location.hash'), await pg.eval_on_selector('.strip [aria-pressed="true"]', 'e=>e.dataset.wk')]
            R[lang + '_write_first'] = [await pg.evaluate('location.hash'), await pg.eval_on_selector('.strip [aria-pressed="true"]', 'e=>e.dataset.wk'), await pg.eval_on_selector_all('#subnav [data-sub]', 'e=>e.map(x=>x.textContent + (x.getAttribute("aria-selected")==="true"?"*":""))')]
            for i, k in enumerate(['あ','い','う','え','お','か','き','く','け','こ']):
                cur = await pg.eval_on_selector('.strip [aria-pressed="true"]', 'e=>e.dataset.wk')
                for stage in range(4):
                    assert await pg.is_checked('#wGuide') == (stage == 0)
                    assert await pg.is_checked('#wNums') == (stage == 2)
                    assert await pg.is_disabled('#wNext')
                    await write_clean(pg, cur)
                    await pg.click('#wNext'); await pg.wait_for_timeout(150)
            R[lang + '_after_write'] = [await pg.evaluate('location.hash'), await pg.text_content('#goNext')]
            await pg.click('#goNext'); await pg.wait_for_timeout(250)
            R[lang + '_daily'] = [await pg.evaluate('location.hash'), await pg.locator('#tab-daily .dcard').count(), await pg.text_content('#dHeard')]
            await pg.screenshot(path=f'shots/daily_{lang}.png')
            for i in range(await pg.locator('#tab-daily [data-dw]').count()):
                async with pg.expect_response(lambda r: '/audio/d' in r.url) as ri: await pg.locator('#tab-daily [data-dw]').nth(i).click()
                _r = await ri.value; assert _r.status in (200, 206, 304), (_r.url, _r.status)
                await pg.wait_for_timeout(50)
            R[lang + '_daily_heard'] = [await pg.text_content('#dHeard'), await pg.locator('#tab-daily .dcard.heard').count()]
            await pg.click('#dDone'); await pg.wait_for_timeout(250)
            R[lang + '_after_daily'] = [await pg.evaluate('location.hash'), await pg.text_content('#goNext'), await pg.eval_on_selector_all('.steps li', 'e=>e.map(x=>x.className)')]
            await pg.click('#goNext'); await pg.wait_for_timeout(250)
            for i in range(40):
                if await pg.locator('#rToday').count(): break
                if await pg.locator('#qNext').count(): await pg.click('#qNext'); continue
                await pg.type('#qin', ROM[await pg.text_content('#qk')]); await pg.wait_for_timeout(480)
            R[lang + '_quiz'] = [await pg.text_content('.result'), await pg.text_content('#rToday')]
            await pg.click('#rToday'); await pg.wait_for_timeout(250)
            R[lang + '_done'] = [await pg.text_content('.lessondone'), await pg.evaluate("window.__hira.getState().done['1'] ? 'day 1 marked done' : 'not done'")]
            await pg.screenshot(path=f'shots/done_{lang}.png')
            # bottom bar groups and sub-tabs
            await pg.click('nav [data-nav="progress"]'); await pg.wait_for_timeout(150)
            R[lang + '_progress'] = [await pg.evaluate('location.hash'), await pg.is_hidden('#subnav'), await pg.is_hidden('#backBar'), await pg.eval_on_selector_all('nav.tabs .tl', 'e=>e.map(x=>x.textContent)')]
            await pg.click('nav [data-nav="letters"]'); await pg.wait_for_timeout(150)
            await pg.click('#whoBtn'); await pg.wait_for_timeout(150)
            R[lang + '_profile'] = [await pg.evaluate('location.hash'), await pg.get_attribute('#whoBtn', 'aria-current'), await pg.eval_on_selector_all('nav.tabs [aria-selected="true"]', 'e=>e.length'), await pg.text_content('#backLabel'), await pg.is_visible('#backBar')]
            await pg.screenshot(path=f'shots/profile_{lang}.png')
            await pg.go_back(); await pg.wait_for_timeout(150); R[lang + '_back'] = await pg.evaluate('location.hash')
            await pg.screenshot(path=f'shots/letters_{lang}.png')
            await pg.close()
        for lang in ['en', 'ar']:
            assert R[lang + '_done'][1] == 'day 1 marked done', R[lang + '_done']
            assert R[lang + '_after_meet'][0] == '#write'
            assert R[lang + '_after_write'][0] == '#plan'
            assert R[lang + '_daily'][1] == 12
            assert R[lang + '_quiz'][0] == '10 / 10'
        assert not errs, errs
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
