import asyncio
import json
import os
from pathlib import Path
import re

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
ROOT = Path(__file__).resolve().parent.parent


async def main():
    source = '\n'.join(path.read_text() for path in (ROOT / 'js').rglob('*.js'))
    used = set(re.findall(r"\bt\(\s*'([a-zA-Z0-9_.]+)'\s*[,)]", source))
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        page = await browser.new_page()
        await page.goto(BASE + '#test')
        await page.locator('.langstep').wait_for()
        reports = await page.evaluate("""async () => {
          const {localeIds, STR} = await import('./js/i18n/core.js');
          const {auditLocale} = await import('./js/i18n/audit.js');
          return {keys: Object.keys(STR.en), locales: localeIds().map(auditLocale)};
        }""")
        undefined = sorted(used - set(reports['keys']))
        assert not undefined, undefined
        for report in reports['locales']:
            assert not report['extra'], report
            assert not report['mismatched'], report
            assert not report['invalidTypes'], report
        print(json.dumps(reports, ensure_ascii=False))
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
