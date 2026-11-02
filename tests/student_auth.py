"""Shared fixtures for password-based UI suites. Ordinary suites never contact live cloud data."""
PASSWORD = 'Test-study-password-2026'


async def disable_cloud(page):
    await page.route('**/js/core/cloud-config.js', lambda route: route.fulfill(
        body="export const SYNC_URL = '';", content_type='text/javascript'))


async def submit_student(page):
    await page.fill('#nsPassword', PASSWORD)
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
    await page.click('#studentSignIn button[type=submit]')
    await page.locator('#whoBtn').wait_for(state='visible')


async def prepare_import(page):
    if await page.locator('#modeNew').is_hidden():
        await page.click('#login [data-mode="new"]')
    await page.locator('#imPassword').evaluate("el => el.closest('details').open = true")
    await page.fill('#imPassword', PASSWORD)
    await page.fill('#imConfirm', PASSWORD)
