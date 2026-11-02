import assert from 'node:assert/strict';
import { test } from 'node:test';
import { appsScriptFixture } from './apps-script-fixture.mjs';

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
  assert.equal(api.get('teacher-test-key').length, 1);
  assert.equal(JSON.stringify(api.get('teacher-test-key')).includes('hash'), false);
  assert.equal(api.post({ ...record, action: 'delete' }).ok, true);
  assert.equal(api.post({ ...record, action: 'delete' }).ok, true);
  assert.equal(api.post(record).error, 'deleted', 'late writes cannot recreate personal data');
  assert.equal(api.post({ ...record, action: 'read' }).error, 'deleted');
  assert.deepEqual(Object.keys(api.db().learner).sort(), ['deleted', 'hash']);
  assert.equal(api.get('teacher-test-key').length, 0);
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
const store = await import('../js/core/store.js');
const cloud = await import('../js/core/cloud.js');
const passwords = await import('../js/core/passwords.js');
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
  assert.equal(JSON.stringify(api.get('teacher-test-key')).includes('reset'), false, 'export hides reset data');
});
