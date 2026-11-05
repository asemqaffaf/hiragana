from student_auth import disable_cloud, submit_student, unlock_student, prepare_import
import os
BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
os.makedirs('/tmp/hira-tests', exist_ok=True)
import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        ctx = await b.new_context(**p.devices['iPhone 13']); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await disable_cloud(pg); await pg.goto(BASE + '#test'); await pg.wait_for_timeout(400)
        await pg.tap('[data-lang="en"]')
        await pg.fill('#nsName', 'Au'); await submit_student(pg); await pg.wait_for_timeout(300)
        R = {}
        await pg.tap('nav [data-nav="letters"]'); await pg.wait_for_timeout(200)
        # rapid replays: every tap interrupts the clip that is still loading or playing
        for k in ['あ', 'い', 'う', 'え', 'お']:
            await pg.tap(f'#tab-chart [data-open="{k}"]'); await pg.wait_for_timeout(150)
            for _ in range(3):
                await pg.tap('#shSay'); await pg.wait_for_timeout(35)
            await pg.keyboard.press('Escape'); await pg.wait_for_timeout(80)
        R['after_rapid_taps'] = await pg.evaluate("window.__hira.audioState()")
        # one long clip (letter twice + example word) must play to the very end
        await pg.tap('#tab-chart [data-open="か"]'); await pg.wait_for_timeout(250)
        await pg.tap('#shSay')
        samples = []
        for i in range(14):
            await pg.wait_for_timeout(400)
            samples.append(await pg.evaluate("(() => { const a = window.__hira.audioEl(); return [Math.round(a.currentTime*10)/10, a.paused, a.ended, Math.round((a.duration||0)*10)/10]; })()"))
        R['samples_every_400ms'] = samples
        # a different clip right after: still HTML audio, still plays
        await pg.keyboard.press('Escape')
        await pg.tap('nav [data-nav="practice"]'); await pg.tap('#subnav [data-sub="phrases"]'); await pg.wait_for_timeout(300)
        await pg.tap('#tab-phrases [data-say]'); await pg.wait_for_timeout(600)
        R['phrase'] = await pg.evaluate("(() => { const a = window.__hira.audioEl(); return [a.src.split('/').pop(), Math.round(a.currentTime*10)/10, a.paused, a.error && a.error.code]; })()")
        R['final_state'] = await pg.evaluate("window.__hira.audioState()")
        # A pending correct-answer timer must not advance a replacement round.
        # Exercise End -> Same drill again before the old timer expires.
        R['listen_restart'] = await pg.evaluate("""async () => {
            const {ui} = await import('./js/core/ui-state.js');
            const {showTab} = await import('./js/core/nav.js');
            const {startDrill} = await import('./js/features/drill.js');
            ui.drillMode = 'listen'; ui.drillLen = 'all';
            ui.drillSel = new Set(['row-a', 'row-k']);
            showTab('drill');
            startDrill(['あ','い','う','え','お','か','き','く','け','こ']);
            const k = ui.session.seq[0].k;
            document.querySelector('[data-pick="' + k + '"]').click();
            document.querySelector('#qEnd').click();
            document.querySelector('#rAgain').click();
            const round = ui.session, first = round.seq[0];
            await new Promise(resolve => setTimeout(resolve, 850));
            return {sameRound: ui.session === round, index: round.i, sameQuestion: round.seq[round.i] === first};
        }""")
        assert R['listen_restart'] == {'sameRound': True, 'index': 0, 'sameQuestion': True}, R['listen_restart']
        # Verify the bytes used by both initial playback and cached replay for
        # every question, then answer through the rendered choice buttons.
        R['listen_all'] = await pg.evaluate("""async () => {
            const {ui} = await import('./js/core/ui-state.js');
            const {htmlAudio} = await import('./js/core/audio.js');
            const {AUD} = await import('./js/data/audio-manifest.js');
            const hash = async url => {
                const data = await (await fetch(url)).arrayBuffer();
                return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].join(',');
            };
            const observations = [];
            while (!ui.session.done) {
                const round = ui.session, item = round.seq[round.i], k = item.k;
                const expected = await hash('audio/' + AUD[k]);
                const initialMatches = await hash(htmlAudio.src) === expected;
                document.querySelector('#qPlay').click();
                const replayMatches = await hash(htmlAudio.src) === expected;
                document.querySelector('[data-pick="' + k + '"]').click();
                observations.push({k, initialMatches, replayMatches, correct: round.results.at(-1).ok});
                await new Promise(resolve => setTimeout(resolve, 850));
            }
            return observations;
        }""")
        assert len(R['listen_all']) == 10, R['listen_all']
        assert len({q['k'] for q in R['listen_all']}) == 10, R['listen_all']
        assert all(q['initialMatches'] and q['replayMatches'] and q['correct'] for q in R['listen_all']), R['listen_all']
        R['errors'] = errs
        assert not errs, errs
        print(json.dumps(R, ensure_ascii=False))
asyncio.run(main())
