import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { appsScriptFixture } from './apps-script-fixture.mjs';

const execFileAsync = promisify(execFile);

// The deployed site gets its sync address from a secret, so the repo's cloud-config.js is empty.
// The client tests run against a copy of the app that has a test address.
const copy = mkdtempSync(join(tmpdir(), 'hiragana-'));
cpSync(new URL('../js', import.meta.url), join(copy, 'js'), { recursive: true });
writeFileSync(join(copy, 'package.json'), '{"type":"module"}');
writeFileSync(join(copy, 'js/core/cloud-config.js'), "export const SYNC_URL = 'https://script.google.test/macros/s/TEST/exec';\n");
const load = (path) => import(pathToFileURL(join(copy, 'js', path)).href);

const payload = (id = 'learner', secret = 'a-secure-test-credential') => ({
  id, secret, student: { id, name: 'Learner', av: { t: 'photo', img: 'private-photo' } }, progress: { v: 1, stats: {} },
});

test('Apps Script supports authenticated CRUD, legacy upsert and teacher export without credentials', () => {
  const api = appsScriptFixture();
  const record = payload();
  assert.equal(api.post({ ...record, action: 'update' }).error, 'not found');
  const created = api.post({ ...record, action: 'create' });
  assert.equal(created.ok, true);
  assert.equal(api.post({ ...record, action: 'create' }).error, 'exists');
  const read = api.post({ id: record.id, secret: record.secret, action: 'read' });
  assert.equal(read.student.av.img, '');
  assert.equal('hash' in read, false);
  assert.equal('secret' in read, false);
  for (const action of ['create', 'read', 'update', 'save', 'delete', 'password']) {
    const bad = { ...record, secret: 'another-device-password', action, newSecret: 'b'.repeat(64) };
    assert.equal(api.post(bad).error, 'not yours', action);
  }
  const updated = api.post({ ...record, action: 'update', base: created.savedAt, progress: { stats: { あ: { c: 2 } } } });
  assert.equal(updated.ok, true);
  assert.equal(api.post({ ...record, base: created.savedAt }).error, 'conflict');
  assert.equal(api.post({ ...record, base: updated.savedAt }).ok, true);
  assert.equal(api.get('wrong').error, 'denied');
  assert.equal(api.get('teacher-test-key').error, 'denied');
  assert.equal(api.post({ action: 'export', teacherKey: 'wrong' }).error, 'denied');
  const exported = api.post({ action: 'export', teacherKey: 'teacher-test-key' });
  assert.equal(exported.length, 1);
  assert.equal(JSON.stringify(exported).includes('hash'), false);
  assert.equal(api.post({ ...record, action: 'delete' }).ok, true);
  assert.equal(api.post({ ...record, action: 'delete' }).ok, true);
  assert.equal(api.post(record).error, 'deleted', 'late writes cannot recreate personal data');
  assert.equal(api.post({ ...record, action: 'read' }).error, 'deleted');
  assert.deepEqual(Object.keys(api.db().learner).sort(), ['deleted', 'hash']);
  assert.equal(api.post({ action: 'export', teacherKey: 'teacher-test-key' }).length, 0);
  assert.equal(api.locked(), false);
});

test('Apps Script rejects malformed records, reserved keys and oversized UTF-8 without writing', () => {
  const api = appsScriptFixture();
  for (const id of ['__proto__', 'constructor', 'prototype', '../bad', '', 'x'.repeat(65)]) {
    assert.equal(api.post(payload(id)).ok, false, id);
  }
  for (const bad of [null, [], { ...payload(), progress: [] }, { ...payload(), student: null },
    { ...payload(), action: 'unexpected' }, { ...payload(), secret: 'short' },
    { ...payload(), progress: { text: 'あ'.repeat(70000) } }]) {
    assert.equal(api.post(bad).ok, false);
  }
  assert.equal(api.writes(), 0);
  api.corrupt();
  assert.equal(api.post(payload()).error, 'storage');
  assert.equal(api.locked(), false);
});

test('password enrollment rotates legacy credentials and supports safe retries after lost replies', () => {
  const api = appsScriptFixture();
  const record = payload();
  api.post(record);
  const next = 'c'.repeat(64);
  assert.equal(api.post({ ...record, action: 'password', newSecret: next }).ok, true);
  assert.equal(api.post({ ...record, action: 'read' }).error, 'not yours');
  assert.equal(api.post({ ...record, action: 'password', newSecret: next }).ok, true);
  assert.equal(api.post({ ...record, action: 'read', secret: next }).ok, true);
  assert.equal(api.post({ ...record, action: 'password', newSecret: 'd'.repeat(64) }).error, 'not yours');
});

