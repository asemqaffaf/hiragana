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
        for lang, dev in [('en', 'iPhone 13'), ('ar', 'iPhone SE')]:
            ctx = await b.new_context(**p.devices[dev]); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
            await pg.tap(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'M'); await submit_student(pg); await pg.wait_for_timeout(300)
            R[lang + '_today_back_hidden'] = await pg.is_hidden('#backBar')
            # back bar on every other page
            vis = {}
            for nav, tab in [('letters', 'chart'), ('practice', 'drill'), ('progress', 'progress')]:
                await pg.tap(f'nav [data-nav="{nav}"]'); await pg.wait_for_timeout(120)
                vis[tab] = [await pg.is_visible('#backBar'), await pg.text_content('#backLabel')]
            await pg.tap('#whoBtn'); await pg.wait_for_timeout(120); vis['profile'] = [await pg.is_visible('#backBar'), await pg.text_content('#backLabel')]
            R[lang + '_back_everywhere'] = vis
            # tapping back from profile goes to the previous page; from Letters goes to Today
            await pg.tap('#backBtn'); await pg.wait_for_timeout(150); R[lang + '_back_from_profile'] = await pg.evaluate('location.hash')
            await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(100); R[lang + '_letters_back_hidden'] = await pg.is_hidden('#backBar')
            await pg.tap('#whoBtn'); await pg.wait_for_timeout(100); await pg.tap('#backBtn'); await pg.wait_for_timeout(150)
            R[lang + '_back_from_letters'] = await pg.evaluate('location.hash')
            # sticky: scroll far down the Profile page, the bar stays at the top
            await pg.tap('#whoBtn'); await pg.wait_for_timeout(100)
            await pg.evaluate('window.scrollTo(0, 900)'); await pg.wait_for_timeout(150)
            R[lang + '_sticky_top'] = await pg.evaluate("Math.round(document.querySelector('#backBar').getBoundingClientRect().top)")
            await pg.evaluate('window.scrollTo(0, 0)')
            # letter sheet shows 2 more words with hear buttons
            await pg.tap('#tab-chart [data-open="さ"]'); await pg.wait_for_timeout(250)
            R[lang + '_sheet_more'] = [await pg.locator('.sheet .morex .mx').count(), await pg.text_content('.sheet .morex > span')]
            await pg.screenshot(path=f'shots/more_{lang}_sheet.png')
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(120)
            # meet page
            await pg.tap('nav [data-nav="home"]'); await pg.wait_for_timeout(120); await pg.tap('#goNext'); await pg.wait_for_timeout(500)
            R[lang + '_meet_more'] = await pg.locator('#tab-meet .morex .mx').count()
            await pg.screenshot(path=f'shots/more_{lang}_meet.png')
            # more sentences and phrases
            await pg.tap('nav [data-nav="practice"]'); await pg.tap('#subnav [data-sub="read"]'); await pg.wait_for_timeout(200)
            R[lang + '_sentences'] = await pg.locator('#tab-read .sentences .word').count()
            R[lang + '_daily_today_cards'] = await pg.locator('#tab-read .dlist').first.locator('.dcard').count()
            await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(200)
            R[lang + '_phrases'] = [await pg.locator('#tab-phrases .word').count(), await pg.locator('#tab-phrases h3').count()]
            # no horizontal overflow on iPhone widths
            R[lang + '_overflow'] = await pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            await ctx.close()
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1))
asyncio.run(main())
