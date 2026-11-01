from pathlib import Path
import tempfile
import unittest

from scripts.add_language import add_language


class LocaleScaffoldTests(unittest.TestCase):
    def test_creates_and_registers_regional_locale(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            locales = root / 'js/i18n'
            locales.mkdir(parents=True)
            manifest = locales / 'locales.js'
            manifest.write_text("import english from './en.js';\nexport const LOCALES = [english];\n")
            target = add_language(root, 'pt-BR', 'Português', 'ltr')
            self.assertIn('"pt-BR"', target.read_text())
            self.assertIn('Português', target.read_text())
            self.assertIn('locale_pt_BR', manifest.read_text())
            before = manifest.read_text()
            with self.assertRaises(ValueError):
                add_language(root, 'pt-BR', 'Português')
            self.assertEqual(manifest.read_text(), before)

    def test_rejects_invalid_codes_before_writing(self):
        for code in ['../en', 'fr.js', 'fr/ca', '']:
            with self.assertRaises(ValueError):
                add_language('/unused', code, 'Language')
