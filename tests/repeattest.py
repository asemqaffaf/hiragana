"""Press and hold to repeat, and no pinch zoom. Sound is replaced by a counter, so the test is silent and fast."""
from student_auth import disable_cloud, submit_student
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
import asyncio, json
from playwright.async_api import async_playwright

COUNT_AUDIO = """
window.__plays = [];
HTMLMediaElement.prototype.play = function () {
  if (!String(this.src).startsWith('data:')) window.__plays.push(this.src);
  setTimeout(() => this.dispatchEvent(new Event('ended')), 30);
  return Promise.resolve();
};
HTMLMediaElement.prototype.pause = function () {};
"""


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
        b = await p.chromium.launch(**kw)
        for lang in ('en', 'ar'):
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.add_init_script(COUNT_AUDIO)
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'Aya'); await submit_student(pg); await pg.wait_for_timeout(700)
            cdp = await ctx.new_cdp_session(pg)
            plays = lambda: pg.evaluate('window.__plays.length')
            pre = lang + '_'

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
            before = await plays()
            await pg.locator('.rep-n[data-n="4"]').tap()
            await pg.wait_for_selector('.rep-now'); R[pre + 'pill_shown'] = True
            await pg.wait_for_function('window.__plays.length >= %d' % (before + 4), timeout=8000)
            await pg.wait_for_timeout(900)
            R[pre + 'played_4'] = await plays() - before
            R[pre + 'pill_gone_after'] = await pg.locator('.rep-now').count() == 0
            R[pre + 'menu_closed_after_pick'] = await pg.locator('.rep-pop').count() == 0

            # ---- the last number is remembered and marked ----
            await hold(cdp, x, y, 700); await pg.wait_for_timeout(200)
            R[pre + 'last_marked'] = await pg.locator('.rep-n.last').get_attribute('data-n')
            await pg.locator('.rep-scrim').tap(position={'x': 5, 'y': 5}); await pg.wait_for_timeout(300)
            R[pre + 'scrim_tap_closes'] = await pg.locator('.rep-pop').count() == 0

            # ---- Stop ends it at once ----
            await hold(cdp, x, y, 700); await pg.wait_for_timeout(200)
            before = await plays()
            await pg.locator('.rep-n[data-n="100"]').tap(); await pg.wait_for_selector('.rep-now')
            await pg.wait_for_function('window.__plays.length >= %d' % (before + 2), timeout=8000)
            await pg.locator('.rep-stop').tap(); await pg.wait_for_timeout(300)
            stopped_at = await plays(); await pg.wait_for_timeout(900)
            R[pre + 'stop_halts'] = (await plays()) == stopped_at and stopped_at - before < 10
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
            await pg.evaluate("document.querySelector('.rep-now') && 0")
            await pg.wait_for_timeout(200)

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
        assert R[lang + '_played_4'] == 4, R[lang + '_played_4']
        assert 'user-scalable=no' in R[lang + '_viewport']
        assert R[lang + '_last_marked'] == '4'
        assert R[lang + '_counts'] == ['4', '8', '10', '20', '40', '100']
asyncio.run(main())
