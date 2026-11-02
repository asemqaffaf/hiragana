from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev]); pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console:'+m.text) if m.type in ('error','warning') else None)
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','A'); await submit_student(pg); await pg.wait_for_timeout(600)
            aud = await pg.evaluate("import('./js/data/audio-manifest.js').then(m => m.AUD)")
            await pg.tap('nav [data-nav="progress"]'); await pg.wait_for_timeout(1500)
            letters = await pg.evaluate("[...document.querySelectorAll('#tab-progress .cmap [data-open]')].map(e=>e.dataset.open)")
            miss=[]; noex=[]; ovf=[]; strokes_missing=[]
            for k in letters:
                await pg.evaluate(f"document.querySelector('#tab-progress .cmap [data-open=\"{k}\"]').click()"); await pg.wait_for_timeout(30)
                info = await pg.evaluate("""() => { const r = document.getElementById('sheetRoot'); const s = r.querySelector('.sheet'); if (!s) return null;
                  const say = [...r.querySelectorAll('[data-say]')].map(e => e.dataset.say);
                  const sq = r.querySelector('.sq svg, .sq .k'); const w = s.getBoundingClientRect();
                  return {say, hasEx: !!r.querySelector('.ex'), over: s.scrollWidth > s.clientWidth + 1, hook: (r.querySelector('.hook')||{}).innerText||'', svg: !!r.querySelector('.sq svg') } }""")
                if not info: miss.append(k+':nosheet'); continue
                miss += [k+'>'+s for s in info['say'] if s not in aud]
                if not info['hasEx']: noex.append(k)
                if info['over']: ovf.append(k)
                if not k in ('っ',) and len(k) == 1 and not info['svg']: strokes_missing.append(k)
                if not info['hook']: miss.append(k+':nohook')
                await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''")
            R[lang] = {'letters': len(letters), 'sheet_problems': miss, 'no_example_word': noex, 'sheet_h_overflow': ovf, 'single_without_stroke_svg': strokes_missing, 'errors': errs[:5]}
            await ctx.close()
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
