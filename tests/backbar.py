from student_auth import disable_cloud, submit_student
"""The Back capsule keeps its shape after the label changes, and the old-page copy never outlives the slide."""
import asyncio
import json
import os

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(**p.devices['iPhone 13'])
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script('window.__hiraSnap=true')
        await disable_cloud(pg)
        await pg.goto(BASE + '#test')
        await pg.wait_for_timeout(400)
        await pg.tap('[data-lang="en"]')
        await pg.fill('#nsName', 'A')
        await submit_student(pg)
        await pg.wait_for_timeout(700)
        R = {}
        for tab in ('progress', 'letters', 'practice'):
            await pg.tap('nav [data-nav=%s]' % tab)
            await pg.wait_for_timeout(900)
            await pg.evaluate("document.querySelector('#whoBtn').click()")
            await pg.wait_for_timeout(2200)
            R[tab] = await pg.evaluate("""(() => {
              const b = document.querySelector('#backBtn').getBoundingClientRect(), l = document.querySelector('#backLabel').getBoundingClientRect(), s = document.querySelector('#backBtn svg').getBoundingClientRect();
              return {h: Math.round(b.height), labelTop: Math.round(l.top - b.top), sameRow: Math.abs((l.top + l.height / 2) - (s.top + s.height / 2)) < 6,
                      snaps: document.querySelectorAll('.pagesnap').length, sliding: document.querySelectorAll('.tab.slide').length}
            })()""")
            await pg.go_back()
            await pg.wait_for_timeout(900)
        bad = {k: v for k, v in R.items() if v['h'] > 48 or not v['sameRow'] or v['snaps'] or v['sliding']}
        print(json.dumps({'R': R, 'bad': bad, 'errors': errs}))
        await b.close()
        raise SystemExit(1 if bad or errs else 0)

asyncio.run(main())
