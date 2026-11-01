import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for lang in ['en','ar']:
            for vw, vh, mob in [(320,568,True),(375,667,True),(390,664,True),(390,844,True),(430,800,True),(430,932,True),(568,320,True)]:
                ctx = await b.new_context(viewport={'width':vw,'height':vh}, is_mobile=mob, has_touch=True, device_scale_factor=2); pg = await ctx.new_page()
                await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
                await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','A'); await pg.tap('#newStudent button[type=submit]'); await pg.wait_for_timeout(500)
                await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(100); await pg.tap('#subnav [data-sub="write"]'); await pg.wait_for_timeout(1000)
                r = await pg.evaluate("""() => { window.scrollTo(0,0); const q = s => document.querySelector(s).getBoundingClientRect(); const sq = q('#wsq'), tools = q('.tools'), nav = q('nav.tabs'), stat = q('#wStat');
                  return {svh: innerHeight, square: Math.round(sq.height), sqTop: Math.round(sq.top), toolsBottom: Math.round(tools.bottom), navTop: Math.round(nav.top), navH: Math.round(nav.height), overhead: Math.round(tools.bottom - sq.height + 8 + nav.height)}; }""")
                print(lang, vw, vh, json.dumps(r)); await ctx.close()
        await b.close()
asyncio.run(main())
