import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev], color_scheme='dark'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(1000)
            info = "(()=>({banner:(document.querySelector('#tab-phrases .phfilter')||{}).innerText||null, cards:document.querySelectorAll('#tab-phrases .word').length, allHave:[...document.querySelectorAll('#tab-phrases .word .kana')].every(e=>e.textContent.includes(window.__k||'')), ow:document.documentElement.scrollWidth===innerWidth}))()"
            async def open_write(letter):
                await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(150)
                await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''")
                await pg.locator(f'#tab-chart [data-open="{letter}"]').first.tap(); await pg.wait_for_timeout(400)
                await pg.tap('#shWrite'); await pg.wait_for_timeout(500)
            for letter in ['あ','ぬ']:
                await open_write(letter)
                await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(500)
                await pg.evaluate(f"window.__k='{letter}'")
                r = await pg.evaluate(info); r['allContainLetter'] = r.pop('allHave'); R[f'{lang}_{letter}'] = r
            # a letter nothing uses
            await pg.evaluate("window.__hira.phrasesFor('ぢ')"); await pg.wait_for_timeout(400)
            R[lang+'_ぢ'] = await pg.evaluate("[document.querySelector('#tab-phrases .phfilter').innerText, document.querySelectorAll('#tab-phrases .word').length, document.querySelector('#tab-phrases').innerText.slice(-60)]")
            await pg.evaluate("window.__hira.phrasesFor('ぬ')"); await pg.wait_for_timeout(300)
            # show all
            await pg.tap('#phAll'); await pg.wait_for_timeout(300)
            R[lang+'_after_show_all'] = await pg.evaluate("[document.querySelectorAll('#tab-phrases .word').length, !!document.querySelector('#tab-phrases .phfilter:not(.goalbar)')]")
            # and back again: the banner offers the letter
            R[lang+'_banner_after_all'] = await pg.evaluate("[document.querySelector('#tab-phrases .phfilter').innerText.replace(/\\n/g,' | '), !!document.querySelector('#phOnly')]")
            await pg.tap('#phOnly'); await pg.wait_for_timeout(300)
            R[lang+'_after_only'] = await pg.evaluate("[document.querySelectorAll('#tab-phrases .word').length, !!document.querySelector('#phAll')]")
            await pg.tap('#phAll'); await pg.wait_for_timeout(300)
            # from Quiz tab -> Phrases: unfiltered
            await pg.tap('#subnav [data-sub="drill"]'); await pg.wait_for_timeout(300); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(400)
            R[lang+'_from_quiz'] = await pg.evaluate("[document.querySelectorAll('#tab-phrases .word').length, !!document.querySelector('#tab-phrases .phfilter:not(.goalbar)')]")
            # from Write via nav tab: unfiltered
            await open_write('あ'); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(400)
            await pg.tap('nav [data-nav="home"]'); await pg.wait_for_timeout(150); await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(400)
            R[lang+'_nav_back_to_practice'] = await pg.evaluate("[document.querySelector('.tab:not([hidden])').id, document.querySelectorAll('#tab-phrases .word').length, !!document.querySelector('#tab-phrases .phfilter:not(.goalbar)')]")
            if lang=='en': await pg.screenshot(path='shots/phfilter_en.png')
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
