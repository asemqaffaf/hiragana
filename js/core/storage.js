// Browser persistence only: these keys and JSON shapes remain compatible with existing students.
const STUDENTS_KEY = 'hiragana14-students-v1';
const THEME_KEY = 'hiragana14-theme';
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
