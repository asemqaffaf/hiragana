#!/usr/bin/env node
/**
 * Teacher tool to export student records, query server stats, or trigger backups.
 * Keeps credentials out of URLs by using authenticated HTTPS POST requests.
 *
 * Usage:
 *   node scripts/export-students.mjs <SYNC_URL> [options]
 *
 * Options:
 *   --key, -k <key>          Teacher secret key (or set TEACHER_KEY environment variable)
 *   --out, -o <file>         Write JSON output to a file instead of stdout
 *   --stats, -s              Retrieve database stats and monitoring metrics instead of student records
 *   --backup, -b             Trigger an immediate versioned backup in Google Drive
 *   --help, -h               Show this help message
 */

import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function printHelp() {
  console.log(`
Teacher Tool: Export student records, check stats, or trigger backups.

Usage:
  node scripts/export-students.mjs <SYNC_URL> [options]

Options:
  --key, -k <key>          Teacher secret key (or set TEACHER_KEY environment variable)
  --out, -o <file>         Write JSON output to a file instead of stdout
  --stats, -s              Retrieve database stats and monitoring metrics instead of student records
  --backup, -b             Trigger an immediate versioned backup in Google Drive
  --help, -h               Show this help message

Examples:
  # Export all active students to a local file
  node scripts/export-students.mjs https://script.google.com/macros/s/TEST/exec --out students.json

  # View database and traffic statistics
  node scripts/export-students.mjs https://script.google.com/macros/s/TEST/exec --stats

  # Trigger a versioned backup in Google Drive
  node scripts/export-students.mjs https://script.google.com/macros/s/TEST/exec --backup
`.trim());
}

async function prompt(question) {
  const rl = createInterface({ input, output });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(args.length === 0 ? 1 : 0);
  }

  const syncUrl = args[0];
  if (!syncUrl.startsWith('https://') && !syncUrl.startsWith('http://127.0.0.1')) {
    console.error('Error: <SYNC_URL> must be a valid HTTP(S) address.');
    process.exit(1);
  }

  let teacherKey = process.env.TEACHER_KEY || '';
  let outFile = '';
  let action = 'export';

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--key' || arg === '-k') {
      teacherKey = args[++i];
    } else if (arg === '--out' || arg === '-o') {
      outFile = args[++i];
    } else if (arg === '--stats' || arg === '-s') {
      action = 'stats';
    } else if (arg === '--backup' || arg === '-b') {
      action = 'backup';
    }
  }

  if (!teacherKey) {
    if (process.stdin.isTTY) {
      teacherKey = await prompt('Enter TEACHER_KEY: ');
    }
    if (!teacherKey) {
      console.error('Error: TEACHER_KEY is required. Pass --key <key> or set TEACHER_KEY env var.');
      process.exit(1);
    }
  }

  const payload = {
    action,
    teacherKey,
  };

  try {
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`HTTP error: ${response.status} ${response.statusText}`);
      process.exit(1);
    }

    const data = await response.json();
    if (data && typeof data === 'object' && data.ok === false) {
      console.error(`Request rejected: ${data.error || 'unknown error'}`);
      process.exit(1);
    }

    const formatted = JSON.stringify(data, null, 2);
    if (outFile) {
      writeFileSync(outFile, formatted + '\n', 'utf8');
      console.log(`Saved ${action} result to ${outFile}`);
    } else {
      console.log(formatted);
    }
  } catch (err) {
    console.error(`Request failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

main();
