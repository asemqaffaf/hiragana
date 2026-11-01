"""Scaffold a locale and register it; requires only Python's standard library."""
import argparse
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent


def add_language(root, code, label, direction='ltr', date_locale=None):
    if not re.fullmatch(r'[a-z]{2,3}(?:-[a-z0-9]{2,8})*', code, re.IGNORECASE):
        raise ValueError('Use a language tag such as fr, es, or pt-BR')
    if not label.strip():
        raise ValueError('Provide the language name as its speakers write it')
    if direction not in ('ltr', 'rtl'):
        raise ValueError('Direction must be ltr or rtl')
    directory = Path(root) / 'js' / 'i18n'
    target = directory / (code + '.js')
    manifest = directory / 'locales.js'
    text = manifest.read_text()
    if target.exists() or re.search(r"['\"]\./" + re.escape(code) + r"\.js['\"]", text, re.IGNORECASE):
        raise ValueError('Locale already exists: ' + code)
    match = re.search(r'export const LOCALES = \[([^\]]*)\];', text)
    if not match:
        raise ValueError('Could not find the LOCALES list in js/i18n/locales.js')
    binding = 'locale_' + code.replace('-', '_')
    entries = [entry.strip() for entry in match.group(1).split(',') if entry.strip()]
    entries.append(binding)
    text = text[:match.start()] + 'export const LOCALES = [' + ', '.join(entries) + '];' + text[match.end():]
    text = 'import ' + binding + ' from ' + json.dumps('./' + code + '.js') + ';\n' + text
    quote = lambda value: json.dumps(value, ensure_ascii=False)
    source = f'''// Translate incrementally. Missing strings and learning content use English.
// See docs/languages.md and run: node scripts/check-locales.mjs {code}
export default {{
  id: {quote(code)},
  label: {quote(label.strip())},
  direction: {quote(direction)},
  dateLocale: {quote(date_locale or code)},
  strings: {{
    // 'login.create': 'Your translation',
  }},
  content: {{
    // meanings: {{'ねこ': 'Your translation'}},
    // hooks: {{'あ': 'Your memory hook'}},
  }},
}};
'''
    target.write_text(source)
    manifest.write_text(text)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('code', help='Language tag, for example fr or pt-BR')
    parser.add_argument('label', help='Native display name, for example Français')
    parser.add_argument('--direction', choices=('ltr', 'rtl'), default='ltr')
    parser.add_argument('--date-locale', help='Optional Intl date locale')
    args = parser.parse_args()
    try:
        target = add_language(ROOT, args.code, args.label, args.direction, args.date_locale)
    except ValueError as error:
        parser.error(str(error))
    print('Created and registered ' + str(target.relative_to(ROOT)))
    print('Translate that file, then run: node scripts/check-locales.mjs ' + args.code)


if __name__ == '__main__':
    main()
