// Browser persistence only: these keys and JSON shapes remain compatible with existing students.
const STUDENTS_KEY = 'hiragana14-students-v1';
const THEME_KEY = 'hiragana14-theme';
const progressKey = (id) => 'hiragana14-progress-' + id;

function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
}

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
export const writeStudents = (students) => write(STUDENTS_KEY, students);
export const readProgress = (id) => read(progressKey(id));
export const writeProgress = (id, progress) => write(progressKey(id), progress);
export const readDeviceTheme = () => read(THEME_KEY);
export const writeDeviceTheme = (theme) => write(THEME_KEY, theme);
export function deleteProgress(id) {
  try {
    localStorage.removeItem(progressKey(id));
  } catch {
    /* The in-memory student can still be removed when storage is blocked. */
  }
}
