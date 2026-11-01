import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
# Write -> Words must list only words, daily words and sentences that use the letter being written.
INFO = """(k) => {
  const r = document.querySelector('#tab-read');
  const kana = [...r.querySelectorAll('.word > .kana, .dcard .dk')].map(e => e.textContent);
  const sent = [...r.querySelectorAll('.sentences .word > .kana')].map(e => e.textContent);
  const vis = e => e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0;
  const w = r.querySelector('.word');
  return {banner: (r.querySelector('.phfilter') || {}).innerText || null, n: kana.length, allContain: kana.every(x => x.includes(k)), allSentencesContain: sent.every(x => x.includes(k)),
    roVisible: w ? vis(w.querySelector('.ro')) : null, meanVisible: w ? vis(w.querySelector('.mean')) : null, checkboxes: !!r.querySelector('#rRo'), overflow: document.documentElement.scrollWidth > innerWidth};
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, dev in [('en', 'iPhone 13'), ('ar', 'iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev], color_scheme='dark'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'M'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(1000)
            async def open_write(letter):
                await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(150)
                await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''")
                await pg.locator(f'#tab-chart [data-open="{letter}"]').first.tap(); await pg.wait_for_timeout(400)
                await pg.tap('#shWrite'); await pg.wait_for_timeout(500)
            for letter in ['あ', 'ぬ', 'ん']:
                await open_write(letter)
                await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(500)
                R[f'{lang}_{letter}'] = await pg.evaluate(INFO, letter)
                # tapping a box plays it and must not hide romaji or meaning
                await pg.locator('#tab-read .word').first.tap(); await pg.wait_for_timeout(300)
                R[f'{lang}_{letter}_after_tap'] = await pg.evaluate("(()=>{const w=document.querySelector('#tab-read .word');const v=e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0;return [v(w.querySelector('.ro')),v(w.querySelector('.mean'))]})()")
            await pg.evaluate("window.__hira.wordsFor('ぢ')"); await pg.wait_for_timeout(400)
            R[lang + '_ぢ'] = await pg.evaluate("[document.querySelector('#tab-read .phfilter').innerText, document.querySelectorAll('#tab-read .word, #tab-read .dcard').length]")
            await pg.evaluate("window.__hira.wordsFor('ぬ')"); await pg.wait_for_timeout(300)
            await pg.tap('#rdAll'); await pg.wait_for_timeout(300)
            R[lang + '_after_show_all'] = await pg.evaluate("[document.querySelectorAll('#tab-read .word').length > 50, !!document.querySelector('#rRo'), (document.querySelector('#tab-read .phfilter')||{}).innerText]")
            await pg.tap('#rdOnly'); await pg.wait_for_timeout(300)
            R[lang + '_after_only'] = await pg.evaluate("[!!document.querySelector('#rdAll'), !!document.querySelector('#rdOnly')]")
            # the letter follows Words -> Phrases, and Phrases -> Words
            await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(400)
            R[lang + '_words_to_phrases'] = await pg.evaluate("[!!document.querySelector('#tab-phrases #phAll'), (document.querySelector('#tab-phrases .phfilter .kana')||{}).textContent]")
            await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(400)
            R[lang + '_phrases_to_words'] = await pg.evaluate("[!!document.querySelector('#tab-read #rdAll'), (document.querySelector('#tab-read .phfilter .kana')||{}).textContent]")
            # from Quiz: unfiltered
            await pg.tap('#subnav [data-sub="drill"]'); await pg.wait_for_timeout(300); await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(400)
            R[lang + '_from_quiz'] = await pg.evaluate("[document.querySelectorAll('#tab-read .word').length > 50, !!document.querySelector('#tab-read .phfilter')]")
            # via the bottom bar: unfiltered
            await open_write('あ'); await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(400)
            await pg.tap('nav [data-nav="home"]'); await pg.wait_for_timeout(150); await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(400)
            R[lang + '_nav_back_to_practice'] = await pg.evaluate("[document.querySelector('.tab:not([hidden])').id, !!document.querySelector('#tab-read .phfilter:not(.all)')]")
            if lang == 'en':
                await open_write('あ'); await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(600); await pg.screenshot(path='/tmp/hira-tests/wordsfilter_en.png')
            await ctx.close()
        R['errors'] = errs; print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
