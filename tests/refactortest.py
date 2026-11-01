"""Screen rendering must not award progress or save a quiz round."""
import asyncio
import json
import os

from playwright.async_api import async_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:8767/')
BROWSER = os.environ.get('BROWSER', 'chromium')


async def main():
    async with async_playwright() as playwright:
        browser = await getattr(playwright, BROWSER).launch()
        page = await browser.new_page(viewport={'width': 390, 'height': 844})
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        await page.emulate_media(reduced_motion='reduce')
        await page.goto(BASE + '#test')
        await page.fill('#nsName', 'Learner')
        await page.click('#newStudent button[type=submit]')
        result = await page.evaluate('''async () => {
          const {state, restoreProgress} = await import('./js/core/store.js');
          const {ui} = await import('./js/core/ui-state.js');
          const {renderPlan} = await import('./js/features/plan.js');
          const {renderMeet} = await import('./js/features/lesson.js');
          const {renderDrill} = await import('./js/features/drill.js');
          const {focusKana} = await import('./js/core/plan.js');
          const {renderAll} = await import('./js/core/render-all.js');
          const store = await import('./js/core/store.js');
          const kana = focusKana(1);
          restoreProgress({...state, les: {1: {m: kana, w: kana, dd: true, q: 100}}});
          const snapshot = () => JSON.stringify(store.state);
          const before = snapshot();
          renderPlan(); renderMeet();
          ui.session = {done: true, results: [{k: 'あ', ok: true, ms: 1000}], misses: [], pool: ['あ'], mode: 'read'};
          ui.lessonQuiz = true;
          renderDrill(); renderDrill(); renderAll();
          await new Promise(resolve => setTimeout(resolve, 400));
          return {unchanged: before === snapshot(), rounds: store.state.rounds.length, done: Object.keys(store.state.done).length};
        }''')
        assert result == {'unchanged': True, 'rounds': 0, 'done': 0}, result
        assert not errors, errors
        print(json.dumps({'browser': BROWSER, **result, 'errors': errors}))
        await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