// The client queue runs against the real server implementation with only Google services mocked.
globalThis.window = new EventTarget();
window.matchMedia = () => ({ matches: false });
globalThis.document = new EventTarget();
const values = new Map();
globalThis.localStorage = {
  getItem: (key) => values.get(key) ?? null,
  setItem: (key, value) => values.set(key, value),
  removeItem: (key) => values.delete(key),
};
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const store = await load('core/store.js');
const cloud = await load('core/cloud.js');
const passwords = await load('core/passwords.js');
const api = appsScriptFixture();
let intercept;
const requests = [];
globalThis.fetch = async (_url, options) => {
  const data = JSON.parse(options.body);
  requests.push(data);
  if (intercept) return intercept(data);
  return new Response(JSON.stringify(api.post(data)), { headers: { 'Content-Type': 'application/json' } });
};

// Serial: these cases intentionally share one running app and outbox.
test('client passwords, cross-device login, queue isolation, restore, retry and deletion', async () => {
  await passwords.setPassword('first', 'my-long-test-password');
  assert.equal(await passwords.verifyPassword('first', 'wrong-password'), false);
  assert.equal(await passwords.verifyPassword('first', 'my-long-test-password'), true);
  assert.notEqual(await passwords.passwordSecret('first', 'my-long-test-password'),
    await passwords.passwordSecret('second', 'my-long-test-password'), 'salt differs per student');
  cloud.startCloudSync();
  store.addStudent({ id: 'first', name: 'First', av: { t: 'photo', img: 'private-photo' } }, { stats: { あ: { c: 3 } } });
  store.addStudent({ id: 'second', name: 'Second' }, { stats: { い: { c: 7 } } });
  await cloud.flushCloud();
  assert.equal(api.db().first.progress.stats.あ.c, 3);
  assert.equal(api.db().second.progress.stats.い.c, 7);
  assert.equal(api.db().first.student.av.img, '');
  assert.equal(cloud.cloudStatus('first').state, 'saved');
  assert.equal(JSON.stringify([...values.values()]).includes('my-long-test-password'), false);
  const remote = await cloud.signInCloud('first', 'my-long-test-password');
  assert.equal(remote.student.name, 'First');
  await assert.rejects(cloud.signInCloud('first', 'wrong-password'), /not yours/);

  store.selectStudent('first');
  store.updateProgress((state) => { state.stats.あ.c = 20; });
  await cloud.restoreCloud('first');
  assert.equal(store.state.stats.あ.c, 3, 'restore replaces pending local changes');
  assert.equal(store.me().av.img, 'private-photo', 'restore retains the local photo');

  intercept = async () => new Response('<html>Script function not found</html>');
  store.updateStudent('first', { name: 'Offline edit' });
  await cloud.flushCloud();
  assert.equal(cloud.cloudStatus('first').error, 'deployment');
  assert.equal(JSON.parse(values.get('hiragana14-sync-queue-v1')).length, 1);
  intercept = undefined;
  await cloud.flushCloud();
  assert.equal(api.db().first.student.name, 'Offline edit');

  let release;
  intercept = (data) => new Promise((resolve) => { release = () => resolve(new Response(JSON.stringify(api.post(data)))); });
  store.updateStudent('first', { name: 'Earlier edit' });
  const writing = cloud.flushCloud();
  store.updateStudent('first', { name: 'Latest edit' });
  release();
  await writing;
  assert.equal(cloud.cloudStatus('first').state, 'pending');
  intercept = undefined;
  await cloud.flushCloud();
  assert.equal(api.db().first.student.name, 'Latest edit');

  // An older device is rejected even with the correct password.
  api.post({ ...payload('first', requests.at(-1).secret), student: { id: 'first', name: 'Other device' } });
  store.updateStudent('first', { name: 'Stale edit' });
  await cloud.flushCloud();
  assert.equal(cloud.cloudStatus('first').error, 'conflict');
  assert.equal(api.db().first.student.name, 'Other device');
  await cloud.restoreCloud('first');

  navigator.onLine = false;
  store.removeStudent('first');
  await cloud.flushCloud();
  assert.equal(cloud.pendingCloudDeletes(), 1);
  assert.equal(JSON.parse(values.get('hiragana14-sync-queue-v1'))[0].action, 'delete');
  navigator.onLine = true;
  await cloud.flushCloud();
  assert.equal(cloud.pendingCloudDeletes(), 0);
  assert.deepEqual(Object.keys(api.db().first).sort(), ['deleted', 'hash']);
  assert.ok(requests.every((data) => !JSON.stringify(data).includes('my-long-test-password')));
});

