"""Shared fixtures for password-based UI suites. Ordinary suites never contact live cloud data."""
PASSWORD = 'Test-study-password-2026'


async def disable_cloud(page):
    await page.route('**/js/core/cloud-config.js', lambda route: route.fulfill(
        body="export const SYNC_URL = '';", content_type='text/javascript'))


async def submit_student(page, pace='14', remember=False):
    # the app now defaults to 21 days; most suites were written against the 14-day plan
    if pace and await page.locator('#nsPace').count():
        await page.evaluate("document.querySelector('#nsMore').open = true")  # colour, level and plan sit under an optional section
        await page.select_option('#nsPace', pace)
    # staying signed in is now the default; suites that reload expecting the sign-in screen opt out
    if await page.locator('#nsRemember').count():
        await page.locator('#nsRemember').set_checked(remember)
    await page.fill('#nsPassword', PASSWORD)
    if await page.locator('#nsConfirm').count():
        await page.fill('#nsConfirm', PASSWORD)
    await page.click('#newStudent button[type=submit]')
    await page.wait_for_function("!document.querySelector('#newStudent button[type=submit]')?.disabled")


async def unlock_student(page, name=None):
    if name is not None:
        await page.locator('.student').filter(has_text=name).click()
    else:
        await page.locator('.student').first.click()
    await page.fill('#siPassword', PASSWORD)
    if await page.locator('#siConfirm').count():
        await page.fill('#siConfirm', PASSWORD)
    if await page.locator('#siRemember').count():
        await page.locator('#siRemember').set_checked(False)
    await page.click('#studentSignIn button[type=submit]')
    await page.locator('body:not(.signed-out)').wait_for()


async def open_profile(page):
    if await page.locator('#tab-profile').is_hidden():
        await page.click('#whoBtn')
    await page.locator('#tab-profile').wait_for(state='visible')


async def prepare_import(page):
    if await page.locator('#modeNew').is_hidden():
        await page.click('#login [data-mode="new"]')
    await page.locator('#imPassword').evaluate("el => el.closest('details').open = true")
    await page.fill('#imPassword', PASSWORD)
    if await page.locator('#imConfirm').count():
        await page.fill('#imConfirm', PASSWORD)
