from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
"""Learning goals: the goal box has an "Everything" option, every option names the phrase sections it opens, and the Phrases page follows the goal."""
import os, asyncio, json
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        R = {}; errs = []
        for lang in ('en', 'ar'):
            ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
            await pg.tap(f'[data-lang="{lang}"]')
            R[lang + '_new_options'] = await pg.eval_on_selector_all('#nsReason option', 'e=>e.map(x=>x.value)')
            R[lang + '_new_hint'] = await pg.text_content('#nsReasonHint')
            await pg.select_option('#nsReason', 'all'); R[lang + '_new_hint_all'] = await pg.text_content('#nsReasonHint')
            await pg.select_option('#nsReason', 'travel'); R[lang + '_new_hint_travel'] = await pg.text_content('#nsReasonHint')
            await pg.fill('#nsName', 'T'); await submit_student(pg); await pg.wait_for_timeout(400)
            await pg.evaluate("location.hash='#test'"); 
            await pg.evaluate("window.__hira && 0")
            # phrases page follows the goal
            await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(200); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(300)
            R[lang + '_travel_sections'] = await pg.locator('#tab-phrases h3').count()
            R[lang + '_travel_bar'] = await pg.text_content('#tab-phrases .phfilter .phft')
            await pg.tap('#phScope'); await pg.wait_for_timeout(250)
            R[lang + '_travel_all_sections'] = [await pg.locator('#tab-phrases h3').count(), await pg.locator('#tab-phrases h3 .tag').count()]
            await pg.tap('#phScope'); await pg.wait_for_timeout(250)
            R[lang + '_back_to_goal'] = await pg.locator('#tab-phrases h3').count()
            # profile: change to Everything
            await pg.tap('#whoBtn'); await pg.wait_for_timeout(300)
            R[lang + '_pf_options'] = await pg.eval_on_selector_all('#pfReason option', 'e=>e.map(x=>x.value)')
            R[lang + '_pf_hint'] = await pg.text_content('#pfReasonHint')
            await pg.select_option('#pfReason', 'all'); R[lang + '_pf_hint_all'] = await pg.text_content('#pfReasonHint')
            await pg.tap('#editStudent button[type=submit], form.pform button[type=submit]'); await pg.wait_for_timeout(300)
            await pg.reload(); await unlock_student(pg); await pg.wait_for_timeout(500)
            await pg.tap('nav [data-nav="practice"]'); await pg.wait_for_timeout(200); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(300)
            R[lang + '_all_sections'] = [await pg.locator('#tab-phrases h3').count(), await pg.locator('#phScope').count()]
            await pg.tap('nav [data-nav="progress"]'); await pg.wait_for_timeout(300)
            R[lang + '_progress_later_items'] = await pg.locator('#tab-progress .road li.later').count()
            await ctx.close()
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1))
        await b.close()
asyncio.run(main())