test('A teacher reset code lets a student set a new password, once, and only before it expires or is guessed', () => {
  const api = appsScriptFixture();
  const record = payload('forgot', 'a'.repeat(64));
  assert.equal(api.post({ ...record, action: 'create' }).ok, true);
  const fresh = 'b'.repeat(64);
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'recover', code: '123456789a' }).error, 'bad code', 'no reset requested');
  const code = api.reset('forgot');
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'recover', code: 'wrong-code-1' }).error, 'bad code');
  assert.equal(api.post({ id: 'forgot', secret: 'z'.repeat(20), action: 'recover', code }).error, 'bad code', 'credential must be a derived secret');
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'read' }).error, 'not yours', 'a reset alone grants nothing');
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'recover', code }).ok, true);
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'read' }).ok, true, 'new password works');
  assert.equal(api.post({ id: 'forgot', secret: record.secret, action: 'read' }).error, 'not yours', 'old password is gone');
  assert.equal(api.post({ id: 'forgot', secret: 'c'.repeat(64), action: 'recover', code }).error, 'bad code', 'code is single-use');
  assert.equal(api.post({ id: 'forgot', secret: fresh, action: 'read' }).student.name, 'Learner', 'progress is kept');
  const guessed = api.reset('forgot');
  for (let i = 0; i < 5; i++) api.post({ id: 'forgot', secret: 'd'.repeat(64), action: 'recover', code: 'guess-' + i + '-xx' });
  assert.equal(api.post({ id: 'forgot', secret: 'd'.repeat(64), action: 'recover', code: guessed }).error, 'bad code', 'five wrong guesses cancel the reset');
  assert.equal(JSON.stringify(api.post({ action: 'export', teacherKey: 'teacher-test-key' })).includes('reset'), false, 'export hides reset data');
});

test('Apps Script locks an id after repeated wrong passwords and keeps the right one working afterwards', () => {
  const api = appsScriptFixture();
  const record = payload('target', 'f'.repeat(64));
  assert.equal(api.post({ ...record, action: 'create' }).ok, true);
  const wrong = { id: 'target', secret: '0'.repeat(64), action: 'read' };
  for (let i = 0; i < 9; i++) assert.equal(api.post(wrong).error, 'not yours');
  assert.equal(api.post({ id: 'target', secret: record.secret, action: 'read' }).ok, true, 'a success resets the count');
  for (let i = 0; i < 9; i++) assert.equal(api.post(wrong).error, 'not yours');
  assert.equal(api.post(wrong).error, 'locked', 'the tenth miss locks the id');
  assert.equal(api.post({ id: 'target', secret: record.secret, action: 'read' }).error, 'locked', 'even the right password waits');
  assert.equal(api.post({ ...payload('someone-else', 'e'.repeat(64)), action: 'create' }).ok, true, 'other ids are unaffected');
  const code = api.reset('target');
  const recovered = '1'.repeat(64);
  assert.equal(api.post({ id: 'target', secret: recovered, action: 'recover', code }).ok, true);
  assert.equal(api.post({ id: 'target', secret: recovered, action: 'read' }).ok, true, 'a teacher reset unlocks the id');
});

test('Apps Script caps new students per hour and refuses to grow past its limits', () => {
  const api = appsScriptFixture();
  let accepted = 0;
  let busy = 0;
  for (let i = 0; i < 70; i++) {
    const result = api.post({ ...payload('kid' + i, 'a'.repeat(64)), action: 'create' });
    if (result.ok) accepted++;
    else if (result.error === 'busy') busy++;
  }
  assert.equal(accepted, 60);
  assert.equal(busy, 10);
  assert.equal(api.post({ ...payload('kid0', 'a'.repeat(64)), action: 'update' }).ok, true, 'existing students keep saving');
});

test('Per-student and global rate limiting in CacheService reject floods before lock acquisition', () => {
  const api = appsScriptFixture();
  const record = payload('rate-limit-target', 'b'.repeat(64));
  assert.equal(api.post({ ...record, action: 'create' }).ok, true);

  // Send requests up to the MAX_CLIENT_PER_MINUTE (30)
  for (let i = 0; i < 29; i++) {
    const res = api.post({ id: 'rate-limit-target', secret: record.secret, action: 'read' });
    assert.equal(res.ok, true, 'request ' + i + ' should succeed');
  }

  // 31st request for this student ID is rate limited
  const writesBeforeRateLimit = api.writes();
  const floodAttempt = api.post({ id: 'rate-limit-target', secret: record.secret, action: 'read' });
  assert.equal(floodAttempt.ok, false);
  assert.equal(floodAttempt.error, 'rate limited');
  assert.equal(api.writes(), writesBeforeRateLimit, 'rate limited request must not write to storage');
  assert.equal(api.locked(), false, 'rate limited request must not hold the lock');

  // Other student IDs can still proceed under their own limits
  const otherRecord = payload('other-student', 'c'.repeat(64));
  assert.equal(api.post({ ...otherRecord, action: 'create' }).ok, true);
});

