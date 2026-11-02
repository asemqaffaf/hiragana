"""Two devices use the real Apps Script handlers via an isolated local fixture, never live Drive."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import urllib.request
from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
ROOT = Path(__file__).resolve().parent.parent
PASSWORD = 'Cloud-study-password-2026'
RESET_PASSWORD = 'Reset-study-password-2026'


async def main():
    fixture = subprocess.Popen(['node', str(ROOT / 'tests/cloud-fixture-server.mjs')], stdout=subprocess.PIPE, text=True)
    port = int(fixture.stdout.readline())
    endpoint = f'http://127.0.0.1:{port}'
    requests = []
    errors = []

    def db():
        return json.load(urllib.request.urlopen(endpoint + '/db'))

    def reset_code(student_id):
        req = urllib.request.Request(endpoint + '/reset', data=json.dumps({'id': student_id}).encode(), headers={'Content-Type': 'application/json'})
        return json.load(urllib.request.urlopen(req))['code']

    async def route_cloud(route):
        data = route.request.post_data
        assert PASSWORD not in data and RESET_PASSWORD not in data
        requests.append(json.loads(data))
        response = urllib.request.urlopen(urllib.request.Request(endpoint + '/api', data=data.encode(), headers={'Content-Type': 'text/plain'}))
        await route.fulfill(body=response.read(), content_type='application/json', headers={'Access-Control-Allow-Origin': '*'})

    async def page_for(browser, lang='en'):
        context = await browser.new_context(viewport={'width': 390, 'height': 844})
        await context.route('**/js/core/cloud-config.js', lambda route: route.fulfill(
            body="export const SYNC_URL = 'https://script.google.com/macros/s/TEST/exec';", content_type='text/javascript'))
        await context.route('https://script.google.com/macros/s/**', route_cloud)
        page = await context.new_page()
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.emulate_media(reduced_motion='reduce')
        await page.goto(BASE + '#test')
        await page.click(f'[data-lang="{lang}"]')
        return context, page

    async def save(page):
        await page.click('#cloudSave')
        await page.wait_for_function("document.querySelector('#cloudSave') && !document.querySelector('#cloudSave').disabled")

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            c1, first = await page_for(browser)
            await first.click('#login [data-mode="new"]')
            await first.fill('#nsName', 'Cloud learner')
            await first.fill('#nsId', 'cloud-learner')
            await first.fill('#nsPassword', 'short')
            await first.fill('#nsConfirm', 'short')
            await first.click('#newStudent button[type=submit]')
            await first.wait_for_function("document.querySelector('#nsMsg').textContent.includes('10')")
            await first.fill('#nsPassword', PASSWORD)
            await first.fill('#nsConfirm', 'not-the-same-password')
            await first.click('#newStudent button[type=submit]')
            await first.wait_for_function("document.querySelector('#nsMsg').textContent.includes('match')")
            await first.fill('#nsConfirm', PASSWORD)
            await first.click('#newStudent button[type=submit]')
            await first.locator('#whoBtn').wait_for(state='visible')
            await first.click('#whoBtn')
            await save(first)
            assert await first.locator('[data-cloud-status]').last.inner_text() == 'Saved to cloud.'
            await first.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['あ'] = {b:2,c:4,w:1,t:600}))")
            await save(first)
            assert db()['cloud-learner']['progress']['stats']['あ']['c'] == 4
            assert PASSWORD not in await first.evaluate('JSON.stringify(localStorage)')

            # Reload prompts for the password; a wrong one cannot open the profile.
            await first.reload()
            assert await first.locator('#whoBtn').is_hidden()
            await first.locator('.student').click()
            await first.fill('#siPassword', 'incorrect-password')
            await first.click('#studentSignIn button[type=submit]')
            await first.wait_for_function("document.querySelector('#siMsg').textContent.length > 0")
            assert await first.locator('#whoBtn').is_hidden()
            await first.fill('#siPassword', PASSWORD)
            await first.click('#studentSignIn button[type=submit]')
            await first.locator('#whoBtn').wait_for(state='visible')
            await first.click('#whoBtn')
            await save(first)

            # Check Arabic/RTL Welcome, New-student, Sign-in and Forgot-password screens on a fresh browser, then switch to English.
            c2, second = await page_for(browser, lang='ar')
            assert await second.locator('html').get_attribute('dir') == 'rtl'
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/ar_welcome.png'), full_page=True)
            await second.click('#login [data-mode="new"]')
            await second.locator('#imPassword').evaluate("el => el.closest('details').open = true")
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/ar_new.png'), full_page=True)
            await second.click('#login [data-mode="in"]')
            await second.locator('#csCode').evaluate("el => el.closest('details').open = true")
            await second.screenshot(path=str(ROOT / 'shots/ar_signin.png'), full_page=True)
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.click('[data-change-lang]')
            await second.click('[data-lang="en"]')

            # A fresh browser can read the same record using only ID and password.
            await second.fill('#csId', 'cloud-learner')
            await second.fill('#csPassword', 'incorrect-password')
            await second.click('#cloudSignIn button[type=submit]')
            await second.wait_for_function("document.querySelector('#csMsg').textContent.length > 0")
            assert await second.locator('#whoBtn').is_hidden()
            await second.fill('#csPassword', PASSWORD)
            await second.click('#cloudSignIn button[type=submit]')
            await second.locator('#whoBtn').wait_for(state='visible')
            assert await second.evaluate("window.__hira.getState().stats['あ'].c") == 4
            await second.click('#whoBtn')
            await second.fill('#pfName', 'Newer cloud name')
            await second.click('#pfForm button[type=submit]')
            await save(second)
            assert db()['cloud-learner']['student']['name'] == 'Newer cloud name'

            # The older device cannot overwrite the newer device's saved data.
            await first.fill('#pfName', 'Stale local name')
            await first.click('#pfForm button[type=submit]')
            await save(first)
            assert 'newer data' in await first.locator('[data-cloud-status]').last.inner_text()
            assert db()['cloud-learner']['student']['name'] == 'Newer cloud name'
            await first.click('#cloudRestore')
            await first.click('#cloudRestore')
            await first.wait_for_function("document.querySelector('#pfName').value === 'Newer cloud name'")
            assert await first.locator('[data-cloud-status]').last.inner_text() == 'Cloud copy restored.'
            await first.screenshot(path=str(ROOT / 'shots/cloud-profile-en.png'), full_page=True)

            # Teacher reset-code flow in the browser: wrong code fails, short new password fails, valid code resets and signs in.
            await first.click('#pSwitch')
            code = reset_code('cloud-learner')
            await first.locator('#cloudSignIn').evaluate("el => el.closest('details').open = true")
            await first.locator('#csCode').evaluate("el => el.closest('details').open = true")
            await first.fill('#csId', 'cloud-learner')
            await first.fill('#csPassword', RESET_PASSWORD)
            await first.fill('#csCode', 'wrong-code')
            await first.click('#cloudSignIn button[type=submit]')
            await first.wait_for_function("document.querySelector('#csMsg').textContent.includes('reset code')")
            await first.fill('#csPassword', 'short')
            await first.fill('#csCode', code)
            await first.click('#cloudSignIn button[type=submit]')
            await first.wait_for_function("document.querySelector('#csMsg').textContent.includes('10')")
            await first.fill('#csPassword', RESET_PASSWORD)
            await first.fill('#csCode', code)
            await first.click('#cloudSignIn button[type=submit]')
            await first.locator('#whoBtn').wait_for(state='visible')
            assert await first.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 4
            await first.click('#whoBtn')
            await save(first)

            # The other device can sign in with the newly reset password too.
            await second.click('#pSwitch')
            await second.locator('#cloudSignIn').evaluate("el => el.closest('details').open = true")
            await second.fill('#csId', 'cloud-learner')
            await second.fill('#csPassword', RESET_PASSWORD)
            await second.click('#cloudSignIn button[type=submit]')
            await second.locator('#whoBtn').wait_for(state='visible')
            await second.click('#whoBtn')

            # Arabic fields and live sync status remain readable on a narrow screen.
            await second.select_option('#pfLang', 'ar')
            await second.click('#pfForm button[type=submit]')
            await save(second)
            assert await second.locator('html').get_attribute('dir') == 'rtl'
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/cloud-profile-ar.png'), full_page=True)

            # Offline deletion persists, then completes on reconnect.
            await c2.set_offline(True)
            await second.click('#pDelete')
            await second.click('#pDelete')
            assert await second.locator('[data-cloud-deletes]').is_visible()
            jobs = await second.evaluate("JSON.parse(localStorage.getItem('hiragana14-sync-queue-v1'))")
            assert jobs[0]['action'] == 'delete'
            assert 'student' in db()['cloud-learner']
            await c2.set_offline(False)
            await second.wait_for_function("JSON.parse(localStorage.getItem('hiragana14-sync-queue-v1')).length === 0")
            assert sorted(db()['cloud-learner']) == ['deleted', 'hash']
            await first.fill('#pfName', 'Too late')
            await first.click('#pfForm button[type=submit]')
            await save(first)
            assert 'No cloud copy' in await first.locator('[data-cloud-status]').last.inner_text()
            assert sorted(db()['cloud-learner']) == ['deleted', 'hash']
            assert not errors, errors
            print(json.dumps({'passwords': True, 'cross_device_login': True, 'crud': True, 'conflicts': True,
                              'offline_delete': True, 'requests': len(requests), 'errors': errors}))
            await browser.close()
    finally:
        fixture.terminate()
        fixture.wait(timeout=5)


if __name__ == '__main__':
    asyncio.run(main())
