/**
 * Deploy as a web app: Execute as Me, access Anyone.
 * Project Settings > Script properties:
 *   TEACHER_KEY: long random secret for admin export, stats, and backup actions.
 * After changing this file: Manage deployments > Edit > New version > Deploy.
 *
 * POST JSON (text/plain):
 * Student actions: {action, id, secret, student?, progress?}
 *   Actions: create, read, update, save (upsert, also legacy default), delete, password, recover.
 * Admin actions: {action, teacherKey}
 *   Actions: export, stats, backup.
 *
 * A forgotten password is reset by the teacher: set the Script property RESET_ID to the student id, run
 * resetStudentFromProperty in the editor, and read the one-time code in the execution log (valid 24 hours).
 * Only the secret that claimed an id can access it. Secrets never stay in URLs.
 * Admin credentials and export use POST only; GET returns denied without leaking credentials.
 */
const FILE_ID = '1NN9aPG1QkEVmsh0jkhVzsV3IOadZY6Ej';
const MAX_BYTES = 200000;
const MAX_STUDENTS = 500;        // total records kept in the file
const MAX_FILE_CHARS = 5000000;  // total size of the file
const MAX_NEW_PER_HOUR = 60;     // new student ids accepted per hour, across everyone
const MAX_FAILS = 10;            // wrong passwords before an id is locked
const LOCK_MS = 15 * 60 * 1000;  // how long a locked id refuses everything
const MAX_GLOBAL_PER_MINUTE = 120; // global rate limit across all requests
const MAX_CLIENT_PER_MINUTE = 30;  // per-student id rate limit per minute
const MAX_ADMIN_PER_MINUTE = 10;   // rate limit for admin operations
const BACKUP_FOLDER_NAME = 'Hiragana Backups';
const MAX_BACKUPS = 30;          // versioned backup copies kept in Drive

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > MAX_BYTES || Utilities.newBlob(raw).getBytes().length > MAX_BYTES)
      return reply({ ok: false, error: 'too large' });
    let rec;
    try { rec = JSON.parse(raw); } catch { return reply({ ok: false, error: 'invalid' }); }
    if (!plainObject(rec)) return reply({ ok: false, error: 'invalid' });

    // 1. Global rate limit (fast rejection via CacheService before acquiring lock or Drive)
    const minuteBucket = Math.floor(Date.now() / 60000);
    if (!checkRateLimit('rate:global:' + minuteBucket, MAX_GLOBAL_PER_MINUTE, 65)) {
      recordMetric('rate_limited');
      return reply({ ok: false, error: 'rate limited' });
    }

    const action = rec.action || 'save';
    if (['create', 'read', 'update', 'save', 'delete', 'password', 'recover', 'export', 'stats', 'backup'].indexOf(action) === -1)
      return reply({ ok: false, error: 'bad action' });

    // 2. Admin actions (export, stats, backup) via POST
    if (['export', 'stats', 'backup'].indexOf(action) !== -1) {
      const props = PropertiesService.getScriptProperties();
      const teacherKey = props.getProperty('TEACHER_KEY');
      if (!teacherKey || typeof rec.teacherKey !== 'string' || !safeEqual(rec.teacherKey, teacherKey)) {
        recordMetric('bad_auth');
        return reply({ ok: false, error: 'denied' });
      }
      if (!checkRateLimit('rate:admin:' + minuteBucket, MAX_ADMIN_PER_MINUTE, 65)) {
        recordMetric('rate_limited');
        return reply({ ok: false, error: 'busy' });
      }
      if (action === 'backup') {
        recordMetric('backup');
        return reply(createBackup());
      }
      const file = dbFile();
      const db = JSON.parse(file.getBlob().getDataAsString() || '{}');
      if (!plainObject(db)) throw new Error('Invalid database');
      if (action === 'export') {
        recordMetric('export');
        const out = Object.keys(db).filter(function (id) { return !db[id].deleted; }).map(function (id) {
          return { student: db[id].student, progress: db[id].progress, savedAt: db[id].savedAt };
        });
        return reply(out);
      }
      if (action === 'stats') {
        const bytes = file.getSize ? file.getSize() : (file.getBlob().getBytes ? file.getBlob().getBytes().length : file.getBlob().getDataAsString().length);
        return reply({
          ok: true,
          activeStudents: Object.keys(db).filter(function (k) { return !db[k].deleted; }).length,
          deletedStudents: Object.keys(db).filter(function (k) { return db[k].deleted; }).length,
          databaseBytes: bytes,
          maxStudents: MAX_STUDENTS,
          maxFileChars: MAX_FILE_CHARS,
          metrics: getMetrics(),
        });
      }
    }

    // 4. Student action validations
    const id = rec.id || (rec.student && rec.student.id);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
        ['__proto__', 'constructor', 'prototype'].indexOf(id) !== -1)
      return reply({ ok: false, error: 'bad id' });
    if (typeof rec.secret !== 'string' || rec.secret.length < 16 || rec.secret.length > 256)
      return reply({ ok: false, error: 'bad secret' });

    // 5. Per-student rate limit (fast rejection before lock)
    if (!checkRateLimit('rate:id:' + id + ':' + minuteBucket, MAX_CLIENT_PER_MINUTE, 65)) {
      recordMetric('rate_limited');
      return reply({ ok: false, error: 'rate limited' });
    }

    // 6. Fast lockout check from cache before acquiring lock
    let isLockedCached = false;
    try {
      const cache = CacheService.getScriptCache();
      isLockedCached = action !== 'recover' && !!cache.get('locked:' + id);
    } catch (_err) { /* ignore cache read error */ }
    if (isLockedCached) {
      return reply({ ok: false, error: 'locked' });
    }

    const writes = ['create', 'update', 'save', 'password'].indexOf(action) !== -1;
    if (action === 'password' && (typeof rec.newSecret !== 'string' || !/^[a-f0-9]{64}$/.test(rec.newSecret)))
      return reply({ ok: false, error: 'bad secret' });
    if (writes && (!plainObject(rec.student) || rec.student.id !== id ||
        typeof rec.student.name !== 'string' || !rec.student.name.trim() ||
        rec.student.name.length > 24 || !plainObject(rec.progress)))
      return reply({ ok: false, error: 'bad record' });

    lock.waitLock(10000);
    locked = true;
    const file = dbFile();
    const db = JSON.parse(file.getBlob().getDataAsString() || '{}');
    if (!plainObject(db)) throw new Error('Invalid database');
    const existing = Object.prototype.hasOwnProperty.call(db, id) ? db[id] : null;
    if (action === 'recover') {
      // The reset code proves the teacher approved this; the new credential is the request's secret.
      const okCode = typeof rec.code === 'string' && rec.code.length >= 6 && rec.code.length <= 64 &&
        /^[a-f0-9]{64}$/.test(rec.secret);
      if (!okCode || !existing || existing.deleted || !existing.resetHash || Date.now() > existing.resetExpires)
        return reply({ ok: false, error: 'bad code' });
      if (existing.resetHash !== sha256(rec.code)) {
        existing.resetTries = (existing.resetTries || 0) + 1;
        if (existing.resetTries >= 5) clearReset(existing);
        file.setContent(JSON.stringify(db));
        return reply({ ok: false, error: 'bad code' });
      }
      existing.hash = sha256(rec.secret);
      delete existing.fails;
      delete existing.lockedUntil;
      try { CacheService.getScriptCache().remove('locked:' + id); } catch (_err) {}
      clearReset(existing);
      file.setContent(JSON.stringify(db));
      return reply({ ok: true });
    }
    let hash = sha256(rec.secret);
    const nextHash = action === 'password' ? sha256(rec.newSecret) : null;
    // Retrying a password migration after a lost reply is safe with either credential.
    if (existing && existing.lockedUntil && Date.now() < existing.lockedUntil) {
      try { CacheService.getScriptCache().put('locked:' + id, '1', Math.ceil((existing.lockedUntil - Date.now()) / 1000)); } catch (_err) {}
      return reply({ ok: false, error: 'locked' });
    }
    if (existing && existing.hash !== hash && existing.hash !== nextHash) {
      // Count wrong passwords so guessing is slow, and lock the id after too many.
      recordMetric('wrong_secret');
      existing.fails = (existing.fails || 0) + 1;
      if (existing.fails >= MAX_FAILS) {
        existing.fails = 0;
        existing.lockedUntil = Date.now() + LOCK_MS;
        try { CacheService.getScriptCache().put('locked:' + id, '1', Math.ceil(LOCK_MS / 1000)); } catch (_err) {}
      }
      file.setContent(JSON.stringify(db));
      return reply({ ok: false, error: existing.lockedUntil && Date.now() < existing.lockedUntil ? 'locked' : 'not yours' });
    }
    if (existing && (existing.fails || existing.lockedUntil)) {
      existing.fails = 0;
      delete existing.lockedUntil;
      try { CacheService.getScriptCache().remove('locked:' + id); } catch (_err) {}
      file.setContent(JSON.stringify(db));
    }

    if (action === 'delete') {
      // Keep only an ownership marker, so delayed saves cannot recreate deleted data.
      db[id] = { hash: hash, deleted: true };
      file.setContent(JSON.stringify(db));
      recordMetric('writes');
      return reply({ ok: true });
    }
    if (existing && existing.deleted) return reply({ ok: false, error: 'deleted' });
    if (action === 'read') {
      if (!existing) return reply({ ok: false, error: 'not found' });
      recordMetric('reads');
      return reply({ ok: true, student: existing.student, progress: existing.progress, savedAt: existing.savedAt });
    }
    if (action === 'create' && existing) return reply({ ok: false, error: 'exists' });
    if (action === 'update' && !existing) return reply({ ok: false, error: 'not found' });
    if (existing && ['save', 'update'].indexOf(action) !== -1 &&
        Object.prototype.hasOwnProperty.call(rec, 'base') && rec.base !== existing.savedAt)
      return reply({ ok: false, error: 'conflict' });
    if (nextHash) hash = nextHash;

    if (!existing) {
      if (Object.keys(db).length >= MAX_STUDENTS || file.getBlob().getDataAsString().length > MAX_FILE_CHARS)
        return reply({ ok: false, error: 'full' });
      if (!allowNewStudent()) return reply({ ok: false, error: 'busy' });
    }
    // Photos stay on the device, even if a caller accidentally includes one.
    if (plainObject(rec.student.av)) rec.student.av.img = '';
    const previousTime = existing ? Date.parse(existing.savedAt) || 0 : 0;
    const savedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
    db[id] = { hash: hash, student: rec.student, progress: rec.progress, savedAt: savedAt };
    file.setContent(JSON.stringify(db));
    recordMetric('writes');
    return reply({ ok: true, savedAt: savedAt });
  } catch (err) {
    const isLockTimeout = err && err.message && String(err.message).toLowerCase().indexOf('lock') !== -1;
    return reply({ ok: false, error: isLockTimeout ? 'busy' : (locked ? 'storage' : 'invalid') });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function doGet(_e) {
  // Credentials never appear in URLs. All data retrieval and export uses authenticated POST.
  return reply({ ok: false, error: 'denied' });
}

function performBackup() {
  const file = dbFile();
  const content = file.getBlob().getDataAsString() || '{}';
  JSON.parse(content);
  let folder;
  const folders = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  while (folders.hasNext()) {
    const f = folders.next();
    if (!f.isTrashed()) { folder = f; break; }
  }
  if (!folder) {
    folder = DriveApp.createFolder(BACKUP_FOLDER_NAME);
  }
  const timestamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const backupName = 'students-backup-' + timestamp + '.json';
  const backupFile = folder.createFile(backupName, content, 'application/json');
  const files = [];
  const iter = folder.getFiles();
  while (iter.hasNext()) {
    const f = iter.next();
    if (f.getName().indexOf('students-backup-') === 0 && !f.isTrashed()) files.push(f);
  }
  files.sort(function (a, b) { return b.getDateCreated().getTime() - a.getDateCreated().getTime(); });
  for (let i = MAX_BACKUPS; i < files.length; i++) {
    files[i].setTrashed(true);
  }
  Logger.log('Created backup: ' + backupName + ' (ID: ' + backupFile.getId() + ')');
  return { ok: true, name: backupName, id: backupFile.getId() };
}

/** Creates a timestamped backup copy of students.json in Google Drive and rotates old backups. */
function createBackup() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return performBackup();
  } finally {
    lock.releaseLock();
  }
}