test('Automated versioned backups create timestamped copies and restore safely', () => {
  const api = appsScriptFixture();
  const s1 = payload('student-one', '1'.repeat(64));
  assert.equal(api.post({ ...s1, action: 'create' }).ok, true);

  // Create an automated backup
  const backup1 = api.createBackup();
  assert.equal(backup1.ok, true);
  assert.ok(backup1.name.startsWith('students-backup-'));
  assert.ok(backup1.id.startsWith('file-'));

  // Backup via authenticated POST action
  const postBackup = api.post({ action: 'backup', teacherKey: 'teacher-test-key' });
  assert.equal(postBackup.ok, true);
  assert.ok(postBackup.name.startsWith('students-backup-'));

  // Unauthenticated backup POST is denied
  assert.equal(api.post({ action: 'backup', teacherKey: 'wrong-key' }).error, 'denied');

  // Make changes to DB after backup
  const s2 = payload('student-two', '2'.repeat(64));
  assert.equal(api.post({ ...s2, action: 'create' }).ok, true);
  assert.ok(api.db()['student-two']);

  // Restore from the first backup
  const restoreRes = api.restoreBackup(backup1.id);
  assert.equal(restoreRes.ok, true);
  assert.equal(restoreRes.restoredFrom, backup1.name);

  // student-one is restored, student-two is gone
  assert.ok(api.db()['student-one']);
  assert.equal(api.db()['student-two'], undefined);
});

test('Teacher stats endpoint tracks database size, student counts, and traffic metrics', () => {
  const api = appsScriptFixture();
  assert.equal(api.post({ ...payload('stats-student', 's'.repeat(64)), action: 'create' }).ok, true);

  // Unauthenticated stats call is denied
  assert.equal(api.post({ action: 'stats', teacherKey: 'bad' }).error, 'denied');

  // Authenticated stats call returns monitoring data
  const stats = api.post({ action: 'stats', teacherKey: 'teacher-test-key' });
  assert.equal(stats.ok, true);
  assert.equal(stats.activeStudents, 1);
  assert.equal(stats.deletedStudents, 0);
  assert.ok(typeof stats.databaseBytes === 'number');
  assert.equal(stats.maxStudents, 500);
  assert.ok(typeof stats.metrics === 'object');
  assert.ok(stats.metrics.writes >= 1);
});

test('Teacher export CLI tool exports students, checks stats, and triggers backups', async () => {
  const api = appsScriptFixture();
  api.post({ ...payload('cli-student', 'c'.repeat(64)), action: 'create' });

  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Connection', 'close');
    res.end(JSON.stringify(api.post(JSON.parse(body))));
  });
  server.unref();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const url = 'http://127.0.0.1:' + port;

  try {
    // 1. Stats query
    const { stdout: statsOutput } = await execFileAsync(process.execPath, ['scripts/export-students.mjs', url, '--key', 'teacher-test-key', '--stats']);
    const statsData = JSON.parse(statsOutput);
    assert.equal(statsData.ok, true);
    assert.equal(statsData.activeStudents, 1);

    // 2. Export to file
    const exportFile = join(copy, 'exported-students.json');
    await execFileAsync(process.execPath, ['scripts/export-students.mjs', url, '--key', 'teacher-test-key', '--out', exportFile]);
    const exportedRecords = JSON.parse(readFileSync(exportFile, 'utf8'));
    assert.equal(exportedRecords.length, 1);
    assert.equal(exportedRecords[0].student.id, 'cli-student');
    assert.equal('hash' in exportedRecords[0], false);

    // 3. Trigger backup
    const { stdout: backupOutput } = await execFileAsync(process.execPath, ['scripts/export-students.mjs', url, '--key', 'teacher-test-key', '--backup']);
    const backupData = JSON.parse(backupOutput);
    assert.equal(backupData.ok, true);

    // 4. Invalid key fails with non-zero exit code
    await assert.rejects(async () => {
      await execFileAsync(process.execPath, ['scripts/export-students.mjs', url, '--key', 'wrong-key']);
    });
  } finally {
    server.closeAllConnections?.();
    server.close();
  }
});
