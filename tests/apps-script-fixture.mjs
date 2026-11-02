import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export function appsScriptFixture(initial = {}) {
  let content = JSON.stringify(initial);
  let writes = 0;
  let locked = false;
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({
      waitLock() { if (locked) throw new Error('already locked'); locked = true; },
      releaseLock() { if (!locked) throw new Error('not locked'); locked = false; },
    }) },
    DriveApp: { getFileById: () => ({
      getBlob: () => ({ getDataAsString: () => content }),
      setContent(value) { content = value; writes++; },
    }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'teacher-test-key' }) },
    Utilities: {
      newBlob: (text) => ({ getBytes: () => Buffer.from(text) }),
      DigestAlgorithm: { SHA_256: 'sha256' },
      computeDigest: (_, text) => [...createHash('sha256').update(text).digest()],
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
    corrupt: () => { content = 'broken'; },
    locked: () => locked,
  };
}
