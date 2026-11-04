"""Practice is a suggested sequence with matching content and no locked steps."""
import asyncio
import json
import os

from playwright.async_api import async_playwright
from student_auth import disable_cloud, submit_student

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')


async def visible_tab(page, tab):
    await page.locator('#tab-' + tab).wait_for(state='visible')
    assert await page.locator('#subnav [aria-current="step"]').get_attribute('data-sub') == tab
    assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')


async def continue_to(page, tab):
    await page.locator(f'.tab:not([hidden]) [data-practice-next="{tab}"]').click()
    await visible_tab(page, tab)


async def open_write(page, kana):
    await page.click('nav [data-nav="letters"]')
    await page.locator('#tab-chart').wait_for(state='visible')
    await page.locator(f'#tab-chart [data-open="{kana}"]').first.click()
    await page.click('#shWrite')
    await visible_tab(page, 'write')


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        reports = []
        for lang, width, height in [('en', 393, 852), ('ar', 375, 667), ('en', 320, 568), ('en', 1280, 800)]:
            page = await browser.new_page(viewport={'width': width, 'height': height}, reduced_motion='reduce', color_scheme='dark')
            errors = []
            page.on('pageerror', lambda error: errors.append(str(error)))
            await disable_cloud(page)
            await page.goto(BASE + '#test')
            await page.click(f'[data-lang="{lang}"]')
            await page.fill('#nsName', 'Guided practice')
            await submit_student(page)
            await page.locator('body:not(.signed-out)').wait_for()
            await page.click('nav [data-nav="practice"]')
            await visible_tab(page, 'write')
            assert await page.locator('#tab-write select').count() == 0
            assert await page.locator('#subnav [data-sub]').evaluate_all('els => els.map(el => el.dataset.sub)') == ['write', 'read', 'phrases', 'drill']
            assert await page.locator('#backBar').is_hidden()
            assert await page.locator('#homeBtn').is_visible()
            # Every step is available before the learner has written or answered anything.
            assert await page.locator('#subnav [data-sub]:disabled').count() == 0
            await page.click('#subnav [data-sub="drill"]')
            await visible_tab(page, 'drill')
            assert await page.locator('#startDrill').is_enabled()
            await page.click('#subnav [data-sub="write"]')
            await visible_tab(page, 'write')
            await open_write(page, 'な')
            await page.click('[data-wk="ぬ"]')
            await page.screenshot(path=f'shots/practice_write_{lang}_{width}.png')
            await continue_to(page, 'read')
            assert await page.locator('#tab-read .phfilter > .kana').inner_text() == 'ぬ'
            await page.screenshot(path=f'shots/practice_words_{lang}_{width}.png')
            await continue_to(page, 'phrases')
            assert await page.locator('#tab-phrases .phfilter > .kana').inner_text() == 'ぬ'
            await page.screenshot(path=f'shots/practice_phrases_{lang}_{width}.png')
            await continue_to(page, 'drill')
            assert await page.locator('[data-sel="row-n"]').get_attribute('aria-pressed') == 'true'
            assert not await page.locator('#drillMore').evaluate('el => el.open')
            await page.screenshot(path=f'shots/practice_quiz_{lang}_{width}.png')
            assert await page.locator('#backBar').is_visible()
            assert await page.evaluate("Object.keys(window.__hira.getState().ws).length === 0 && Object.keys(window.__hira.getState().cl).length === 0 && window.__hira.getState().rounds.length === 0")
            # Back follows the same path and keeps the letter context.
            for tab in ['phrases', 'read', 'write']:
                await page.click('#backBtn')
                await visible_tab(page, tab)
            assert await page.locator('[data-wk="ぬ"]').get_attribute('aria-pressed') == 'true'
            await continue_to(page, 'read')
            await continue_to(page, 'phrases')
            await continue_to(page, 'drill')
            await page.click('#startDrill')
            await page.locator('#qin').wait_for()
            assert await page.evaluate("(async () => { const {ui} = await import('./js/core/ui-state.js'); window.__practiceSession = ui.session; return ui.session.pool.join('') === 'なにぬねの'; })()")
            # Typing either answer must wait for Check or Enter before grading.
            correct = await page.evaluate("""async () => {
                const {ui} = await import('./js/core/ui-state.js');
                const {rom} = await import('./js/data/letters.js');
                return rom(ui.session.seq[ui.session.i].k);
            }""")
            await page.fill('#qin', correct)
            await page.wait_for_timeout(800)
            assert await page.evaluate("window.__practiceSession.results.length === 0 && !window.__practiceSession.locked")
            assert await page.locator('#qsq .mark.ok').count() == 0
            await page.click('#qCheck')
            assert await page.evaluate("window.__practiceSession.results.length === 1 && window.__practiceSession.results[0].ok")
            await page.wait_for_function("window.__practiceSession.i === 1 && !window.__practiceSession.locked")
            await page.fill('#qin', 'wrong')
            await page.wait_for_timeout(800)
            assert await page.evaluate("window.__practiceSession.results.length === 1 && !window.__practiceSession.locked")
            await page.press('#qin', 'Enter')
            assert await page.evaluate("window.__practiceSession.results.length === 2 && !window.__practiceSession.results[1].ok")
            assert await page.locator('#qsq .mark.no').count() == 1
            await page.click('#qNext')
            # Browsing a new row must not discard an unfinished quiz.
            await page.click('#subnav [data-sub="write"]')
            await visible_tab(page, 'write')
            await open_write(page, 'か')
            await continue_to(page, 'read')
            await continue_to(page, 'phrases')
            await continue_to(page, 'drill')
            assert await page.evaluate("import('./js/core/ui-state.js').then(({ui}) => ui.session === window.__practiceSession)")
            await page.click('#qEnd')
            await page.locator('#startDrill').wait_for()
            # A new quiz after ending the old one follows the new row.
            await page.click('#subnav [data-sub="write"]')
            await visible_tab(page, 'write')
            await continue_to(page, 'read')
            await continue_to(page, 'phrases')
            await continue_to(page, 'drill')
            assert await page.locator('[data-sel="row-k"]').get_attribute('aria-pressed') == 'true'
            if lang == 'en' and width == 393:
                # Lesson modes belong to the signed-in learner, even if they switch mid-lesson.
                await page.click('nav [data-nav="home"]')
                await page.locator('#tab-plan').wait_for(state='visible')
                await page.click('[data-step="write"]')
                await visible_tab(page, 'write')
                assert await page.locator('#tab-write [data-practice-next]').count() == 0
                await page.click('nav [data-nav="home"]')
                await page.locator('#tab-plan').wait_for(state='visible')
                await page.click('[data-step="quiz"]')
                await page.locator('#qin').wait_for()
                await page.click('#whoBtn')
                await page.click('#pSwitch')
                await page.click('#login [data-mode="new"]')
                await page.fill('#nsName', 'Second learner')
                await submit_student(page)
                await page.locator('body:not(.signed-out)').wait_for()
                await page.click('nav [data-nav="practice"]')
                await visible_tab(page, 'write')
                assert await page.locator('#tab-write [data-practice-next="read"]').is_visible()
                assert await page.evaluate("import('./js/core/ui-state.js').then(({ui}) => !ui.lessonWrite && !ui.lessonQuiz && !ui.session)")
            assert not errors, errors
            reports.append({'language': lang, 'width': width, 'sequence': True, 'unlocked': True, 'matching_quiz': True, 'history': True, 'active_quiz_preserved': True})
            await page.close()
        await browser.close()
        print(json.dumps({'reports': reports, 'errors': []}))


if __name__ == '__main__':
    asyncio.run(main())
