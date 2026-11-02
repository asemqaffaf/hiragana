from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, sys
sys.argv=['x']; exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sweep.py')).read().split('async def main')[0])
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page()
        await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        await pg.tap('[data-lang="en"]'); await pg.fill('#nsName','Asem Qaffaf'); await submit_student(pg); await pg.wait_for_timeout(600)
        await pg.evaluate(SEED); await pg.reload(); await pg.wait_for_timeout(900)
        seen = {}
        for where in ['plan','chart','drill','write','read','phrases','progress','profile','meet','daily']:
            await go(pg, where)
            r = await pg.evaluate("""() => { const out = []; const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]') && !(e.closest('details:not([open])') && e.tagName !== 'SUMMARY'); };
              document.querySelectorAll('.tab:not([hidden]) :is(button,a[href],input,select,summary,[role=button],[role=tab]), #subnav button, #backBar button, header button, header h1').forEach(e => { if (!vis(e) || e.closest('#sheetRoot')) return; const r = e.getBoundingClientRect(); if (r.height >= 44 && r.width >= 44) return;
                 let box = r; const lab = e.closest('label'); if (lab) box = lab.getBoundingClientRect();
                 if (box.height >= 44 && box.width >= 44) return;
                 out.push({tag: e.tagName, cls: String(e.className).slice(0, 30), id: e.id, text: (e.innerText || e.getAttribute('aria-label') || e.value || '').trim().slice(0, 30), w: Math.round(box.width), h: Math.round(box.height), inLabel: !!lab, inline: getComputedStyle(e).display.startsWith('inline') && !!e.closest('p,li')}); }); return out; }""")
            seen[where] = r
        for k, v in seen.items():
            print('##', k); 
            
            from collections import Counter
            c = Counter((x['tag'], x['cls'], x['id'], x['w'], x['h'], x['inLabel'], x['inline']) for x in v)
            for k2, n in c.items(): print('  ', n, 'x', k2, '|', next(x['text'] for x in v if (x['tag'], x['cls'], x['id'], x['w'], x['h'], x['inLabel'], x['inline']) == k2))
        await b.close()
asyncio.run(main())
