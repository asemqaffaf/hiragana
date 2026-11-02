"""Remembered sign-in survives real browser restarts and remains an explicit device choice."""
import asyncio
import json
import os
from pathlib import Path
import tempfile

from playwright.async_api import async_playwright
from student_auth import open_profile, PASSWORD, disable_cloud, prepare_import, submit_student

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
BROWSER = os.environ.get('BROWSER', 'chromium')
SHOTS = Path(tempfile.gettempdir()) / 'hira-tests'
KEY = 'hiragana14-remembered-login-v1'


async def main():
    errors = []
    SHOTS.mkdir(exist_ok=True)
    async with async_playwright() as playwright:
        engine = getattr(playwright, BROWSER)
        for lang in ['en', 'ar']:
            with tempfile.TemporaryDirectory(prefix='hiragana-session-') as profile:
                async def open_browser():
                    context = await engine.launch_persistent_context(profile, viewport={'width': 390, 'height': 844})
                    page = context.pages[0]
                    page.on('pageerror', lambda error: errors.append(str(error)))
                    await page.emulate_media(reduced_motion='reduce')
                    await disable_cloud(page)
                    await page.goto(BASE + '#test')
                    return context, page

                async def sign_in(page, remember):
                    await page.locator('.student').first.click()
                    await page.fill('#siPassword', PASSWORD)
                    await page.locator('#siRemember').set_checked(remember)
                    await page.click('#studentSignIn button[type=submit]')
                    await page.locator('body:not(.signed-out)').wait_for()

                context, page = await open_browser()
                await page.click(f'[data-lang="{lang}"]')
                assert not await page.is_checked('#nsRemember')
                await page.fill('#nsName', 'Learner')
                await submit_student(page)
                await page.locator('body:not(.signed-out)').wait_for()
                await page.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['あ'] = {b:1,c:3,w:0,t:600}))")
                await page.reload()
                await page.locator('.student').wait_for()
                assert await page.locator('#whoBtn').is_hidden(), 'default reload must ask for a password'
                await page.locator('.student').first.click()
                assert not await page.is_checked('#siRemember')
                await page.check('#siRemember')
                await page.fill('#siPassword', 'incorrect-password')
                await page.click('#studentSignIn button[type=submit]')
                await page.wait_for_function("document.querySelector('#siMsg').textContent.length > 0")
                assert await page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY) is None
                assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
                await page.screenshot(path=str(SHOTS / f'remember-login-{lang}.png'), full_page=True)
                await page.fill('#siPassword', PASSWORD)
                await page.click('#studentSignIn button[type=submit]')
                await page.locator('body:not(.signed-out)').wait_for()
                expiry = await page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).expiresAt', KEY)
                await page.reload()
                await page.locator('body:not(.signed-out)').wait_for()
                assert await page.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 3
                assert await page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).expiresAt', KEY) == expiry
                await context.close()

                # A fresh browser process reuses only the on-disk profile.
                context, page = await open_browser()
                await page.locator('body:not(.signed-out)').wait_for()
                assert await page.locator('html').get_attribute('lang') == lang
                assert await page.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 3
                assert await page.evaluate('(key) => JSON.parse(localStorage.getItem(key)).expiresAt', KEY) == expiry
                await open_profile(page)
                await page.click('#pSwitch')
                await page.reload()
                await page.locator('.student').wait_for()
                assert await page.locator('#whoBtn').is_hidden()
                assert await page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY) is None
                await sign_in(page, False)
                await page.reload()
                await page.locator('.student').wait_for()
                assert await page.locator('#whoBtn').is_hidden(), 'unchecked sign-in must not persist'

                await sign_in(page, True)
                await page.evaluate('''(key) => {
                  const login = JSON.parse(localStorage.getItem(key));
                  login.expiresAt = Date.now() - 1;
                  localStorage.setItem(key, JSON.stringify(login));
                }''', KEY)
                await page.reload()
                await page.locator('.student').wait_for()
                assert await page.locator('#whoBtn').is_hidden(), 'expired login must ask for a password'

                # Import and profile creation expose the same opt-in choice.
                await prepare_import(page)
                await page.check('#imRemember')
                exported = {'app': 'hiragana14', 'student': {'name': 'Imported', 'lang': lang}, 'progress': {'stats': {}}}
                await page.set_input_files('#importFile', {'name': 'student.json', 'mimeType': 'application/json', 'buffer': json.dumps(exported).encode()})
                await page.locator('body:not(.signed-out)').wait_for()
                await page.reload()
                await page.locator('body:not(.signed-out)').wait_for()
                assert 'Imported' in await page.locator('#whoBtn').text_content()
                await open_profile(page)
                await page.click('#pDelete')
                await page.click('#pDelete')
                assert await page.evaluate('(key) => JSON.parse(localStorage.getItem(key))', KEY) is None
                await page.click('#login [data-mode="new"]')
                await page.fill('#nsName', 'Remembered new learner')
                await page.check('#nsRemember')
                await submit_student(page)
                await page.locator('body:not(.signed-out)').wait_for()
                await page.reload()
                await page.locator('body:not(.signed-out)').wait_for()
                assert 'Remembered new learner' in await page.locator('#whoBtn').text_content()
                await context.close()

        assert not errors, errors
        print(json.dumps({'browser': BROWSER, 'languages': ['en', 'ar'], 'browser_restart': True,
                          'opt_in_expiry_sign_out_import_delete': True, 'errors': errors}))


if __name__ == '__main__':
    asyncio.run(main())
