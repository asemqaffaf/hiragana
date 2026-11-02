from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
"""Prove that new locales work without modifying screen code."""
import asyncio
import json
import os
from pathlib import Path
import re

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
BROWSER = os.environ.get('BROWSER', 'chromium')

FRENCH = {
    'id': 'fr', 'label': 'Français', 'direction': 'ltr', 'dateLocale': 'fr-FR',
    'strings': {'login.create': 'Créer un profil', 'nav.home': 'Aujourd’hui'},
    'content': {
        'meanings': {'いえ': 'maison'},
        'dailySentences': {'いえ': 'Je rentre à la maison.'},
        'hooks': {'あ': 'Un aide-mémoire'},
        'plan': [{'t': 'Première leçon'}],
    },
}
RTL = {'id': 'he', 'label': 'עברית', 'direction': 'rtl', 'strings': {}}


async def main():
    async with async_playwright() as playwright:
        browser = await getattr(playwright, BROWSER).launch()
        context = await browser.new_context(locale='fr-FR', viewport={'width': 390, 'height': 844})
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.emulate_media(reduced_motion='reduce')
        source = (ROOT / 'js/i18n/locales.js').read_text()
        definitions = 'const french = ' + json.dumps(FRENCH) + ';\nconst rtl = ' + json.dumps(RTL) + ';\n'
        source = re.sub(r'export const LOCALES = \[[^\]]*\];', lambda _: definitions + 'export const LOCALES = [english, arabic, french, rtl];', source)
        await page.route('**/js/i18n/locales.js', lambda route: route.fulfill(body=source, content_type='text/javascript'))

        await disable_cloud(page); await page.goto(BASE + '#test')
        await page.locator('.langstep').wait_for()
        assert await page.locator('[data-lang]').count() == 4
        assert await page.locator('html').get_attribute('lang') == 'fr'
        await page.click('[data-lang="fr"]')
        await page.locator('#nsName').wait_for()
        assert await page.locator('#login h2').inner_text() == 'Créer un profil'
        await page.fill('#nsName', 'Camille')
        await submit_student(page)
        assert await page.locator('#tab-plan .dtitle').inner_text() == 'Première leçon'
        assert await page.locator('nav [data-nav="home"] .tl').inner_text() == 'Aujourd’hui'
        await page.click('[data-step="words"]')
        assert await page.locator('.dcard .dmean').first.inner_text() == 'maison'
        assert await page.locator('.dcard .dex .dmean').first.inner_text() == 'Je rentre à la maison.'
        await page.click('#whoBtn')
        assert await page.locator('#pfLang option[value="fr"]').count() == 1
        assert await page.locator('#pfNative').input_value() == 'fr'
        await page.select_option('#pfLang', 'he')
        await page.click('#pfForm button[type=submit]')
        assert await page.locator('html').get_attribute('dir') == 'rtl'
        await page.reload()
        await unlock_student(page)
        await page.locator('#whoBtn').wait_for()
        assert await page.locator('html').get_attribute('lang') == 'he'
        assert await page.locator('html').get_attribute('dir') == 'rtl'
        if await page.locator('#pfLang').count() == 0:
            await page.click('#whoBtn')
        async with page.expect_download() as pending:
            await page.click('#pExport')
        exported = json.loads(Path(await (await pending.value).path()).read_text())
        assert exported['student']['lang'] == 'he'
        await page.click('#pSwitch')
        await prepare_import(page); await page.set_input_files('#importFile', {'name': 'student.json', 'mimeType': 'application/json', 'buffer': json.dumps(exported).encode()})
        await page.locator('#whoBtn').wait_for()
        assert await page.locator('html').get_attribute('lang') == 'he'
        assert await page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        assert not errors, errors
        print(json.dumps({'browser': BROWSER, 'registered_locales': 4, 'reload_and_import': True, 'errors': errors}))
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
