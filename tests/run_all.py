"""Run checks with real failure status, per-suite logs, and a managed local server."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from threading import Thread

from architecture import check_architecture

ROOT = Path(__file__).resolve().parent.parent
SUITES = (
    'localetest', 'refactortest', 'swipetest', 'tallsheet', 'locktest', 'taptest',
    'phrasetap', 'phfilter', 'wordsfilter', 'goals', 'dragselect', 'barscroll',
    'animtest', 'lessontest', 'ptest', 'pftest', 'artest', 'cltest', 'gregress',
    'phtest', 'themetest', 'ovf', 'uitest2', 'audiotest', 'smalls', 'i18naudit',
    'audioaudit', 'sheetsall',
)


def check_types():
    """Type-check the app (JSDoc + tsc --noEmit); TypeScript is a development dependency only."""
    tsc = ROOT / 'node_modules' / 'typescript' / 'bin' / 'tsc'
    if not tsc.exists():
        sys.exit('TypeScript is not installed. Run: npm install')
    subprocess.run(['node', str(tsc), '-p', 'jsconfig.json'], check=True)
    print('PASS types: tsc --strict reported no errors', flush=True)


def report_errors(value, path='report'):
    errors = []
    if isinstance(value, dict):
        for key, item in value.items():
            location = path + '.' + key
            if key.endswith('errors') and item:
                errors.append(location + ': ' + repr(item))
            else:
                errors.extend(report_errors(item, location))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            errors.extend(report_errors(item, f'{path}[{index}]'))
    return errors


def run_suite(name, environment, output):
    log = output / (name + '.log')
    try:
        result = subprocess.run(
            [sys.executable, str(ROOT / 'tests' / (name + '.py'))],
            cwd=ROOT, env=environment, capture_output=True, text=True, timeout=300,
        )
    except subprocess.TimeoutExpired as error:
        log.write_text(str(error))
        return name, False, log
    log.write_text(result.stdout + result.stderr)
    errors = []
    try:
        errors = report_errors(json.loads(result.stdout))
    except json.JSONDecodeError:
        pass  # Audits with plain-text output use their own assertions.
    if errors:
        with log.open('a') as file:
            file.write('\nFAILED assertions:\n' + '\n'.join(errors) + '\n')
    return name, result.returncode == 0 and not errors, log


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('suites', nargs='*', help='Optional suite names; defaults to all')
    parser.add_argument('--jobs', type=int, default=1, help='Independent browser suites to run concurrently')
    args = parser.parse_args()
    unknown = set(args.suites) - set(SUITES)
    if unknown or args.jobs < 1:
        parser.error('Unknown suites or invalid job count: ' + ', '.join(sorted(unknown)))
    os.chdir(ROOT)
    check_architecture()
    check_types()
    subprocess.run(['node', '--test', 'tests/core.test.mjs', 'tests/i18n.test.mjs'], check=True)
    subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', '*_test.py'], check=True)
    subprocess.run(['node', 'scripts/check-locales.mjs'], check=True)
    output = Path(os.environ.get('HIRA_TEST_OUTPUT', str(Path(tempfile.gettempdir()) / 'hira-tests')))
    output.mkdir(parents=True, exist_ok=True)
    (ROOT / 'shots').mkdir(exist_ok=True)
    port = int(os.environ.get('PORT', '8767'))
    environment = {**os.environ, 'BASE_URL': f'http://127.0.0.1:{port}/'}
    failures = []
    with ThreadingHTTPServer(('127.0.0.1', port), partial(Handler, directory=str(ROOT))) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            with ThreadPoolExecutor(max_workers=args.jobs) as workers:
                tasks = [workers.submit(run_suite, name, environment, output) for name in (args.suites or SUITES)]
                for task in as_completed(tasks):
                    name, passed, log = task.result()
                    print(('PASS ' if passed else 'FAIL ') + name + ' — ' + str(log), flush=True)
                    if not passed:
                        failures.append(name)
        finally:
            server.shutdown()
    if failures:
        print('Failed suites: ' + ', '.join(failures))
        return 1
    print('All checks passed. Layout sweeps remain available in sweep.py, fit.py and budget.py.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
