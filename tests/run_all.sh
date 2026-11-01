#!/usr/bin/env bash
# Serves the repo root on 127.0.0.1:$PORT (default 8767) and runs every browser suite in Chromium (Playwright for Python).
# Needs: python3, `pip install playwright` and `playwright install chromium`.
cd "$(dirname "$0")/.." || exit 1
PORT="${PORT:-8767}"
export BASE_URL="http://127.0.0.1:$PORT/"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1
for t in swipetest tallsheet locktest taptest phrasetap phfilter wordsfilter goals animtest lessontest ptest pftest artest cltest gregress phtest themetest ovf uitest2 audiotest smalls i18naudit audioaudit sheetsall; do
  echo "== $t"
  timeout 300 python3 "tests/$t.py" 2>&1 | tail -4 | cut -c1-200
done
echo "Slower layout sweeps (run by hand): tests/sweep.py, tests/fit.py, tests/budget.py"
