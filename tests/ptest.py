from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, os
from playwright.async_api import async_playwright

async def go(pg, tab):
    grp = {'plan':'home','chart':'letters','drill':'practice','write':'practice','read':'practice','progress':'progress','profile':'profile','phrases':'practice'}[tab]
    if grp == 'profile': await pg.click('#whoBtn'); await pg.wait_for_timeout(60); return
    await pg.click(f'nav [data-nav="{grp}"]')
    if grp == 'practice':
        sel = f'#subnav [data-sub="{tab}"]'
        if await pg.get_attribute(sel, 'aria-selected') != 'true': await pg.click(sel)
    await pg.wait_for_timeout(60)

URL = BASE + '#test'
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}, accept_downloads=True)
        pg = await ctx.new_page(); errs = []; dialogs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('dialog', lambda d: (dialogs.append(d.message), asyncio.ensure_future(d.dismiss())))
        await pg.emulate_media(reduced_motion='reduce')
        R = {}
        await disable_cloud(pg); await pg.goto(URL); await pg.wait_for_timeout(400)
        R['0_language_step'] = [await pg.text_content('#login h2'), await pg.locator('[data-lang]').count()]
        await pg.click('[data-lang="en"]')
        R['1_first_screen'] = await pg.text_content('#login h2')
        R['1_nav_visible'] = await pg.is_visible('nav.tabs'); R['1_chip_visible'] = await pg.is_visible('#whoBtn')
        await pg.screenshot(path='/tmp/hira-tests/login_empty.png')
        await submit_student(pg); R['2_empty_name'] = await pg.text_content('#nsMsg')
        await pg.fill('#nsName', '  Aya  '); await submit_student(pg); await pg.wait_for_timeout(200)
        R['2_after_create'] = [await pg.text_content('#tab-plan h2'), await pg.text_content('#whoBtn .nm'), await pg.is_visible('nav.tabs')]
        # drill 10 in read mode
        await go(pg, "drill"); await pg.click('[data-len="10"]'); await pg.click('#startDrill')
        rom = {'あ':'a','い':'i','う':'u','え':'e','お':'o','か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko'}
        for i in range(40):
            if await pg.locator('#rAgain').count(): break
            if await pg.locator('#qNext').count(): await pg.click('#qNext'); continue
            k = await pg.text_content('#qk'); await pg.type('#qin', rom[k] if i % 4 else 'x'); 
            if i % 4 == 0: await pg.press('#qin', 'Enter')
            await pg.wait_for_timeout(500)
        R['3_aya_drill'] = await pg.text_content('.result')
        # write one clean あ
        await go(pg, "write"); await pg.wait_for_timeout(150)
        t = await pg.evaluate("window.__hira.strokeTemplates('あ').pts"); bb = await pg.locator('#wpad').bounding_box()
        for s in t:
            await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
            for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
            await pg.mouse.up()
        R['3_aya_write'] = await pg.text_content('#wStat')
        # profile sheet
        await pg.click('#whoBtn'); await pg.wait_for_timeout(150)
        R['4_profile'] = [await pg.evaluate('location.hash'), (await pg.inner_text('#tab-profile .phero')).replace('\n', ' | ')]
        await pg.screenshot(path='/tmp/hira-tests/profile.png')
        # switch, add second student, duplicate check
        await pg.click('#pSwitch'); await pg.wait_for_timeout(150)
        R['5_login_list'] = await pg.eval_on_selector_all('.student', 'e=>e.map(x=>x.innerText.replace(/\\n/g," | "))')
        await pg.fill('#nsName', 'aya'); await submit_student(pg); R['5_duplicate'] = await pg.text_content('#nsMsg')
        await pg.fill('#nsName', 'Ken'); await pg.click('.sw:nth-child(4) input', force=True); await submit_student(pg); await pg.wait_for_timeout(150)
        await go(pg, "plan")
        R['5_ken_progress_line'] = await pg.text_content('#tab-plan h2')
        await pg.click('#whoBtn'); R['5_ken_answers'] = await pg.evaluate("(()=>{const l=JSON.parse(localStorage.getItem('hiragana14-students-v1'));const p=JSON.parse(localStorage.getItem('hiragana14-progress-'+l.current)||'{}');let n=0;Object.values(p.stats||{}).forEach(x=>n+=x.c+x.w);return n})()")
        await pg.click('#pSwitch'); await pg.wait_for_timeout(150)
        await pg.screenshot(path='/tmp/hira-tests/login_two.png')
        # back to Aya: progress intact; reload keeps her logged in
        await unlock_student(pg, 'Aya'); await pg.wait_for_timeout(150)
        await pg.reload(); await unlock_student(pg); await pg.wait_for_timeout(400)
        R['6_after_reload_who'] = await pg.text_content('#whoBtn .nm')
        await pg.click('#whoBtn'); R['6_aya_answers'] = await pg.evaluate("(()=>{const l=JSON.parse(localStorage.getItem('hiragana14-students-v1'));const p=JSON.parse(localStorage.getItem('hiragana14-progress-'+l.current)||'{}');let n=0;Object.values(p.stats||{}).forEach(x=>n+=x.c+x.w);return n})()")
        # rename with duplicate + success
        await pg.fill('#pfName', 'KEN'); await pg.click('#pfForm button[type=submit]'); R['7_rename_dup'] = await pg.text_content('#pfMsg')
        await pg.fill('#pfName', 'Aya S.'); await pg.click('#pfForm button[type=submit]'); await pg.wait_for_timeout(100)
        R['7_renamed'] = [await pg.text_content('#tab-profile h2'), await pg.text_content('#whoBtn .nm')]
        # export
        async with pg.expect_download() as dl: await pg.click('#pExport')
        d = await dl.value; path = '/tmp/hira-tests/export.json'; await d.save_as(path)
        ex = json.load(open(path)); R['8_export'] = {'file': d.suggested_filename, 'app': ex['app'], 'name': ex['student']['name'], 'stats_keys': len(ex['progress']['stats']), 'ws': ex['progress']['ws'], 'act_days': len(ex['progress']['act'])}
        # delete Ken (two taps)
        await pg.click('#pSwitch')
        await unlock_student(pg, 'Ken'); await pg.click('#whoBtn')
        await pg.click('#pDelete'); R['9_delete_armed'] = await pg.text_content('#pDelete')
        await pg.click('#pDelete'); await pg.wait_for_timeout(150)
        R['9_after_delete_list'] = await pg.eval_on_selector_all('.student b', 'e=>e.map(x=>x.textContent)')
        R['9_ls_keys'] = await pg.evaluate("Object.keys(localStorage).sort()")
        # import good file -> Aya S. (2) with same stats
        await prepare_import(pg); await pg.set_input_files('#importFile', path); await pg.wait_for_timeout(300)
        R['10_import'] = [await pg.text_content('#whoBtn .nm')]
        await pg.click('#whoBtn'); R['10_import'].append(await pg.evaluate("(()=>{const l=JSON.parse(localStorage.getItem('hiragana14-students-v1'));const p=JSON.parse(localStorage.getItem('hiragana14-progress-'+l.current)||'{}');let n=0;Object.values(p.stats||{}).forEach(x=>n+=x.c+x.w);return n})()"))
        await pg.click('#pSwitch')
        # import bad file
        open('/tmp/hira-tests/bad.json', 'w').write('{"hello": 1}')
        await prepare_import(pg); await pg.set_input_files('#importFile', '/tmp/hira-tests/bad.json'); await pg.wait_for_timeout(300)
        R['11_bad_import'] = await pg.text_content('#login .fmsg')
        # html in a name is shown as text
        await pg.fill('#nsName', '<img src=x onerror=alert(1)>'); await submit_student(pg); await pg.wait_for_timeout(200)
        R['12_xss'] = {'chip_text': await pg.text_content('#whoBtn .nm'), 'img_tags': await pg.evaluate("document.querySelectorAll('img').length"), 'dialogs': dialogs}
        await pg.click('#whoBtn'); await pg.click('#pSwitch'); await pg.wait_for_timeout(100)
        R['12_list'] = await pg.eval_on_selector_all('.student b', 'e=>e.map(x=>x.textContent)')
        R['errors'] = errs
        await pg.close()
        # storage blocked browser
        pg2 = await ctx.new_page(); e2 = []
        pg2.on('pageerror', lambda e: e2.append(str(e)))
        await pg2.add_init_script("Object.defineProperty(window, 'localStorage', {get(){ throw new DOMException('blocked', 'SecurityError'); }});")
        await disable_cloud(pg2); await pg2.goto(URL); await pg2.wait_for_timeout(300)
        await pg2.click('[data-lang="en"]')
        R['13_blocked_warning'] = await pg2.text_content('#login .note.warn')
        await pg2.fill('#nsName', 'Guest'); await submit_student(pg2); await pg2.wait_for_timeout(200)
        R['13_blocked_can_study'] = await pg2.text_content('#tab-plan h2'); R['13_errors'] = e2
        print(json.dumps(R, ensure_ascii=False, indent=1))
        await b.close()
asyncio.run(main())
