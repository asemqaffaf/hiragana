from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        R = {}; errs = []
        for lang, dev in [('en','iPhone 13'),('ar','iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev], reduced_motion='no-preference'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
            # signed out: tapping the title must do nothing
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','M'); await submit_student(pg); await pg.wait_for_timeout(1200)
            # mark a few letters done so progress has numbers
            await pg.evaluate("window.__hira && 0")
            await pg.tap('nav [data-nav="progress"]'); await pg.wait_for_timeout(120)
            R[lang+'_enter_class'] = await pg.evaluate("document.querySelector('#tab-progress').className")
            R[lang+'_anim_names'] = await pg.evaluate("[...document.querySelectorAll('#tab-progress > *')].slice(0,3).map(e=>getComputedStyle(e).animationName)")
            R[lang+'_bar_anim'] = await pg.evaluate("(()=>{const i=document.querySelector('#tab-progress .rbar i');return i?getComputedStyle(i).animationName:null})()")
            await pg.screenshot(path=f'shots/anim_progress_{lang}_mid.png'); await pg.wait_for_timeout(1900)
            R[lang+'_enter_cleared'] = await pg.evaluate("document.querySelector('#tab-progress').className")
            await pg.screenshot(path=f'shots/anim_progress_{lang}_end.png')
            # layout intact after animation: no overflow, bars at final width
            R[lang+'_bar_end'] = await pg.evaluate("(()=>{const i=document.querySelector('#tab-progress .rbar i');return i?getComputedStyle(i).transform:null})()")
            # title tap from another page goes to Today
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(200)
            await pg.tap('#homeBtn'); await pg.wait_for_timeout(300)
            R[lang+'_home_tap_hash'] = await pg.evaluate('location.hash'); R[lang+'_home_tab_visible'] = await pg.is_visible('#tab-plan')
            R[lang+'_home_back_hidden'] = await pg.is_hidden('#backBar')
            # sheet opens with animation, then a swap does not re-animate
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(1300)
            await pg.locator('#tab-chart [data-open]').first.tap(); await pg.wait_for_timeout(60)
            R[lang+'_sheet_anim'] = await pg.evaluate("getComputedStyle(document.querySelector('.sheet')).animationName")
            await pg.wait_for_timeout(500)
            await pg.screenshot(path=f'shots/anim_sheet_{lang}.png')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(150)
            # keyboard on title
            await pg.focus('#homeBtn'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(200)
            R[lang+'_home_kbd'] = await pg.evaluate('location.hash')
            # reduced motion: no animation classes
            await ctx.close()
            ctx = await b.new_context(**p.devices[dev], reduced_motion='reduce'); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName','R'); await submit_student(pg); await pg.wait_for_timeout(300)
            await pg.tap('nav [data-nav="progress"]'); await pg.wait_for_timeout(100)
            R[lang+'_reduced_enter'] = await pg.evaluate("document.querySelector('#tab-progress').className")
            R[lang+'_reduced_anim'] = await pg.evaluate("getComputedStyle(document.querySelector('.steps li.now .snum')||document.body).animationName")
            await ctx.close()
        # signed-out title tap
        ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page(); await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        R['signedout_home_pe'] = await pg.evaluate("getComputedStyle(document.querySelector('#homeBtn')).pointerEvents")
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