/** Restores students.json from a backup file in Google Drive. */
function restoreBackup(backupId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const backupFile = DriveApp.getFileById(backupId);
    const content = backupFile.getBlob().getDataAsString();
    const parsed = JSON.parse(content);
    if (!plainObject(parsed)) throw new Error('Invalid backup file');
    performBackup();
    const file = dbFile();
    file.setContent(content);
    Logger.log('Restored database from backup: ' + backupFile.getName());
    return { ok: true, restoredFrom: backupFile.getName() };
  } finally {
    lock.releaseLock();
  }
}

/** Teacher tool: run from the editor after setting the RESET_ID Script property. */
function resetStudentFromProperty() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RESET_ID');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const file = dbFile();
    const db = JSON.parse(file.getBlob().getDataAsString() || '{}');
    if (!id || !Object.prototype.hasOwnProperty.call(db, id) || db[id].deleted) throw new Error('No such student: ' + id);
    const code = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    db[id].resetHash = sha256(code);
    db[id].resetExpires = Date.now() + 24 * 60 * 60 * 1000;
    db[id].resetTries = 0;
    try { CacheService.getScriptCache().remove('locked:' + id); } catch (_err) {}
    file.setContent(JSON.stringify(db));
    Logger.log('Reset code for ' + id + ': ' + code + ' (valid 24 hours)');
    return code;
  } finally {
    lock.releaseLock();
  }
}

