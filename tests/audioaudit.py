import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}
        for lang in ['en','ar']:
            ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','A'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(600)
            aud = await pg.evaluate("import('./js/data/audio-manifest.js').then(m => m.AUD)")
            spoken = set(); 
            collect = """() => { const s = new Set(); document.querySelectorAll('[data-say]').forEach(e => s.add(e.dataset.say)); document.querySelectorAll('[data-dw]').forEach(e => s.add(e.dataset.dw + '|dw')); return [...s]; }"""
            for nav, subs in [('letters',[None]),('practice',['drill','write','read','phrases']),('progress',[None]),('home',[None])]:
                await pg.tap(f'nav [data-nav="{nav}"]'); await pg.wait_for_timeout(200)
                for sub in subs:
                    if sub: await pg.tap(f'#subnav [data-sub="{sub}"]'); await pg.wait_for_timeout(300)
                    spoken.update(await pg.evaluate(collect))
            # every letter sheet
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(300)
            letters = await pg.evaluate("[...document.querySelectorAll('#tab-chart [data-open]')].map(e=>e.dataset.open)")
            for k in letters:
                await pg.evaluate(f"document.querySelector('#tab-chart [data-open=\"{k}\"]').click()"); await pg.wait_for_timeout(40)
                spoken.update(await pg.evaluate(collect)); spoken.add(k)
                await pg.evaluate("document.getElementById('sheetRoot').innerHTML=''")
            # the meet / daily / lesson pages
            spoken_missing = sorted(s for s in spoken if s not in aud)
            R[lang] = {'letters_on_chart': len(letters), 'distinct_spoken_texts': len(spoken), 'without_clip': spoken_missing[:40], 'n_without_clip': len(spoken_missing), 'errors': errs}
            await ctx.close()
        # files
        ctx = await b.new_context(); pg = await ctx.new_page(); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        files = await pg.evaluate("""async () => { const a = (await import('./js/data/audio-manifest.js')).AUD; const vals = [...new Set(Object.values(a))]; const bad = []; let tiny = 0; for (const f of vals) { const r = await fetch('audio/' + f, {cache:'no-store'}); if (!r.ok) { bad.push(f + ' ' + r.status); continue; } const n = (await r.arrayBuffer()).byteLength; if (n < 3000) tiny++; } return {keys: Object.keys(a).length, files: vals.length, bad, tiny}; }""")
        R['files'] = files
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
