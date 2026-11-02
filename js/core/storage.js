// Browser persistence only: these keys and JSON shapes remain compatible with existing students.
const STUDENTS_KEY = 'hiragana14-students-v1';
const THEME_KEY = 'hiragana14-theme';
const SYNC_QUEUE_KEY = 'hiragana14-sync-queue-v1';
/** @param {string} id */
const syncKey = (id) => 'hiragana14-sync-' + id;
/** @param {string} id */
const progressKey = (id) => 'hiragana14-progress-' + id;

/**
 * Saved data is untrusted: callers validate what comes back.
 * @param {string} key
 * @returns {unknown}
 */
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

/** @param {string} key @param {unknown} value */
function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function storageWorks() {
  try {
    const key = 'hiragana14-probe';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const canStore = storageWorks();
export const readStudents = () => read(STUDENTS_KEY);
/** @param {import('../../types/app').StudentList} students */
export const writeStudents = (students) => write(STUDENTS_KEY, students);
/** @param {string} id */
export const readProgress = (id) => read(progressKey(id));
/** @param {string} id @param {import('../../types/app').Progress} progress */
export const writeProgress = (id, progress) => write(progressKey(id), progress);
/** @param {string} id */
export const readSyncSecret = (id) => read(syncKey(id));
/** @param {string} id @param {string} secret */
export const writeSyncSecret = (id, secret) => write(syncKey(id), secret);
export const readSyncQueue = () => read(SYNC_QUEUE_KEY);
/** @param {unknown} queue */
export const writeSyncQueue = (queue) => write(SYNC_QUEUE_KEY, queue);
/** @param {string} id */
export const readPasswordVerifier = (id) => read('hiragana14-password-' + id);
/** @param {string} id @param {string} verifier */
export const writePasswordVerifier = (id, verifier) => write('hiragana14-password-' + id, verifier);
/** @param {string} id */
export const readPendingPassword = (id) => read('hiragana14-password-pending-' + id);
/** @param {string} id @param {string | null} secret */
export const writePendingPassword = (id, secret) => write('hiragana14-password-pending-' + id, secret);
/** @param {string} id */
export const readCloudVersion = (id) => read('hiragana14-cloud-version-' + id);
/** @param {string} id @param {string} version */
export const writeCloudVersion = (id, version) => write('hiragana14-cloud-version-' + id, version);
export const readDeviceTheme = () => read(THEME_KEY);
/** @param {import('../../types/app').Theme} theme */
export const writeDeviceTheme = (theme) => write(THEME_KEY, theme);
/** @param {string} id */
export function deleteProgress(id) {
  try {
    localStorage.removeItem(progressKey(id));
  } catch {
    /* The in-memory student can still be removed when storage is blocked. */
  }
}
