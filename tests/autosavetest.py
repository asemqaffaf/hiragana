"""Profile saves as it is changed: no Save button, a brief "Saved." toast, errors under the name, the page stays where it was."""
from student_auth import disable_cloud, submit_student, open_profile
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
import asyncio, json
from playwright.async_api import async_playwright

STORE = "(() => { const l = JSON.parse(localStorage.getItem('hiragana14-students-v1')); return (l.students || l.list).find(p => p.id === l.current) })()"


async def main():
    R = {}; errs = []
    async with async_playwright() as p:
        kw = {'executable_path': os.environ['CHROME_PATH'], 'args': ['--no-sandbox']} if os.environ.get('CHROME_PATH') else {}
        b = await p.chromium.launch(**kw)
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        await pg.tap('[data-lang="en"]'); await pg.fill('#nsName', 'Aya'); await submit_student(pg); await pg.wait_for_timeout(600)
        await open_profile(pg); await pg.wait_for_timeout(300)
        R['no_save_button'] = await pg.locator('#pfForm button:visible').count() == 0
        # a select saves at once, shows "Saved.", and the page does not jump
        await pg.evaluate("document.querySelector('#pfMin').scrollIntoView({block: 'center'})")
        y0 = await pg.evaluate('scrollY')
        await pg.select_option('#pfMin', '10'); await pg.wait_for_timeout(300)
        R['select_saved'] = (await pg.evaluate(STORE))['goal']['min'] == 10
        R['toast_shown'] = await pg.locator('.pf-saved').count() == 1
        R['scroll_kept'] = abs(await pg.evaluate('scrollY') - y0) < 40
        await pg.wait_for_timeout(2200)
        R['toast_gone'] = await pg.locator('.pf-saved').count() == 0
        # the speed, the plan length and the language save too
        await pg.select_option('#pfRate', '0.75'); await pg.select_option('#pfPace', '14'); await pg.wait_for_timeout(300)
        st = await pg.evaluate(STORE)
        R['rate_pace_saved'] = [st['rate'], st['goal']['pace']] == [0.75, 14]
        # the name saves on Enter, and again on leaving the field
        await pg.fill('#pfName', 'Aya S.'); await pg.press('#pfName', 'Enter'); await pg.wait_for_timeout(300)
        R['name_enter'] = (await pg.evaluate(STORE))['name'] == 'Aya S.'
        await pg.fill('#pfName', 'Ayaa'); await pg.locator('#pfMin').focus(); await pg.wait_for_timeout(300)
        R['name_blur'] = (await pg.evaluate(STORE))['name'] == 'Ayaa'
        # an empty name keeps the old one, says why under the field, and other changes still save
        await pg.fill('#pfName', ''); await pg.select_option('#pfMin', '20'); await pg.wait_for_timeout(300)
        st = await pg.evaluate(STORE)
        R['empty_name_kept_old'] = st['name'] == 'Ayaa' and st['goal']['min'] == 20
        R['empty_name_message'] = bool(await pg.text_content('#pfMsg'))
        # Photo chosen but not yet uploaded: nothing is saved with an empty photo
        await pg.check('input[name="pfAv"][value="photo"]'); await pg.wait_for_timeout(300)
        R['photo_radio_waits'] = (await pg.evaluate(STORE))['av']['t'] != 'photo'
        avatar = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icon-192.png')
        await pg.set_input_files('#pfPhoto', avatar); await pg.wait_for_timeout(700)
        R['photo_saved'] = (await pg.evaluate(STORE))['av']['t'] == 'photo'
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
    bad = [k for k, v in R.items() if v is False]
    assert not bad, bad
asyncio.run(main())
