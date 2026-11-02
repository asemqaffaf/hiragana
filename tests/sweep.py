from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, sys, datetime
from playwright.async_api import async_playwright
DEVS = {'SE-320': dict(viewport={'width':320,'height':568}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
        '13-390': 'iPhone 13', 'ProMax-430': dict(viewport={'width':430,'height':932}, device_scale_factor=3, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148'),
        'SE-land-568': dict(viewport={'width':568,'height':320}, device_scale_factor=2, is_mobile=True, has_touch=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')}
CHECK = r"""() => {
  const vw = innerWidth, out = {over: document.documentElement.scrollWidth - vw, wide: [], small: [], clipped: [], keyleak: [], hidden_by_nav: null, imgs: []};
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('[hidden]'); };
  const tab = document.querySelector('.tab:not([hidden])') || document.body;
  tab.querySelectorAll('*').forEach(e => { if (!vis(e)) return; const r = e.getBoundingClientRect(); if (r.right > vw + 1 || r.left < -1) { if (!e.closest('.cmap,.seg,.chips,.row-scroll,.hscroll,svg') ) out.wide.push((e.className && e.className.baseVal === undefined ? e.className : e.tagName) + ':' + Math.round(r.left) + '-' + Math.round(r.right)); } });
  const inter = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link]';
  document.querySelectorAll(inter).forEach(e => { if (!vis(e) || e.closest('#sheetRoot')) return; const r = e.getBoundingClientRect(); if (r.bottom < 0) return; if (r.height < 40 || r.width < 40) { const key = e.tagName + '.' + (e.className || e.id || e.type || ''); out.small.push(key + ' ' + Math.round(r.width) + 'x' + Math.round(r.height)); } });
  tab.querySelectorAll('*').forEach(e => { if (!vis(e)) return; const cs = getComputedStyle(e); if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2 && e.clientWidth > 0 && !['svg','I'].includes(e.tagName)) out.clipped.push(e.tagName + '.' + e.className + ' ' + e.scrollWidth + '>' + e.clientWidth + ' "' + (e.innerText || '').slice(0, 24) + '"'); });
  const rx = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/;
  document.querySelectorAll('body *').forEach(e => { if (e.children.length === 0 && vis(e)) { const s = (e.textContent || '').trim(); if (rx.test(s) && !/\.(com|jp|io|html)$/.test(s)) out.keyleak.push(s); } });
  const nav = document.querySelector('nav.tabs'); const last = [...tab.querySelectorAll('*')].filter(vis).pop();
  if (nav && last) { const full = document.documentElement.scrollHeight; out.bottom_pad = Math.round(full - (last.getBoundingClientRect().bottom + scrollY)); out.nav_h = Math.round(nav.getBoundingClientRect().height); }
  return out;
}"""
SEED = r"""(k) => { const ids = JSON.parse(localStorage.getItem('hiragana14-students-v1')); const id = ids.current; const pk = 'hiragana14-progress-' + id;
  const day = n => { const d = new Date(Date.now() + 9*3600*1000 - n*86400000); return d.toISOString().slice(0,10); };
  const A = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん'.split('');
  const stats = {}, ws = {}, cl = {}, act = {}, done = {}, rounds = [], heard = {}, time = {};
  A.forEach((c,i) => { stats[c] = {b: i % 6, c: 3 + i, w: i % 4, t: 1800 + i*40}; if (i % 3 === 0) ws[c] = {n: 3, p: 2}; if (i % 4 === 0) cl[c] = day(i % 7); heard[c] = 2; });
  for (let i = 0; i < 22; i++) act[day(i)] = 5 + (i*7) % 70;
  for (let d = 1; d <= 8; d++) done[d] = day(9 - d);
  for (let i = 0; i < 12; i++) rounds.push({d: day(11 - i), n: 10 + i, p: 60 + (i*3) % 40});
  const state = {v:1, start: day(8), done, stats, ws, act, rounds, heard, cl, time, mix: {'さ>き': 3, 'ぬ>め': 2}, badges: {first: day(8), streak3: day(5)}, les: {'9': {m: ['か','き'], w: [], q: -1, r: false, d: [], dd: false}}, updated: Date.now()};
  localStorage.setItem(pk, JSON.stringify(state)); }"""
async def go(pg, where):
    if where == 'plan': await pg.tap('nav [data-nav="home"]')
    elif where == 'chart': await pg.tap('nav [data-nav="letters"]')
    elif where == 'progress': await pg.tap('nav [data-nav="progress"]')
    elif where in ('drill','write','read','phrases'):
        await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(120)
        if await pg.evaluate("document.querySelector('.tab:not([hidden])').id") != 'tab-' + where: await pg.tap(f'#subnav [data-sub="{where}"]')
    elif where == 'profile': await pg.tap('#whoBtn')
    elif where == 'meet': await pg.tap('nav [data-nav="home"]'); await pg.wait_for_timeout(120); await pg.tap('[data-step="meet"]')
    elif where == 'daily': await pg.tap('nav [data-nav="home"]'); await pg.wait_for_timeout(120); await pg.tap('[data-step="words"]')
    await pg.wait_for_timeout(1300)
async def main():
    only = sys.argv[1:] 
    async with async_playwright() as p:
        b = await p.chromium.launch(); report = {}; problems = 0
        for dname, dev in DEVS.items():
            if only and dname not in only: continue
            kw = p.devices[dev] if isinstance(dev, str) else dev
            for lang in ['en','ar']:
                for scheme in ['light','dark']:
                    ctx = await b.new_context(**kw, color_scheme=scheme); pg = await ctx.new_page(); errs = []
                    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
                    pg.on('console', lambda m: errs.append('console:' + m.text[:90]) if m.type == 'error' and 'ERR_TUNNEL' not in m.text and 'Failed to load resource' not in m.text else None)
                    await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
                    if scheme == 'light' and lang == 'en' and dname == 'SE-320': pass
                    await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','Asem Qaffaf'); await submit_student(pg); await pg.wait_for_timeout(600)
                    await pg.evaluate(SEED); await pg.reload(); await unlock_student(pg); await pg.wait_for_timeout(900)
                    for where in ['plan','chart','drill','write','read','phrases','progress','profile','meet','daily']:
                        try: await go(pg, where)
                        except Exception as e: errs.append(f'nav-{where}: {str(e)[:80]}'); continue
                        r = await pg.evaluate(CHECK)
                        issues = []
                        if r['over'] > 0: issues.append(f"page overflows by {r['over']}px")
                        if r['wide']: issues.append('wide:' + ';'.join(sorted(set(r['wide']))[:4]))
                        if r['keyleak']: issues.append('KEY LEAK:' + ','.join(r['keyleak'][:4]))
                        if r['clipped']: issues.append('clipped:' + ';'.join(sorted(set(r['clipped']))[:3]))
                        small = sorted(set(r['small']))
                        if small: issues.append('small targets:' + ';'.join(small[:5]))
                        if r.get('bottom_pad') is not None and r['bottom_pad'] < r.get('nav_h', 0) - 2: issues.append(f"content may hide under nav: bottom pad {r['bottom_pad']} < nav {r.get('nav_h')}")
                        if issues:
                            report.setdefault(f'{dname}/{lang}/{scheme}', {})[where] = issues; problems += len(issues)
                        if where in ('plan','progress','phrases') and scheme == 'dark' and lang == 'en' and dname in ('13-390',): await pg.screenshot(path=f'shots/sweep_{dname}_{where}.png')
                    if errs: report.setdefault(f'{dname}/{lang}/{scheme}', {})['errors'] = errs[:6]; problems += len(errs)
                    await ctx.close()
        print(json.dumps(report, ensure_ascii=False, indent=1)); print('issue groups:', problems); await b.close()
asyncio.run(main())
