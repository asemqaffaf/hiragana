import { SYNC_URL } from './cloud-config.js';
import {
  readCloudVersion, readPendingPassword, readSyncQueue, readSyncSecret,
  writeCloudVersion, writePendingPassword, writeSyncQueue, writeSyncSecret,
} from './storage.js';
import { passwordSecret, rememberPassword } from './passwords.js';
import {
  cleanStudent, isGuest, loadProgress, me, normalize, restoreStudent, state, students, subscribeProgress, subscribeStudents,
} from './store.js';
import { canon, mergeProgress } from './merge.js';
import { isObject } from '../util.js';

/** @typedef {{id: string, action: 'save' | 'delete', student?: import('../../types/app').Student, progress?: import('../../types/app').Progress, newSecret?: string, code?: string}} Job */
/** @typedef {'local' | 'pending' | 'saving' | 'saved' | 'offline' | 'error' | 'restoring' | 'restored'} SyncState */
/** @typedef {{state: SyncState, error?: string}} SyncStatus */
export const syncOn = SYNC_URL.startsWith('https://');
const validId = (/** @type {string} */ id) => /^[A-Za-z0-9_-]{1,64}$/.test(id) && !isGuest(id) &&
  !['__proto__', 'constructor', 'prototype'].includes(id);

const MAX_CONFLICTS = 3;
/** @type {Map<string, Job>} */
const pending = new Map();
/** @type {Map<string, SyncStatus>} */
const statuses = new Map();
/** @type {Set<() => void>} */
const listeners = new Set();
/** @type {Set<(id: string) => void>} */
const appliedListeners = new Set();
/** Students whose saved password this device was refused: polling again would lock them out. @type {Set<string>} */
const refused = new Set();
/** @type {Map<string, number>} */
const conflicts = new Map();
/** @type {ReturnType<typeof setTimeout> | undefined} */
let timer;
/** @type {Promise<void> | undefined} */
let running;
let started = false;

const savedQueue = readSyncQueue();
if (Array.isArray(savedQueue)) {
  for (const job of savedQueue) {
    if (!isObject(job) || typeof job.id !== 'string' || !validId(job.id)) continue;
    if (job.action === 'delete' || (job.action === 'save' && isObject(job.student) &&
        job.student.id === job.id && typeof job.student.name === 'string' && isObject(job.progress) &&
        students.list.some((p) => p.id === job.id))) {
      pending.set(job.id, /** @type {Job} */ (job));
      statuses.set(job.id, { state: 'pending' });
    }
  }
}

