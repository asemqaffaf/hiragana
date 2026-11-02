/**
 * Deploy as a web app: Execute as Me, access Anyone.
 * Project Settings > Script properties: set TEACHER_KEY to a long random password.
 * After changing this file: Manage deployments > Edit > New version > Deploy.
 *
 * POST JSON (text/plain): {action, id, secret, student?, progress?}
 * Actions: create, read, update, save (upsert, also the legacy default), delete, password, recover.
 * A forgotten password is reset by the teacher: set the Script property RESET_ID to the student id, run
 * resetStudentFromProperty in the editor, and read the one-time code in the execution log (valid 24 hours).
 * Only the secret that claimed an id can access it. Secrets stay out of URLs.
 * GET ?key=TEACHER_KEY keeps the teacher's read-only export available.
 */
const FILE_ID = '1NN9aPG1QkEVmsh0jkhVzsV3IOadZY6Ej';
const MAX_BYTES = 200000;

function doPost(e) {
  const lock = LockService.getScriptLock();
  let locked = false;
  try {
    const raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > MAX_BYTES || Utilities.newBlob(raw).getBytes().length > MAX_BYTES)
      return reply({ ok: false, error: 'too large' });
    const rec = JSON.parse(raw);
    if (!plainObject(rec)) return reply({ ok: false, error: 'invalid' });
    const action = rec.action || 'save';
    if (['create', 'read', 'update', 'save', 'delete', 'password', 'recover'].indexOf(action) === -1)
      return reply({ ok: false, error: 'bad action' });
    const id = rec.id || (rec.student && rec.student.id);
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id) ||
        ['__proto__', 'constructor', 'prototype'].indexOf(id) !== -1)
      return reply({ ok: false, error: 'bad id' });
    if (typeof rec.secret !== 'string' || rec.secret.length < 16 || rec.secret.length > 256)
      return reply({ ok: false, error: 'bad secret' });
    const writes = ['create', 'update', 'save', 'password'].indexOf(action) !== -1;
    if (action === 'password' && (typeof rec.newSecret !== 'string' || !/^[a-f0-9]{64}$/.test(rec.newSecret)))
      return reply({ ok: false, error: 'bad secret' });
    if (writes && (!plainObject(rec.student) || rec.student.id !== id ||
        typeof rec.student.name !== 'string' || !rec.student.name.trim() ||
        rec.student.name.length > 24 || !plainObject(rec.progress)))
      return reply({ ok: false, error: 'bad record' });

    lock.waitLock(20000);
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
      clearReset(existing);
      file.setContent(JSON.stringify(db));
      return reply({ ok: true });
    }
    let hash = sha256(rec.secret);
    const nextHash = action === 'password' ? sha256(rec.newSecret) : null;
    // Retrying a password migration after a lost reply is safe with either credential.
    if (existing && existing.hash !== hash && existing.hash !== nextHash)
      return reply({ ok: false, error: 'not yours' });

    if (action === 'delete') {
      // Keep only an ownership marker, so delayed saves cannot recreate deleted data.
      db[id] = { hash: hash, deleted: true };
      file.setContent(JSON.stringify(db));
      return reply({ ok: true });
    }
    if (existing && existing.deleted) return reply({ ok: false, error: 'deleted' });
    if (action === 'read') {
      if (!existing) return reply({ ok: false, error: 'not found' });
      return reply({ ok: true, student: existing.student, progress: existing.progress, savedAt: existing.savedAt });
    }
    if (action === 'create' && existing) return reply({ ok: false, error: 'exists' });
    if (action === 'update' && !existing) return reply({ ok: false, error: 'not found' });
    if (existing && ['save', 'update'].indexOf(action) !== -1 &&
        Object.prototype.hasOwnProperty.call(rec, 'base') && rec.base !== existing.savedAt)
      return reply({ ok: false, error: 'conflict' });
    if (nextHash) hash = nextHash;

    // Photos stay on the device, even if a caller accidentally includes one.
    if (plainObject(rec.student.av)) rec.student.av.img = '';
    const previousTime = existing ? Date.parse(existing.savedAt) || 0 : 0;
    const savedAt = new Date(Math.max(Date.now(), previousTime + 1)).toISOString();
    db[id] = { hash: hash, student: rec.student, progress: rec.progress, savedAt: savedAt };
    file.setContent(JSON.stringify(db));
    return reply({ ok: true, savedAt: savedAt });
  } catch (err) {
    return reply({ ok: false, error: locked ? 'storage' : 'invalid' });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function doGet(e) {
  const key = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  if (!key || !e || !e.parameter || e.parameter.key !== key) return reply({ error: 'denied' });
  try {
    const db = JSON.parse(dbFile().getBlob().getDataAsString() || '{}');
    const out = Object.keys(db).filter(function (id) { return !db[id].deleted; }).map(function (id) {
      return { student: db[id].student, progress: db[id].progress, savedAt: db[id].savedAt };
    });
    return reply(out);
  } catch (err) {
    return reply({ ok: false, error: 'storage' });
  }
}

/** Teacher tool: run from the editor after setting the RESET_ID Script property. */
function resetStudentFromProperty() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('RESET_ID');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const file = dbFile();
    const db = JSON.parse(file.getBlob().getDataAsString() || '{}');
    if (!id || !Object.prototype.hasOwnProperty.call(db, id) || db[id].deleted) throw new Error('No such student: ' + id);
    const code = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
    db[id].resetHash = sha256(code);
    db[id].resetExpires = Date.now() + 24 * 60 * 60 * 1000;
    db[id].resetTries = 0;
    file.setContent(JSON.stringify(db));
    Logger.log('Reset code for ' + id + ': ' + code + ' (valid 24 hours)');
    return code;
  } finally {
    lock.releaseLock();
  }
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
