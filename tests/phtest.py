import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        R = {}; errs = []; bad = []
        for lang in ['en', 'ar']:
            pg = await b.new_page(viewport={'width': 390, 'height': 844}); pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.on('response', lambda r: bad.append(r.url) if '/audio/' in r.url and r.status != 200 else None)
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.click(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'P'); await pg.click('#newStudent button[type=submit]'); await pg.wait_for_timeout(250)
            await pg.click('nav [data-nav="practice"]'); await pg.wait_for_timeout(100)
            R[lang + '_subnav'] = await pg.eval_on_selector_all('#subnav [data-sub]', 'e=>e.map(x=>x.textContent)')
            await pg.click('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(150)
            R[lang + '_ph'] = [await pg.locator('#tab-phrases .word').count(), await pg.eval_on_selector_all('#tab-phrases h3', 'e=>e.map(x=>x.textContent)')]
            R[lang + '_ph_back_hidden'] = await pg.is_hidden('#backBar')
            await pg.screenshot(path=f'shots/phrases_{lang}.png')
            n = await pg.locator('#tab-phrases [data-say]').count(); ok = 0
            for i in range(n):
                async with pg.expect_response(lambda r: '/audio/' in r.url) as ri: await pg.locator('#tab-phrases [data-say]').nth(i).click()
                ok += (await ri.value).status == 200
            R[lang + '_ph_audio_ok'] = f'{ok}/{n}'
            await pg.click('#subnav [data-sub="read"]'); await pg.wait_for_timeout(150)
            R[lang + '_words_daily'] = [await pg.locator('#tab-read .dcard').count(), await pg.text_content('#tab-read h3'), await pg.locator('#tab-read details.fold').count()]
            await pg.screenshot(path=f'shots/wordsdaily_{lang}.png')
            # every daily clip exists
            keys = await pg.evaluate("Array.from(document.querySelectorAll('#tab-read [data-dw]')).map(x=>x.dataset.dw)")
            await pg.locator('#tab-read [data-dw]').first.click(); await pg.wait_for_timeout(300)
        # all 84 daily clips + phrases served
        missing = await pg.evaluate("""async () => { const a = (await import('./js/data/audio-manifest.js')).AUD, d = (await import('./js/data/daily-data.js')).DD; const keys = Object.values(d.daily).flat().map(w => w[0] + '|dw').concat(d.phrases.flatMap(g => g.items.map(p => p[0]))); const miss = []; for (const k of keys) { if (!a[k]) { miss.push('nokey ' + k); continue; } const r = await fetch('audio/' + a[k], {method: 'HEAD'}); if (!r.ok) miss.push(k); } return [keys.length, miss]; }""")
        R['all_clips'] = missing; R['bad_audio'] = bad; R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1))
asyncio.run(main())