/** @param {string} id */
export const cloudStatus = (id) => statuses.get(id) || { state: /** @type {SyncState} */ (syncOn ? 'pending' : 'local') };
export const pendingCloudDeletes = () => Array.from(pending.values()).filter((job) => job.action === 'delete').length;
/** @param {() => void} listener */
export function subscribeCloud(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
/** Called after newer data from another device has replaced or been merged into this student. @param {(id: string) => void} listener */
export function subscribeCloudApplied(listener) {
  appliedListeners.add(listener);
  return () => appliedListeners.delete(listener);
}
/** @param {string} id @param {SyncState} state @param {string} [error] */
function status(id, state, error) {
  statuses.set(id, { state, error });
  listeners.forEach((listener) => listener());
}
function persist() {
  writeSyncQueue(Array.from(pending.values()));
}
/** The first save claims the id; this secret is never placed in a URL. @param {string} id */
function secretFor(id) {
  const saved = readSyncSecret(id);
  if (typeof saved === 'string' && saved.length >= 16 && saved.length <= 256) return saved;
  const secret = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  if (!writeSyncSecret(id, secret)) throw new Error('local storage');
  return secret;
}

/** Plain-text POST avoids preflight. A readable JSON success is required before clearing the queue.
 * @param {string} action @param {string} id @param {Partial<Job>} [data] @param {string} [credential]
 * @returns {Promise<Record<string, unknown>>}
 */
export async function requestCloud(action, id, data = {}, credential) {
  const body = JSON.stringify({ ...data, action, id, secret: credential || secretFor(id),
    ...(['save', 'update'].includes(action) ? { base: readCloudVersion(id) } : {}),
  });
  const bytes = new TextEncoder().encode(body).length;
  if (bytes > 200000) throw new Error('too large');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(SYNC_URL, {
      method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body,
      signal: controller.signal, keepalive: bytes < 60000,
    });
    if (!response.ok) throw new Error('network');
    let result;
    try { result = await response.json(); }
    catch { throw new Error('deployment'); }
    if (!isObject(result) || Array.isArray(result) || typeof result.ok !== 'boolean') throw new Error('deployment');
    if (!result.ok) throw new Error(typeof result.error === 'string' ? result.error : 'invalid');
    return result;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('network');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** @param {number} [delay] */
function schedule(delay = 1000) {
  if (!started || timer || !pending.size) return;
  timer = setTimeout(() => {
    timer = undefined;
    void flushCloud();
  }, delay);
}

/** Capture the right student's data now, before a switch can change the current student. @param {string} id */
export function queueCloudSave(id) {
  if (!syncOn || !validId(id) || pending.get(id)?.action === 'delete') return;
  const student = students.list.find((p) => p.id === id);
  if (!student) return;
  const progress = students.current === id ? state : normalize(loadProgress(id));
  const job = JSON.parse(JSON.stringify({
    action: 'save', id, student: { ...student, av: { ...student.av, img: '' } }, progress,
    newSecret: readPendingPassword(id) || undefined,
  }));
  pending.set(id, job);
  persist();
  status(id, 'pending');
  schedule();
}

/** Deletion supersedes unsent saves and survives closing the app while offline. @param {string} id */
function queueDelete(id) {
  if (!syncOn || !validId(id)) return;
  pending.set(id, { action: 'delete', id });
  persist();
  status(id, 'pending');
  schedule(0);
}

/** All writes run in order; a response for an older snapshot cannot clear a newer change. */
export function flushCloud() {
  if (running) return running.catch(() => {});
  if (!syncOn) return Promise.resolve();
  if (timer) clearTimeout(timer);
  timer = undefined;
  running = (async () => {
    let retry = false;
    for (const [id, job] of Array.from(pending)) {
      if (pending.get(id) !== job) continue;
      if (navigator.onLine === false) {
        status(id, 'offline');
        continue;
      }
      status(id, 'saving');
      try {
        const result = await requestCloud(job.newSecret ? 'password' : job.action, id, job);
        if (job.action === 'save') {
          if (typeof result.savedAt !== 'string') throw new Error('deployment');
          writeCloudVersion(id, result.savedAt);
          conflicts.delete(id);
          if (job.newSecret) {
            writeSyncSecret(id, job.newSecret);
            writePendingPassword(id, null);
          }
        }
        if (pending.get(id) === job) {
          pending.delete(id);
          persist();
          status(id, 'saved');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'network';
        // A failed old request must not hide a newer save or deletion.
        if (pending.get(id) !== job) continue;
        if (message === 'conflict' && job.action === 'save' && (conflicts.get(id) || 0) < MAX_CONFLICTS) {
          // Another device saved first: fold its progress into this one and send the combined record.
          conflicts.set(id, (conflicts.get(id) || 0) + 1);
          try {
            await pullInto(id);
            retry = true;
            continue;
          } catch (pullError) {
            status(id, 'error', pullError instanceof Error ? pullError.message : 'network');
            continue;
          }
        }
        status(id, 'error', message);
        if (message === 'network' || message === 'storage' || message === 'busy' || message === 'rate limited') retry = true;
      }
    }
    return retry;
  })().then((retry) => {
    if (retry) schedule(15000);
    else if (Array.from(pending.keys()).some((id) => cloudStatus(id).state === 'pending')) schedule();
  }).finally(() => { running = undefined; });
  return running;
}

/** @param {string} id */
export async function saveCloudNow(id) {
  queueCloudSave(id);
  // An in-flight older snapshot may be finishing; flush the remaining snapshot too.
  await flushCloud();
  if (pending.has(id)) await flushCloud();
}

/** Explicitly replace local data with a cloud copy, unless it changed during the request. @param {string} id */
export async function restoreCloud(id) {
  while (running) await running;
  if (timer) clearTimeout(timer);
  timer = undefined;
  const task = (async () => {
    const job = pending.get(id);
    const local = students.list.find((p) => p.id === id);
    if (!local || job?.action === 'delete') return;
    const baseline = JSON.stringify({ student: local, progress: loadProgress(id) });
    status(id, 'restoring');
    try {
      const result = await requestCloud('read', id);
      const student = result.student;
      if (!isObject(student) || student.id !== id || typeof student.name !== 'string' ||
          !student.name.trim() || !isObject(result.progress) || Array.isArray(result.progress)) throw new Error('invalid');
      const current = students.list.find((p) => p.id === id);
      if (pending.get(id) !== job || JSON.stringify({ student: current, progress: loadProgress(id) }) !== baseline)
        throw new Error('changed');
      restoreStudent({ ...student, id, name: student.name }, result.progress);
      if (typeof result.savedAt === 'string') writeCloudVersion(id, result.savedAt);
      pending.delete(id);
      persist();
      status(id, 'restored');
    } catch (error) {
      status(id, 'error', error instanceof Error ? error.message : 'network');
      throw error;
    }
  })();
  running = task.finally(() => {
    running = undefined;
    schedule();
  });
  return running;
}

/** Reads the cloud copy and combines it with this device's data. Callers hold the request lock.
 * Progress is merged, so neither device loses work. The profile comes from the cloud unless this device has unsent edits.
 * @param {string} id
 */
async function pullInto(id) {
  const first = students.list.find((p) => p.id === id);
  if (!first || pending.get(id)?.action === 'delete') return;
  let result;
  try { result = await requestCloud('read', id); }
  catch (error) {
    const message = error instanceof Error ? error.message : 'network';
    if (message === 'not yours' || message === 'locked') refused.add(id);
    // Nothing is saved in the cloud yet: the next save creates it.
    if (message === 'not found') return;
    throw error;
  }
  const remote = result.student;
  if (!isObject(remote) || remote.id !== id || typeof remote.name !== 'string' || !remote.name.trim() ||
      !isObject(result.progress) || Array.isArray(result.progress) || typeof result.savedAt !== 'string') throw new Error('invalid');
  // Read local data only now: the learner may have studied while the request was in flight.
  const local = students.list.find((p) => p.id === id);
  const job = pending.get(id);
  if (!local || job?.action === 'delete') return;
  const localProgress = students.current === id ? state : normalize(loadProgress(id));
  const remoteProgress = normalize(result.progress);
  const merged = mergeProgress(localProgress, remoteProgress);
  const profile = job ? local : cleanStudent({ ...remote, id, name: remote.name });
  const shape = (/** @type {import('../../types/app').Student} */ student) => canon({ ...student, last: 0, av: { ...student.av, img: '' } });
  // The saved-at stamp alone is not a difference worth redrawing or re-sending.
  const content = (/** @type {import('../../types/app').Progress} */ progress) => canon({ ...progress, updated: 0 });
  const changed = content(merged) !== content(localProgress) || shape(profile) !== shape(local);
  if (changed) restoreStudent(profile, merged);
  writeCloudVersion(id, result.savedAt);
  // If this device holds anything the cloud lacks, send the combined record on the new version.
  if (job || content(merged) !== content(remoteProgress)) queueCloudSave(id);
  else status(id, 'saved');
  if (changed) appliedListeners.forEach((listener) => listener(id));
}

/** Fetch what other devices saved and fold it into this one. @param {string} [id] */
export async function pullCloud(id = me()?.id) {
  if (!syncOn || !id || !validId(id) || !started || refused.has(id)) return;
  while (running) await running.catch(() => {});
  conflicts.delete(id);
  const task = (async () => {
    try { await pullInto(id); }
    catch (error) { status(id, 'error', error instanceof Error ? error.message : 'network'); }
  })();
  running = task.finally(() => {
    running = undefined;
    schedule();
  });
  return running;
}

/** The Sync button: send this device's changes, then bring in what other devices saved. @param {string} id */
export async function syncNow(id) {
  refused.delete(id);
  await saveCloudNow(id);
  await pullCloud(id);
  if (pending.has(id)) await flushCloud();
}

/** Sign in from a new device without saving an unverified credential. @param {string} id @param {string} password */
export async function signInCloud(id, password) {
  if (!syncOn || !validId(id)) throw new Error('credentials');
  if (pending.has(id)) throw new Error('pending');
  const secret = await passwordSecret(id, password);
  const result = await requestCloud('read', id, {}, secret);
  const student = result.student;
  if (!isObject(student) || student.id !== id || typeof student.name !== 'string' ||
      !student.name.trim() || !isObject(result.progress) || Array.isArray(result.progress) ||
      typeof result.savedAt !== 'string') throw new Error('invalid');
  await rememberPassword(id, secret);
  writeCloudVersion(id, result.savedAt);
  return { student: { ...student, id, name: student.name }, progress: result.progress };
}

/** Set a new password with a one-time code from the teacher. Sign in afterwards to load the data.
 * @param {string} id @param {string} code @param {string} password
 */
export async function recoverCloud(id, code, password) {
  if (!syncOn || !validId(id) || pending.has(id)) throw new Error(pending.has(id) ? 'pending' : 'credentials');
  if (password.length < 10 || password.length > 256) throw new Error('length');
  await requestCloud('recover', id, { code: code.trim() }, await passwordSecret(id, password));
}

/** Subscribe once. Existing local data is queued when login selects the student. */
export function startCloudSync() {
  if (!syncOn || started) return;
  started = true;
  subscribeProgress(() => {
    const student = me();
    if (student) queueCloudSave(student.id);
  });
  subscribeStudents(({ id, action }) => {
    if (action === 'delete') queueDelete(id);
    else queueCloudSave(id);
  });
  window.addEventListener('online', () => { void flushCloud(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushCloud();
  });
  schedule();
}
