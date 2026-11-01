import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, re
from playwright.async_api import async_playwright
async def main():
    import glob
    src = ''.join(open(f).read() for f in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'js', '**', '*.js'), recursive=True))
    used = set(re.findall(r"\bt\(\s*'([a-zA-Z0-9_.]+)'", src))
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await (await b.new_context()).new_page()
        await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
        keys = await pg.evaluate("({en:Object.keys(window.__hira.STR.en), ar:Object.keys(window.__hira.STR.ar), arFn:Object.entries(window.__hira.STR.ar).filter(([k,v])=>typeof v==='function').map(x=>x[0])})")
        en, ar = set(keys['en']), set(keys['ar'])
        print('EN keys', len(en), 'AR keys', len(ar))
        print('in EN but not AR (falls back to English):', sorted(en - ar))
        print('in AR but not EN:', sorted(ar - en))
        print('t() literal keys used but defined nowhere:', sorted(k for k in used if k not in en and k not in ar))
        print('used but missing in AR:', sorted(k for k in used if k in en and k not in ar))
        # strings still containing English letters in AR (ignoring placeholders / known Latin)
        arvals = await pg.evaluate("Object.entries(window.__hira.STR.ar).filter(([k,v])=>typeof v==='string').map(([k,v])=>[k,v])")
        latin = [(k, v) for k, v in arvals if re.search(r'[A-Za-z]{4,}', re.sub(r'\{\w+\}', '', v)) and k not in ('credits',)]
        print('AR strings with 4+ Latin letters (check):', [(k, v[:60]) for k, v in latin][:25])
        await b.close()
asyncio.run(main())
