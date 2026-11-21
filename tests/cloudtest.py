"""Two devices use the real Apps Script handlers via an isolated local fixture, never live Drive."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import urllib.request
from playwright.async_api import async_playwright
from student_auth import open_profile

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

    async def fresh_minute():
        # The Apps Script allows 30 requests per student per clock minute; background syncing makes this test busier than before.
        import time
        await asyncio.sleep(61 - time.time() % 60)

    async def save(page):
        await page.click('#cloudSave')
        await page.wait_for_function("document.querySelector('#cloudSave') && !document.querySelector('#cloudSave').disabled")

    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch()
            c1, first = await page_for(browser)
            await first.click('#login [data-mode="new"]')
            await first.fill('#nsName', 'Cloud learner')
            assert await first.locator('#nsId').count() == 0  # no long ID to copy while creating a profile
            assert await first.locator('#nsPassword').count() == 0  # no password: a name is enough
            await first.click('#newStudent button[type=submit]')
            await first.locator('body:not(.signed-out)').wait_for()
            await open_profile(first)
            code_text = await first.locator('#pCode').inner_text()
            import re as _re
            assert _re.fullmatch(r'[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}', code_text), code_text
            student_id = code_text.replace('-', '')
            await first.click('#pCopy')
            await first.wait_for_function("document.querySelector('#pCopy').textContent === 'Copied' || document.querySelector('#pCopy').textContent === 'Could not copy'")
            assert await first.locator('#pShare').count() == 0  # the code is the only thing to share
            await save(first)
            assert await first.locator('[data-cloud-status]').last.inner_text() == 'Saved to cloud.'
            assert await first.locator('#cloudSummary').count() == 0
            await first.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['あ'] = {b:2,c:4,w:1,t:600}))")
            await save(first)
            assert db()[student_id]['progress']['stats']['あ']['c'] == 4

            # Signing out and tapping the name signs back in: nothing to type.
            await first.click('#pSwitch')
            await first.reload()
            assert await first.locator('#whoBtn').is_hidden()
            await first.locator('.student').click()
            await first.locator('body:not(.signed-out)').wait_for()
            await open_profile(first)
            await save(first)

            # Check Arabic/RTL Welcome, New-student, Sign-in and Forgot-password screens on a fresh browser, then switch to English.
            c2, second = await page_for(browser, lang='ar')
            assert await second.locator('html').get_attribute('dir') == 'rtl'
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/ar_welcome.png'), full_page=True)
            await second.click('#login [data-mode="new"]')
            await second.locator('#importBtn').evaluate("el => el.closest('details').open = true")
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/ar_new.png'), full_page=True)
            await second.click('#login [data-mode="in"]')
            await second.locator('#csCode').evaluate("el => el.closest('details').open = true")
            await second.screenshot(path=str(ROOT / 'shots/ar_signin.png'), full_page=True)
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.click('[data-change-lang]')
            await second.click('[data-lang="en"]')

            # A fresh browser opens the same record with only the code (any case, dash or spaces); a wrong code fails.
            await second.fill('#csId', 'ZZZZ-ZZZZ')
            await second.click('#cloudSignIn button[type=submit]')
            await second.wait_for_function("document.querySelector('#csMsg').textContent.length > 0")
            assert await second.locator('#whoBtn').is_hidden()
            await second.fill('#csId', ' ' + student_id[:4].lower() + '-' + student_id[4:].lower() + ' ')
            await second.click('#cloudSignIn button[type=submit]')
            await second.locator('body:not(.signed-out)').wait_for()
            assert await second.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 4
            await second.reload()
            await second.locator('body:not(.signed-out)').wait_for()
            assert await second.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 4
            await open_profile(second)
            await second.fill('#pfName', 'Newer cloud name')
            await second.press('#pfName', 'Enter')
            await save(second)
            assert db()[student_id]['student']['name'] == 'Newer cloud name'

            # The older device merges instead of getting stuck: its own unsent edit is kept and sent on the newer version.
            await first.fill('#pfName', 'Stale local name')
            await first.press('#pfName', 'Enter')
            await first.wait_for_function("document.querySelector('[data-cloud-status]').textContent === 'Saved to cloud.'", timeout=15000)
            assert db()[student_id]['student']['name'] == 'Stale local name'
            assert db()[student_id]['progress']['stats']['あ']['c'] == 4
            # Another device's progress arrives on its own when this one comes back online, without pressing Sync.
            await second.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['あ'] = {b:2,c:9,w:1,t:900}))")
            await save(second)
            assert db()[student_id]['progress']['stats']['あ']['c'] == 9
            await first.evaluate("window.dispatchEvent(new Event('online'))")
            await first.wait_for_function("import('./js/core/store.js').then(s => s.state.stats['あ'].c === 9)", timeout=15000)

            await first.click('#cloudRestore')
            await first.click('#cloudRestore')
            await first.wait_for_function("document.querySelector('[data-cloud-status]').textContent === 'Cloud copy restored.'")
            assert await first.input_value('#pfName') == 'Newer cloud name'  # the second device saved last, and the first one pulled it
            await first.screenshot(path=str(ROOT / 'shots/cloud-profile-en.png'), full_page=True)

            await fresh_minute()
            await first.click('#pSwitch')
            await first.locator('.student').click()
            await first.locator('body:not(.signed-out)').wait_for()
            assert await first.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 9
            await open_profile(first)
            await save(first)
            await second.click('#pSwitch')
            await second.locator('.student').click()
            await second.locator('body:not(.signed-out)').wait_for()
            await open_profile(second)

            # A device with nothing waiting to send picks up the other device's progress without being asked.
            await second.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['い'] = {b:1,c:5,w:0,t:300}))")
            await save(second)
            await first.click('#cloudSave')
            for _ in range(40):
                if await first.evaluate("import('./js/core/store.js').then(s => s.state.stats['い'] ? s.state.stats['い'].c : 0)") == 5:
                    break
                await first.wait_for_timeout(250)
            assert await first.evaluate("import('./js/core/store.js').then(s => s.state.stats['い'].c)") == 5
            assert await first.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 9

            # Arabic fields and live sync status remain readable on a narrow screen.
            await second.select_option('#pfLang', 'ar')  # changes save as they are made
            await second.wait_for_timeout(300)
            await save(second)
            assert await second.locator('html').get_attribute('dir') == 'rtl'
            assert await second.evaluate('document.documentElement.scrollWidth <= innerWidth')
            await second.screenshot(path=str(ROOT / 'shots/cloud-profile-ar.png'), full_page=True)

            await fresh_minute()
            # Offline deletion persists, then completes on reconnect.
            await c2.set_offline(True)
            await second.click('#pDelete')
            await second.click('#pDelete')
            assert await second.locator('[data-cloud-deletes]').is_visible()
            jobs = await second.evaluate("JSON.parse(localStorage.getItem('hiragana14-sync-queue-v1'))")
            assert jobs[0]['action'] == 'delete'
            assert 'student' in db()[student_id]
            await c2.set_offline(False)
            # Earlier syncs may have used this student's 30-requests-a-minute allowance; the queue retries after 15 seconds.
            await second.wait_for_function("JSON.parse(localStorage.getItem('hiragana14-sync-queue-v1')).length === 0", timeout=60000)
            assert sorted(db()[student_id]) == ['deleted', 'hash']
            await fresh_minute()
            await first.fill('#pfName', 'Too late')
            await first.press('#pfName', 'Enter')
            await save(first)
            assert 'No cloud copy' in await first.locator('[data-cloud-status]').last.inner_text()
            assert sorted(db()[student_id]) == ['deleted', 'hash']
            # A guest needs no account: nothing is sent to the cloud, it survives a reload, and progress can move to a new profile.
            sent = len(requests)
            c3, guest = await page_for(browser)
            await guest.click('#guestBtn')
            await guest.locator('body:not(.signed-out)').wait_for()
            assert await guest.evaluate("import('./js/core/store.js').then(s => s.me().id)") == 'guest'
            await guest.evaluate("import('./js/core/store.js').then(s => s.updateProgress(p => p.stats['あ'] = {b:1,c:2,w:0,t:300}))")
            await guest.wait_for_timeout(2500)
            await guest.reload()
            await guest.locator('body:not(.signed-out)').wait_for()
            assert await guest.evaluate("import('./js/core/store.js').then(s => s.me().id)") == 'guest'
            await open_profile(guest)
            assert await guest.locator('#cloudSave').count() == 0 and await guest.locator('#cloudRestore').count() == 0
            assert len(requests) == sent, requests[sent:]
            await guest.click('#pSwitch')
            await guest.click('#login [data-mode="new"]')
            await guest.fill('#nsName', 'Former guest')
            assert await guest.locator('#nsGuest').is_checked()
            await guest.click('#newStudent button[type=submit]')
            await guest.locator('body:not(.signed-out)').wait_for()
            assert await guest.evaluate("import('./js/core/store.js').then(s => s.state.stats['あ'].c)") == 2
            assert await guest.evaluate("import('./js/core/store.js').then(s => s.students.list.map(p => p.id).includes('guest'))") is False
            assert not errors, errors
            print(json.dumps({'passwords': True, 'cross_device_login': True, 'crud': True, 'conflicts': True,
                              'offline_delete': True, 'requests': len(requests), 'errors': errors}))
            await browser.close()
    finally:
        fixture.terminate()
        fixture.wait(timeout=5)


if __name__ == '__main__':
    asyncio.run(main())
