from student_auth import open_profile, disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
BG = "getComputedStyle(document.body).backgroundColor"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); R = {}; errs = []
        for lang, scheme in [('en', 'light'), ('ar', 'dark')]:
            ctx = await b.new_context(viewport={'width': 390, 'height': 844}, color_scheme=scheme)
            pg = await ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
            await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
            await pg.click(f'[data-lang="{lang}"]'); await pg.fill('#nsName', 'Aya'); await submit_student(pg); await pg.wait_for_timeout(250)
            R[lang + '_default_bg'] = await pg.evaluate(BG)
            await open_profile(pg); await pg.wait_for_timeout(200)
            R[lang + '_ctl'] = [await pg.eval_on_selector_all('[data-mode]', 'e=>e.map(x=>x.textContent+(x.getAttribute("aria-pressed")==="true"?"*":""))'), await pg.eval_on_selector_all('.tint span:last-child', 'e=>e.map(x=>x.textContent)')]
            await pg.locator('.themebox').scroll_into_view_if_needed(); await pg.screenshot(path=f'shots/theme_{lang}_a.png')
            # tint sky
            await pg.click('.tint:has(input[value="sky"])'); await pg.wait_for_timeout(100)
            R[lang + '_sky_bg'] = [await pg.evaluate(BG), await pg.evaluate("document.documentElement.dataset.tint"), await pg.evaluate("document.querySelector('meta[name=theme-color]').content")]
            # force opposite mode
            other = 'dark' if scheme == 'light' else 'light'
            await pg.click(f'[data-mode="{other}"]'); await pg.wait_for_timeout(100)
            R[lang + f'_{other}_bg'] = [await pg.evaluate(BG), await pg.evaluate("document.documentElement.dataset.theme")]
            await pg.screenshot(path=f'shots/theme_{lang}_b.png')
            await pg.click('[data-mode="system"]'); await pg.wait_for_timeout(100)
            R[lang + '_system_bg'] = [await pg.evaluate(BG), await pg.evaluate("document.documentElement.dataset.theme || 'none'")]
            await pg.click('.tint:has(input[value="rose"])'); await pg.click('[data-mode="dark"]'); await pg.wait_for_timeout(100)
            # persists after reload, and no flash: attributes exist before app runs
            await pg.reload(); await unlock_student(pg); await pg.wait_for_timeout(400)
            R[lang + '_reload'] = [await pg.evaluate(BG), await pg.evaluate("document.documentElement.dataset.tint + '/' + document.documentElement.dataset.theme")]
            # second student has its own theme, switching restores
            await open_profile(pg); await pg.click('#pSwitch'); await pg.wait_for_timeout(150)
            R[lang + '_login_bg'] = await pg.evaluate(BG)
            await pg.click('#login [data-mode="new"]')
            await pg.fill('#nsName', 'Ken'); await submit_student(pg); await pg.wait_for_timeout(250)
            R[lang + '_ken_inherits'] = await pg.evaluate("document.documentElement.dataset.tint + '/' + document.documentElement.dataset.theme")
            await open_profile(pg); await pg.click('.tint:has(input[value="sand"])'); await pg.click('[data-mode="light"]')
            await pg.click('#pSwitch'); await unlock_student(pg, 'Aya'); await pg.wait_for_timeout(250)
            R[lang + '_aya_back'] = await pg.evaluate("document.documentElement.dataset.tint + '/' + document.documentElement.dataset.theme")
            # export carries theme
            await open_profile(pg); await pg.wait_for_timeout(150)
            async with pg.expect_download() as dl: await pg.click('#pExport')
            d = await dl.value; path = f'/tmp/th_{lang}.json'; await d.save_as(path)
            R[lang + '_export_theme'] = json.load(open(path))['student'].get('theme')
            # import restores it
            await pg.click('#pSwitch'); await prepare_import(pg); await pg.set_input_files('#importFile', path); await pg.wait_for_timeout(300)
            R[lang + '_import'] = await pg.evaluate("document.documentElement.dataset.tint + '/' + document.documentElement.dataset.theme")
            # every main page reads in dark+rose: contrast spot check of text on paper
            await pg.evaluate("document.documentElement.setAttribute('data-theme','dark');document.documentElement.setAttribute('data-tint','sky')")
            res = {}
            for tab, sel in [('plan', 'home'), ('chart', 'letters')]:
                await pg.click(f'nav [data-nav="{sel}"]'); await pg.wait_for_timeout(120)
                res[tab] = await pg.evaluate("[...document.querySelectorAll('#tab-" + tab + " h2, #tab-" + tab + " p, #tab-" + tab + " .muted')].slice(0,6).map(e=>{const c=getComputedStyle(e);return c.color})")
            R[lang + '_dark_text_colors'] = res
            await pg.screenshot(path=f'shots/theme_{lang}_c.png')
            await ctx.close()
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1))
asyncio.run(main())
