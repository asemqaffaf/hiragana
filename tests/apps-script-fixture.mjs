import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function appsScriptFixture(initial = {}) {
  let content = JSON.stringify(initial);
  let writes = 0;
  let locked = false;
  let resetId = '';
  const properties = new Map([['TEACHER_KEY', 'teacher-test-key']]);
  const cache = new Map();
  const files = new Map();
  const folders = new Map();

  let idCounter = 1;
  function makeFile(name, fileContent) {
    const id = 'file-' + (idCounter++);
    const created = new Date();
    let trashed = false;
    let data = fileContent;
    const f = {
      getId: () => id,
      getName: () => name,
      getDateCreated: () => created,
      isTrashed: () => trashed,
      setTrashed: (t) => { trashed = t; },
      getBlob: () => ({ getDataAsString: () => data, getBytes: () => Buffer.from(data) }),
      getSize: () => Buffer.byteLength(data),
      setContent: (val) => { data = val; },
    };
    files.set(id, f);
    return f;
  }

  function makeFolder(name) {
    const folderFiles = [];
    let trashed = false;
    const folder = {
      getName: () => name,
      isTrashed: () => trashed,
      setTrashed: (t) => { trashed = t; },
      createFile: (fileName, fileContent) => {
        const file = makeFile(fileName, fileContent);
        folderFiles.push(file);
        return file;
      },
      getFiles: () => {
        let idx = 0;
        return {
          hasNext: () => idx < folderFiles.length,
          next: () => folderFiles[idx++],
        };
      },
    };
    folders.set(name, folder);
    return folder;
  }

  const mainDbFile = {
    getId: () => '1NN9aPG1QkEVmsh0jkhVzsV3IOadZY6Ej',
    getName: () => 'students.json',
    getDateCreated: () => new Date(),
    isTrashed: () => false,
    setTrashed: () => {},
    getBlob: () => ({ getDataAsString: () => content, getBytes: () => Buffer.from(content) }),
    getSize: () => Buffer.byteLength(content),
    setContent(value) { content = value; writes++; },
  };

  const context = vm.createContext({
    LockService: { getScriptLock: () => ({
      waitLock() { if (locked) throw new Error('already locked'); locked = true; },
      releaseLock() { if (!locked) throw new Error('not locked'); locked = false; },
    }) },
    DriveApp: {
      getFileById: (id) => files.get(id) || mainDbFile,
      getFoldersByName: (name) => {
        const f = folders.get(name);
        const list = f ? [f] : [];
        let idx = 0;
        return {
          hasNext: () => idx < list.length,
          next: () => list[idx++],
        };
      },
      createFolder: (name) => makeFolder(name),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (name) => (name === 'RESET_ID' ? resetId : properties.get(name) || null),
        setProperty: (name, val) => properties.set(name, val),
        deleteProperty: (name) => properties.delete(name),
      }),
    },
    Logger: { log() {} },
    CacheService: {
      getScriptCache: () => ({
        get: (k) => cache.get(k) ?? null,
        put: (k, v) => cache.set(k, String(v)),
        remove: (k) => cache.delete(k),
      }),
    },
    Utilities: {
      newBlob: (text) => ({ getBytes: () => Buffer.from(text) }),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, text) => [...createHash('sha256').update(text).digest()],
      getUuid: () => '12345678-9abc-def0-1234-56789abcdef0',
      formatDate: (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z',
    },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(readFileSync(new URL('../scripts/google-apps-script.gs', import.meta.url), 'utf8'), context);
  return {
    post: (payload) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(payload) } }).text),
    get: (key) => JSON.parse(context.doGet({ parameter: { key } }).text),
    db: () => JSON.parse(content),
    writes: () => writes,
    reset: (id) => { resetId = id; return context.resetStudentFromProperty(); },
    corrupt: () => { content = 'broken'; },
    locked: () => locked,
    setProperty: (key, val) => { properties.set(key, val); },
    deleteProperty: (key) => { properties.delete(key); },
    createBackup: () => context.createBackup(),
    restoreBackup: (id) => context.restoreBackup(id),
    files: () => files,
    folders: () => folders,
    cache: () => cache,
  };
}
