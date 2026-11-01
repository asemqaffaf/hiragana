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
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(1000)
            await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(150); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(1500)
            vis = "(e=>[getComputedStyle(e.querySelector('.ro')).visibility,getComputedStyle(e.querySelector('.mean')).visibility,e.classList.contains('open')])"
            box = pg.locator('#tab-phrases .word').first
            before = await box.evaluate(vis)
            for i in range(3):
                await box.tap(position={'x': 10, 'y': 10})
                await pg.wait_for_timeout(250)
            R[lang+'_phrase_before'] = before; R[lang+'_phrase_after_3_taps'] = await box.evaluate(vis)
            R[lang+'_all_phrases_shown'] = await pg.evaluate("[...document.querySelectorAll('#tab-phrases .word')].every(e=>getComputedStyle(e.querySelector('.ro')).visibility==='visible'&&getComputedStyle(e.querySelector('.mean')).visibility==='visible')")
            # read tab sentences too
            await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(1200)
            sw = pg.locator('#tab-read .sentences .word'); n = await sw.count()
            if n:
                await sw.first.tap(position={'x': 10, 'y': 10}); await pg.wait_for_timeout(250)
                R[lang+'_read_sentence_after_tap'] = await sw.first.evaluate(vis)
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
