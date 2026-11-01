import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright

async def go(pg, tab):
    grp = {'plan':'home','chart':'letters','drill':'practice','write':'practice','read':'practice','progress':'progress','profile':'profile','phrases':'practice'}[tab]
    if grp == 'profile': await pg.click('#whoBtn'); await pg.wait_for_timeout(60); return
    await pg.click(f'nav [data-nav="{grp}"]')
    if grp == 'practice':
        sel = f'#subnav [data-sub="{tab}"]'
        if await pg.get_attribute(sel, 'aria-selected') != 'true': await pg.click(sel)
    await pg.wait_for_timeout(60)

async def write_clean(pg, k):
    t = await pg.evaluate(f"window.__hira.strokeTemplates('{k}').pts"); bb = await pg.locator('#wpad').bounding_box()
    for s in t:
        await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
        for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
        await pg.mouse.up()
    await pg.wait_for_timeout(100)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844}); errs = []; R = {}
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.add_init_script("window.__plays=[];const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const el=this;const r=op.call(this);const i=window.__plays.push('pending')-1;r.then(()=>setTimeout(()=>window.__plays[i]=el.src.split('/').pop()+' rate='+el.playbackRate+' dur='+(el.duration||0).toFixed(2),400)).catch(e=>window.__plays[i]='err:'+e.name);return r;};")
        await pg.emulate_media(reduced_motion='reduce')
        await pg.goto(BASE + '#test'); await pg.wait_for_timeout(300)
        await pg.fill('#nsName', 'Kid'); await pg.select_option('#nsAge', 'child'); await pg.select_option('#nsPace', '7'); await pg.select_option('#nsMin', '20'); await pg.select_option('#nsReason', 'travel')
        await pg.click('#newStudent button[type=submit]'); await pg.wait_for_timeout(250)
        R['kid'] = [await pg.evaluate("document.body.classList.contains('kid')"), await pg.text_content('#appSub'), await pg.text_content('#tab-plan h2'), await pg.text_content('#tab-plan .dtitle')]
        R['task_minutes'] = await pg.eval_on_selector_all('#tab-plan .today ol.tasks li', 'e=>e.map(x=>x.textContent.match(/\\(.*\\)$/)[0])')
        # card: example and Hear plays letter+example at slow speed
        await go(pg, "chart"); await pg.click('#tab-chart [data-open="か"]'); await pg.wait_for_timeout(200)
        R['example'] = await pg.inner_text('#sheetRoot .ex'); await pg.click('#shSay'); await pg.wait_for_timeout(900); await pg.keyboard.press('Escape')
        # drill: first badge toast, mix-ups (choose mode, wrong picks)
        await go(pg, "drill"); R['drill_default_len'] = await pg.get_attribute('[data-len][aria-pressed="true"]', 'data-len')
        await pg.click('[data-mode="choose"]'); await pg.click('#startDrill'); await pg.wait_for_timeout(200)
        for i in range(60):
            if await pg.locator('#rAgain').count(): break
            if await pg.locator('#qNext').count(): await pg.click('#qNext'); continue
            if i == 0:
                await pg.locator('[data-pick]').first.click(); await pg.wait_for_timeout(300)
                R['toast'] = await pg.text_content('#toast')
                continue
            await pg.locator('[data-pick]').nth(i % 4).click(); await pg.wait_for_timeout(480)
        # write あ cleanly (child leniency on) and listen
        await go(pg, "write"); await pg.wait_for_timeout(150)
        await write_clean(pg, 'あ'); await pg.click('#wSay'); await pg.wait_for_timeout(600)
        R['plays'] = await pg.evaluate('window.__plays')
        # time tracking: one 15 s tick while active
        await pg.mouse.click(5, 300); await pg.wait_for_timeout(16000)
        # profile page
        await pg.click('#whoBtn'); await pg.wait_for_timeout(250)
        R['hash'] = await pg.evaluate('location.hash')
        R['level'] = [await pg.text_content('.lvname'), await pg.text_content('.phero .small')]
        R['today'] = await pg.text_content('#todayMin')
        R['badges'] = await pg.eval_on_selector_all('.badge.got b', 'e=>e.map(x=>x.textContent)')
        R['weak'] = await pg.eval_on_selector_all('#tab-profile .missed [data-open]', 'e=>e.map(x=>x.dataset.open)')
        R['rows'] = await pg.eval_on_selector_all('.rr', 'e=>e.slice(0,3).map(x=>x.innerText.replace(/\\n/g," "))')
        R['mix'] = await pg.eval_on_selector_all('.mixl li', 'e=>e.map(x=>x.innerText)')
        R['roadmap_goal'] = await pg.evaluate("(()=>{ return null })()")
        await pg.screenshot(path='shots/pf_top.png')
        # change settings: pace 21, adult, Arabic, kana avatar, then photo
        await pg.select_option('#pfPace', '21'); await pg.select_option('#pfAge', 'adult'); await pg.select_option('#pfLang', 'ar'); await pg.check('input[name="pfAv"][value="kana"]'); await pg.select_option('#pfKana', 'ね')
        await pg.click('#pfForm button[type=submit]'); await pg.wait_for_timeout(250)
        R['after_save'] = [await pg.evaluate("document.documentElement.dir"), await pg.text_content('#appSub'), await pg.evaluate("document.body.classList.contains('kid')"), await pg.text_content('#whoBtn .av'), await pg.text_content('#pfMsg')]
        avatar = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'icon-192.png')
        await pg.check('input[name="pfAv"][value="photo"]'); await pg.set_input_files('#pfPhoto', avatar); await pg.wait_for_timeout(300)
        await pg.click('#pfForm button[type=submit]'); await pg.wait_for_timeout(250)
        R['photo'] = await pg.evaluate("(document.querySelector('#whoBtn .av img')||{}).src ? document.querySelector('#whoBtn .av img').src.slice(0,30) + ' len=' + document.querySelector('#whoBtn .av img').src.length : null")
        await pg.screenshot(path='shots/pf_ar.png', full_page=True)
        await go(pg, "plan"); await pg.wait_for_timeout(150)
        R['plan21'] = [await pg.text_content('#tab-plan h2'), await pg.locator('#tab-plan .days details').count(), await pg.eval_on_selector_all('#tab-plan .days .t', 'e=>e.slice(0,4).map(x=>x.textContent)')]
        await go(pg, "progress"); await pg.wait_for_timeout(150)
        R['road'] = await pg.eval_on_selector_all('.road li', 'e=>e.map(x=>x.querySelector("b").textContent + " | " + (x.querySelector(".rhead .muted")||{}).textContent)')
        # drill these from weakest
        await pg.click('#whoBtn'); await pg.wait_for_timeout(200)
        if await pg.locator('#pfDrillWeak').count():
            await pg.click('#pfDrillWeak'); await pg.wait_for_timeout(200); R['drill_these'] = [await pg.evaluate('location.hash'), await pg.locator('#qtopWrap, .prompt, #qk').count()]
        await pg.reload(); await pg.wait_for_timeout(400)
        R['reload'] = [await pg.evaluate("document.documentElement.lang"), await pg.locator('#whoBtn .av img').count()]
        assert R['after_save'][0] == 'rtl', R['after_save']
        assert R['after_save'][2] is False, R['after_save']
        assert R['photo'] and R['photo'].startswith('data:image/jpeg;base64,'), R['photo']
        assert R['plan21'][1] == 21, R['plan21']
        assert R['reload'] == ['ar', 1], R['reload']
        assert not errs, errs
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1)); await b.close()
asyncio.run(main())
