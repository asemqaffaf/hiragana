import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json, re
from playwright.async_api import async_playwright

async def go(pg, tab):
    grp = {'plan':'home','chart':'letters','drill':'practice','write':'practice','read':'practice','progress':'progress','profile':'profile','phrases':'practice'}[tab]
    if grp == 'profile': await pg.click('#whoBtn'); await pg.wait_for_timeout(60); return
    await pg.click(f'nav [data-nav="{grp}"]')
    if grp == 'practice':
        sel = f'#subnav [data-sub="{tab}"]'
        if await pg.get_attribute(sel, 'aria-selected') != 'true': await pg.click(sel)
    await pg.wait_for_timeout(60)

URL = BASE
LATIN = re.compile(r'\b(the|and|Tap|Drill|Write|stroke|strokes|Start|Read|Plan|Chart|Day|Next|Close|Profile|right|clean)\b')
async def visible_latin(pg):
    txt = await pg.evaluate("() => { const out=[]; const w=document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n; while((n=w.nextNode())){ const el=n.parentElement; if(!el || el.closest('[hidden],script,style,.credit,.kana,.r,.ro,.prompt,#qflash')) continue; const s=getComputedStyle(el); if(s.display==='none'||s.visibility==='hidden') continue; const t=n.textContent.trim(); if(t) out.push(t);} return out; }")
    return [t for t in txt if LATIN.search(t)]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        pg = await b.new_page(viewport={'width': 390, 'height': 844}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'Failed to load resource' not in m.text else None)
        await pg.add_init_script("window.__plays=[];const op=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){const el=this;const r=op.call(this);const i=window.__plays.push('pending')-1;r.then(()=>setTimeout(()=>window.__plays[i]='ok '+el.src.split('/').slice(-2).join('/')+' dur='+(el.duration||0).toFixed(2),400)).catch(e=>window.__plays[i]='err:'+e.name);return r;};")
        await pg.emulate_media(reduced_motion='reduce')
        R = {}
        await pg.goto(URL + '#test'); await pg.wait_for_timeout(400)
        R['en_title'] = await pg.text_content('#login h2')
        await pg.click('[data-lang="ar"]'); await pg.wait_for_timeout(150)
        R['ar_dir'] = await pg.evaluate("[document.documentElement.lang, document.documentElement.dir, document.title]")
        R['ar_login_h2'] = await pg.text_content('#login h2')
        await pg.screenshot(path='shots/ar_login.png')
        await pg.fill('#nsName', 'عاصم'); await pg.click('#newStudent button[type=submit]'); await pg.wait_for_timeout(250)
        R['ar_plan'] = [await pg.text_content('#tab-plan h2'), await pg.text_content('#tab-plan .date'), await pg.text_content('#tab-plan .dtitle')]
        R['ar_nav'] = await pg.eval_on_selector_all('nav.tabs .tl', 'e=>e.map(x=>x.textContent)')
        R['ar_latin_plan'] = await visible_latin(pg)
        await pg.screenshot(path='shots/ar_plan.png')
        # chart + card
        await go(pg, "chart"); await pg.wait_for_timeout(150)
        R['ar_back'] = await pg.text_content('#backLabel')
        await pg.click('#tab-chart [data-open="さ"]'); await pg.wait_for_timeout(300)
        R['ar_card'] = await pg.text_content('#sheetRoot .hook')
        await pg.click('#shSay'); await pg.wait_for_timeout(800)
        R['ar_latin_card'] = await visible_latin(pg)
        await pg.screenshot(path='shots/ar_card.png')
        # phone back closes the card, then goes back to plan
        await pg.go_back(); await pg.wait_for_timeout(200)
        R['back1_card_closed'] = (await pg.inner_html('#sheetRoot')) == ''
        await pg.go_back(); await pg.wait_for_timeout(200)
        R['back2_tab'] = await pg.evaluate("location.hash")
        # drill read: Arabic UI, romaji input
        await go(pg, "drill"); await pg.click('[data-len="10"]'); await pg.wait_for_timeout(100)
        R['ar_drill_start'] = await pg.text_content('#startDrill')
        await pg.click('#startDrill'); await pg.wait_for_timeout(100)
        await pg.fill('#qin', 'zz'); await pg.press('#qin', 'Enter'); await pg.wait_for_timeout(300)
        R['ar_feedback'] = await pg.inner_text('.fb')
        await pg.screenshot(path='shots/ar_drill_fb.png')
        R['ar_latin_drill'] = await visible_latin(pg)
        # write tab
        await go(pg, "write"); await pg.wait_for_timeout(200)
        R['ar_write_status'] = await pg.text_content('#wStat')
        t = await pg.evaluate("window.__hira.strokeTemplates('あ').pts"); bb = await pg.locator('#wpad').bounding_box()
        await pg.mouse.move(bb['x'] + t[0][-1][0]*bb['width'], bb['y'] + t[0][-1][1]*bb['height']); await pg.mouse.down()
        for q in t[0][::-1][1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
        await pg.mouse.up(); R['ar_write_reverse'] = await pg.text_content('#wStat')
        await pg.wait_for_timeout(1300)
        for s in t:
            await pg.mouse.move(bb['x'] + s[0][0]*bb['width'], bb['y'] + s[0][1]*bb['height']); await pg.mouse.down()
            for q in s[1:]: await pg.mouse.move(bb['x'] + q[0]*bb['width'], bb['y'] + q[1]*bb['height'])
            await pg.mouse.up()
        R['ar_write_done'] = await pg.text_content('#wStat')
        R['ar_latin_write'] = await visible_latin(pg)
        await pg.screenshot(path='shots/ar_write.png')
        # read tab
        await go(pg, "read"); await pg.check('#rMean'); await pg.wait_for_timeout(100)
        R['ar_words'] = await pg.eval_on_selector_all('#tab-read .word', 'e=>e.slice(0,3).concat(e.slice(-2)).map(x=>x.innerText.replace(/\\n/g," | "))')
        await pg.locator('#tab-read [data-say]').nth(3).click(); await pg.wait_for_timeout(700)
        await pg.screenshot(path='shots/ar_read.png')
        R['ar_latin_read'] = await visible_latin(pg)
        # profile: Arabic, then switch to English in the profile form
        await pg.click('#whoBtn'); await pg.wait_for_timeout(200)
        R['ar_profile'] = [await pg.evaluate('location.hash'), await pg.text_content('#tab-profile h2')]
        await pg.screenshot(path='shots/ar_profile.png')
        await pg.select_option('#pfLang', 'en'); await pg.click('#pfForm button[type=submit]'); await pg.wait_for_timeout(250)
        R['switched_en'] = [await pg.evaluate("document.documentElement.dir"), await pg.text_content('nav [data-nav="home"] .tl')]
        await go(pg, "plan")
        R['en_plan'] = await pg.text_content('#tab-plan h2')
        # reload keeps student language
        await pg.reload(); await pg.wait_for_timeout(400)
        R['reload_lang'] = await pg.evaluate("document.documentElement.lang")
        R['audio'] = await pg.evaluate('window.__plays') if False else None
        R['errors'] = errs
        print(json.dumps(R, ensure_ascii=False, indent=1))
        await b.close()
asyncio.run(main())
