"""Press and hold to repeat (played as one long track, so it keeps going on a locked screen), and no pinch zoom."""
from student_auth import disable_cloud, submit_student
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
import asyncio, json
from playwright.async_api import async_playwright

async def hold(cdp, x, y, ms):
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    await asyncio.sleep(ms / 1000)
    await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})


async def centre(loc):
    box = await loc.bounding_box()
    return box['x'] + box['width'] / 2, box['y'] + box['height'] / 2


async def main():
    R = {}; errs = []
    async with async_playwright() as p:
        kw = {'executable_path': os.environ['CHROME_PATH'], 'args': ['--no-sandbox']} if os.environ.get('CHROME_PATH') else {}
        kw['args'] = kw.get('args', []) + ['--autoplay-policy=no-user-gesture-required']
        b = await p.chromium.launch(**kw)
        for lang in ('en', 'ar'):
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'Aya'); await submit_student(pg); await pg.wait_for_timeout(700)
            cdp = await ctx.new_cdp_session(pg)
            audio = lambda js: pg.evaluate('(() => { const a = [...document.querySelectorAll("audio")][0] || null; return ' + js + ' })()')
            pre = lang + '_'
            await pg.add_init_script("const _p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__aud = this; return _p.apply(this, arguments) }")
            await pg.reload(); await pg.wait_for_timeout(700)

            # ---- no zoom ----
            R[pre + 'viewport'] = await pg.evaluate("document.querySelector('meta[name=viewport]').content")
            R[pre + 'touch_action'] = await pg.evaluate("getComputedStyle(document.documentElement).touchAction")
            R[pre + 'gesturestart_prevented'] = await pg.evaluate("(() => { const e = new Event('gesturestart', {cancelable: true, bubbles: true}); document.body.dispatchEvent(e); return e.defaultPrevented })()")
            R[pre + 'two_finger_move_prevented'] = await pg.evaluate("""(() => {
              const t = (id) => new Touch({identifier: id, target: document.body, clientX: 100 + id * 50, clientY: 300});
              const e = new TouchEvent('touchmove', {cancelable: true, bubbles: true, touches: [t(1), t(2)], targetTouches: [t(1), t(2)], changedTouches: [t(1), t(2)]});
              document.body.dispatchEvent(e); return e.defaultPrevented })()""")
            R[pre + 'one_finger_move_allowed'] = await pg.evaluate("""(() => {
              const t = new Touch({identifier: 1, target: document.body, clientX: 100, clientY: 300});
              const e = new TouchEvent('touchmove', {cancelable: true, bubbles: true, touches: [t], targetTouches: [t], changedTouches: [t]});
              document.body.dispatchEvent(e); return !e.defaultPrevented })()""")

            # ---- a letter: tap still opens it; hold opens the menu and does not ----
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(500)
            tile = pg.locator('#tab-chart .kb').first
            await tile.tap(); await pg.wait_for_timeout(400)
            R[pre + 'tap_opens_sheet'] = await pg.locator('#sheetRoot .sheet').count() == 1
            await pg.keyboard.press('Escape'); await pg.evaluate("document.querySelector('#sheetRoot [data-close]')?.click()"); await pg.wait_for_timeout(500)
            R[pre + 'sheet_closed'] = await pg.locator('#sheetRoot .sheet').count() == 0
            x, y = await centre(tile)
            await hold(cdp, x, y, 800); await pg.wait_for_timeout(200)
            R[pre + 'hold_opens_menu'] = await pg.locator('.rep-pop').count() == 1
            R[pre + 'hold_did_not_open_sheet'] = await pg.locator('#sheetRoot .sheet').count() == 0
            R[pre + 'counts'] = await pg.locator('.rep-n b').all_text_contents()
            R[pre + 'menu_inside_screen'] = await pg.evaluate("(r => r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight)(document.querySelector('.rep-pop').getBoundingClientRect())")
            await pg.locator('.rep-n[data-n="4"]').tap()
            await pg.wait_for_selector('.rep-now'); R[pre + 'pill_shown'] = True
            await pg.wait_for_function("document.querySelector('.rep-now-c')?.textContent.length > 0", timeout=8000)
            await pg.wait_for_timeout(600)
            # one blob track, about four plays long, with lock-screen metadata and no timers needed
            R[pre + 'one_track'] = await pg.evaluate("(() => { const a = window.__aud; return a ? a.src.startsWith('blob:') : null })()")
            info = await pg.evaluate("(() => { const a = window.__aud; return a ? {d: a.duration, p: a.paused} : null })()")
            R[pre + 'track_info'] = info
            R[pre + 'track_long'] = bool(info and info['d'] > 3.0 and not info['p'])
            R[pre + 'media_session'] = await pg.evaluate("navigator.mediaSession.metadata ? navigator.mediaSession.metadata.title : null")
            seen = set()
            for _ in range(80):
                t = await pg.evaluate("document.querySelector('.rep-now-c')?.textContent || ''")
                if t: seen.add(t)
                if not await pg.locator('.rep-now').count(): break
                await pg.wait_for_timeout(250)
            R[pre + 'progress_seen'] = sorted(seen)
            R[pre + 'pill_gone_after'] = await pg.locator('.rep-now').count() == 0
            R[pre + 'menu_closed_after_pick'] = await pg.locator('.rep-pop').count() == 0
            R[pre + 'media_session_cleared'] = await pg.evaluate("navigator.mediaSession.metadata === null")

            # ---- the last number is remembered and marked ----
            await hold(cdp, x, y, 700); await pg.wait_for_timeout(200)
            R[pre + 'last_marked'] = await pg.locator('.rep-n.last').get_attribute('data-n')
            await pg.locator('.rep-scrim').tap(position={'x': 5, 'y': 5}); await pg.wait_for_timeout(300)
            R[pre + 'scrim_tap_closes'] = await pg.locator('.rep-pop').count() == 0

            # ---- Stop ends it at once ----
            await hold(cdp, x, y, 700); await pg.wait_for_timeout(200)
            await pg.locator('.rep-n[data-n="100"]').tap(); await pg.wait_for_selector('.rep-now')
            await pg.wait_for_function("window.__aud && !window.__aud.paused && window.__aud.currentTime > 0.5", timeout=8000)
            await pg.locator('.rep-stop').tap(); await pg.wait_for_timeout(300)
            R[pre + 'stop_halts'] = await pg.evaluate("window.__aud.paused")
            R[pre + 'pill_gone_after_stop'] = await pg.locator('.rep-now').count() == 0

            # ---- scrolling or drifting while pressing does not open it ----
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x, 'y': y - 40}]})
            await asyncio.sleep(0.7)
            await cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); await pg.wait_for_timeout(200)
            R[pre + 'drift_no_menu'] = await pg.locator('.rep-pop').count() == 0

            # ---- any other sound stops a repeat ----
            await hold(cdp, x, y, 700); await pg.wait_for_timeout(200)
            await pg.locator('.rep-n[data-n="100"]').tap(); await pg.wait_for_selector('.rep-now')
            await pg.wait_for_timeout(300)
            await pg.evaluate("document.querySelector('.rep-stop').click()")

            # ---- words: hold on a word card ----
            await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(200); await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(1000)
            card = pg.locator('#tab-read .word').first
            wx, wy = await centre(card)
            was_open = await card.evaluate("e => e.classList.contains('open')")
            await hold(cdp, wx, wy - 6, 800); await pg.wait_for_timeout(250)
            R[pre + 'word_menu'] = await pg.locator('.rep-pop').count() == 1
            R[pre + 'word_label'] = await pg.locator('.rep-k').text_content()
            R[pre + 'word_card_not_toggled'] = was_open == await card.evaluate("e => e.classList.contains('open')")
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(250)
            R[pre + 'escape_closes'] = await pg.locator('.rep-pop').count() == 0
            R[pre + 'held_class_removed'] = await pg.locator('.rep-held').count() == 0

            # ---- phrases ----
            await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(1000)
            ph = pg.locator('#tab-phrases .word').first
            px, py = await centre(ph)
            await hold(cdp, px, py - 6, 800); await pg.wait_for_timeout(250)
            R[pre + 'phrase_menu'] = await pg.locator('.rep-pop').count() == 1
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(200)
            await ctx.close()
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
    bad = [k for k, v in R.items() if v is False]
    assert not bad, bad
    for lang in ('en', 'ar'):
        assert R[lang + '_one_track'] is True, R[lang + '_one_track']
        assert len(R[lang + '_progress_seen']) >= 2, R[lang + '_progress_seen']
        assert 'user-scalable=no' in R[lang + '_viewport']
        assert R[lang + '_last_marked'] == '4'
        assert R[lang + '_counts'] == ['4', '8', '10', '20', '40', '100']
asyncio.run(main())
