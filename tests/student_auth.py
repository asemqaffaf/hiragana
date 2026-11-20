"""Shared fixtures for password-based UI suites. Ordinary suites never contact live cloud data."""
PASSWORD = 'Test-study-password-2026'


async def disable_cloud(page):
    await page.route('**/js/core/cloud-config.js', lambda route: route.fulfill(
        body="export const SYNC_URL = '';", content_type='text/javascript'))


async def submit_student(page, pace='14', remember=True):
    # Profiles have no password now: a name is enough, and the sign-in stays until "Switch student".
    # the app defaults to 21 days; most suites were written against the 14-day plan
    if pace and await page.locator('#nsPace').count():
        await page.evaluate("document.querySelector('#nsMore').open = true")  # colour, level and plan sit under an optional section
        await page.select_option('#nsPace', pace)
    await page.click('#newStudent button[type=submit]')
    await page.wait_for_function("!document.querySelector('#newStudent button[type=submit]')?.disabled")


async def unlock_student(page, name=None):
    """Open a student from the sign-in screen (a tap on the name is enough; an older password profile would ask)."""
    if await page.locator('body.signed-out').count() == 0:
        return
    if name is not None:
        await page.locator('.student').filter(has_text=name).click()
    else:
        await page.locator('.student').first.click()
    if await page.locator('#siPassword').count():
        await page.fill('#siPassword', PASSWORD)
        if await page.locator('#siConfirm').count():
            await page.fill('#siConfirm', PASSWORD)
        await page.click('#studentSignIn button[type=submit]')
    await page.locator('body:not(.signed-out)').wait_for()


async def open_profile(page):
    if await page.locator('#tab-profile').is_hidden():
        await page.click('#whoBtn')
    await page.locator('#tab-profile').wait_for(state='visible')


async def prepare_import(page):
    if await page.locator('#modeNew').is_hidden():
        await page.click('#login [data-mode="new"]')
    await page.locator('#importBtn').evaluate("el => el.closest('details').open = true")
