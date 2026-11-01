import unittest

from run_all import report_errors


class SuiteReportTests(unittest.TestCase):
    def test_nested_browser_errors_fail_even_when_script_exits_successfully(self):
        errors = report_errors({'en': {'errors': []}, 'ar': {'errors': ['ReferenceError']}})
        self.assertEqual(len(errors), 1)
        self.assertIn('report.ar.errors', errors[0])

    def test_empty_error_arrays_and_measurements_pass(self):
        self.assertEqual(report_errors({'errors': [], 'percent': 90}), [])
