import { localeIds } from '../js/i18n/core.js';
import { auditLocale } from '../js/i18n/audit.js';

const args = process.argv.slice(2);
const ids = args.filter((arg) => !arg.startsWith('--'));
const selected = ids.length ? ids : localeIds();
let invalid = false;
for (const id of selected) {
  if (!localeIds().includes(id)) {
    console.error('Unknown locale: ' + id);
    invalid = true;
    continue;
  }
  const report = auditLocale(id);
  console.log(`${id}: ${report.translated}/${report.total} interface translations`);
  if (report.missing.length) console.log('  Missing (uses English): ' + report.missing.join(', '));
  if (report.extra.length) console.log('  Unknown keys: ' + report.extra.join(', '));
  for (const invalid of report.invalidTypes)
    console.log(`  ${invalid.key}: expected ${invalid.expected}`);
  for (const mismatch of report.mismatched) {
    console.log(
      `  ${mismatch.key}: expected {${mismatch.expected.join('}, {')}}, found {${mismatch.actual.join('}, {')}}`,
    );
  }
  if (
    report.extra.length ||
    report.mismatched.length ||
    report.invalidTypes.length ||
    (args.includes('--strict') && report.missing.length)
  )
    invalid = true;
}
if (invalid) process.exitCode = 1;
