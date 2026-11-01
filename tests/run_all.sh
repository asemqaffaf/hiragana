#!/usr/bin/env bash
# PYTHON may point to a virtual environment. No GNU timeout dependency is needed on macOS.
set -euo pipefail
cd "$(dirname "$0")/.."
exec "${PYTHON:-python3}" tests/run_all.py "$@"