/** Limits how many new student ids anyone can create per hour. */
function allowNewStudent() {
  try {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get('new-students') || 0);
    if (count >= MAX_NEW_PER_HOUR) return false;
    cache.put('new-students', String(count + 1), 3600);
    return true;
  } catch (_err) {
    return true;
  }
}

/** Fixed-window rate limiting helper using CacheService. */
function checkRateLimit(key, limit, seconds) {
  try {
    const cache = CacheService.getScriptCache();
    const count = Number(cache.get(key) || 0);
    if (count >= limit) return false;
    cache.put(key, String(count + 1), seconds);
    return true;
  } catch (_err) {
    return true;
  }
}

/** Records monitoring metrics in CacheService. */
function recordMetric(name) {
  try {
    const cache = CacheService.getScriptCache();
    const current = Number(cache.get('metric:' + name) || 0);
    cache.put('metric:' + name, String(current + 1), 21600);
  } catch (_err) { /* metric recording must never fail the request */ }
}

/** Reads accumulated monitoring metrics from CacheService. */
function getMetrics() {
  try {
    const cache = CacheService.getScriptCache();
    const names = ['reads', 'writes', 'wrong_secret', 'unauthorized', 'rate_limited', 'export', 'bad_auth', 'backup'];
    const metrics = {};
    for (let i = 0; i < names.length; i++) {
      metrics[names[i]] = Number(cache.get('metric:' + names[i]) || 0);
    }
    return metrics;
  } catch (_err) {
    return {};
  }
}

/** Constant-time string equality check to prevent timing attacks. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const hashA = sha256(a);
  const hashB = sha256(b);
  let diff = 0;
  for (let i = 0; i < hashA.length; i++) {
    diff |= hashA.charCodeAt(i) ^ hashB.charCodeAt(i);
  }
  return diff === 0;
}

function clearReset(entry) {
  delete entry.resetHash;
  delete entry.resetExpires;
  delete entry.resetTries;
}

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dbFile() {
  return DriveApp.getFileById(FILE_ID);
}

function sha256(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); })
    .join('');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
