#!/usr/bin/env bash
# Usage: version-assets.sh SITE_DIR VERSION
# Adds ?v=VERSION to every relative script import, and to the script and stylesheet addresses in index.html.
set -euo pipefail
site="$1"; v="$2"
# import x from './a.js'  and  import('./a.js')
find "$site/js" -name '*.js' -print0 | xargs -0 sed -i -E "s#((from|import\\()[[:space:]]*['\"]\\.{1,2}/[^'\"?]+\\.js)(['\"])#\\1?v=${v}\\3#g"
# import './a.js'
find "$site/js" -name '*.js' -print0 | xargs -0 sed -i -E "s#^(import[[:space:]]+['\"]\\.{1,2}/[^'\"?]+\\.js)(['\"])#\\1?v=${v}\\2#"
# index.html: drop the old hand-written version tag, then tag every local script and stylesheet
sed -i -E "s#\\?v=[A-Za-z0-9._-]+\"#\"#g" "$site/index.html"
sed -i -E "s#((href|src)=\"(css|js)/[^\"?]+\\.(css|js))\"#\\1?v=${v}\"#g" "$site/index.html"
echo "versioned $(grep -rl "?v=${v}" "$site" | wc -l) files with ?v=${v}"
