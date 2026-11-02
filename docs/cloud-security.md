# Cloud Sync Security & Scalability Architecture

This document describes the security hardening, abuse protection, disaster recovery, and scalability evaluation for the Hiragana cloud synchronization backend ([Issue #5](https://github.com/asemqaffaf/hiragana/issues/5)).

The architecture maintains the project's zero-build, zero-server-maintenance stack: client-side vanilla JavaScript hosted on GitHub Pages, backed by a private Google Apps Script Web App saving to Google Drive.

---

## 1. Threat Model & Google Apps Script Quotas

### The Problem
When deployed as a Google Apps Script Web App (`Execute as: Me`, `Access: Anyone`), the endpoint executes under the owner's Google account:
1. **Google Apps Script Resource Limits:**
   - **Concurrent executions:** Maximum of **30** simultaneous script executions.
   - **Runtime quota:** 90 minutes/day for personal Google accounts (6 hours/day for Google Workspace).
2. **Lock Contention:**
   - Write operations require exclusive serialization via `LockService.getScriptLock()` to prevent race conditions when updating `students.json`.
   - If unauthenticated or abusive requests acquire or wait on this lock, execution queues back up, holding execution threads for up to 20 seconds and rapidly consuming the 30 concurrent execution limit.
3. **Public Exposure & Credential Leaks:**
   - Any student device with sync enabled connects to the Apps Script endpoint.
   - The legacy export mechanism (`GET ?key=TEACHER_KEY`) exposed administrative credentials in URL query parameters, leaking secrets into browser history, proxy logs, referrer headers, and Google Cloud access logs.

---

## 2. P0: Native API Protection & Quota Defense

To protect Google Apps Script execution quotas and prevent lock contention without introducing third-party services or infrastructure dependencies, [`scripts/google-apps-script.gs`](../scripts/google-apps-script.gs) implements native, fast-rejection controls:

```
[Browser Client]
       │  (HTTPS POST - No secrets in URL)
       ▼
┌────────────────────────────────────────────────────────┐
│ Google Apps Script Web App (doPost)                    │
│                                                        │
│ 1. Early Payload Validation (< 1ms)                    │
│    • Size check (max 200 KB)                           │
│    • JSON parsing and plain object verification        │
│                                                        │
│ 2. In-Memory Rate Limiting via CacheService (< 2ms)    │
│    • Global rate limit: 120 req/minute                 │
│    • Per-student rate limit: 30 req/minute per ID      │
│    • Rejects floods BEFORE LockService or Drive I/O    │
│                                                        │
│ 3. Pre-Lock Account Lockout Check (< 2ms)              │
│    • Checks CacheService for locked student IDs        │
│    • Drops locked IDs immediately without Drive read   │
│                                                        │
│ 4. Fast Authentication & Minimal Lock Duration         │
│    • Reduced lock timeout from 20s to 10s              │
│    • Serialized atomic DriveApp file write             │
└────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Storage: Google Drive JSON & Automated Backups         │
│  • students.json (private, restricted access)          │
│  • Automated timestamped backups in "Hiragana Backups" │
│  • Automated retention rotation (newest 30 versions)   │
└────────────────────────────────────────────────────────┘
```

### Pre-Lock Rejection (Zero Drive I/O on Floods)
- **Fast Size & Syntax Rejection:** Requests larger than 200 KB or with malformed JSON are rejected before taking locks or touching storage.
- **CacheService Rate Limiting:**
  - `checkRateLimit('rate:global:' + minuteBucket, 120, 65)` limits total script throughput to 120 requests/minute.
  - `checkRateLimit('rate:id:' + id + ':' + minuteBucket, 30, 65)` limits individual student accounts to 30 requests/minute.
  - Throttled requests exit in `< 5ms` with `{ ok: false, error: 'rate limited' }`.
- **Cached Account Lockouts:** After 10 consecutive failed passwords, the account is locked for 15 minutes, and a lockout flag is cached in `CacheService`. Subsequent brute-force attempts return `{ ok: false, error: 'locked' }` in `< 3ms` without locking or reading Google Drive.
- **Client Auto-Retry:** [`js/core/cloud.js`](../js/core/cloud.js) detects `'rate limited'` or `'busy'` responses and automatically schedules a retry in 15 seconds, preventing students from becoming permanently desynchronized during temporary traffic spikes.

---

## 3. P1: Authentication, Monitoring & Disaster Recovery

### Credential Hygiene
- **Zero Credentials in URLs:** The legacy `GET ?key=TEACHER_KEY` endpoint is completely disabled; `doGet(e)` unconditionally returns `{ ok: false, error: 'denied' }`.
- **Authenticated POST Actions:** Admin export and stats require an authenticated POST:
  ```json
  POST /exec
  {
    "action": "export",
    "teacherKey": "<TEACHER_KEY>"
  }
  ```
  Validation uses timing-safe constant-time string comparison (`safeEqual`) to prevent timing attacks.
- **Teacher CLI Tool:** Teachers can export student records, view server stats, or trigger backups using [`scripts/export-students.mjs`](../scripts/export-students.mjs):
  ```sh
  # Export active student records to a local file
  node scripts/export-students.mjs <SYNC_URL> --key "$TEACHER_KEY" --out students.json

  # View monitoring stats and quota usage
  node scripts/export-students.mjs <SYNC_URL> --key "$TEACHER_KEY" --stats

  # Trigger a versioned backup in Google Drive
  node scripts/export-students.mjs <SYNC_URL> --key "$TEACHER_KEY" --backup
  ```
- **Student Bearer Credentials:** Passwords never leave the browser. The client derives a 256-bit bearer secret using PBKDF2-SHA-256 (310,000 iterations) with a unique per-student salt (`hiragana14-password-v1:<id>`). Drive stores only the SHA-256 hash of that credential.

### Automated Backups & Versioning
- **`createBackup()`:** Creates a timestamped file `students-backup-YYYYMMDD'T'HHmmss'Z'.json` in a dedicated `Hiragana Backups` folder in Google Drive.
- **Rotation:** Automatically maintains the newest 30 backups, moving older versions to trash.
- **`restoreBackup(backupId)`:** Restores `students.json` from a selected backup after creating a safety backup of the current state.
- **Automated Scheduling:** Teachers can configure an automated daily backup trigger in Apps Script:
  ```javascript
  ScriptApp.newTrigger('createBackup')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  ```

### Monitoring & Telemetry
- **Metrics Tracking:** Apps Script tracks operational metrics in `CacheService` without logging sensitive data:
  - `reads`: successful student progress reads.
  - `writes`: successful student progress saves.
  - `wrong_secret`: failed student password attempts.
  - `rate_limited`: requests throttled by rate limits.
  - `export`: teacher export requests.
  - `bad_auth`: failed teacher authentication attempts.
- **Stats Endpoint:** Querying `{ action: 'stats', teacherKey: '...' }` returns active students count, deleted count, database byte size, storage limits, and traffic metrics.

### Incident Recovery & Google Account Isolation

#### Google Account Isolation
> [!IMPORTANT]
> Always deploy the Google Apps Script project and `students.json` in a **dedicated Google account** (e.g., `hiragana-sync@school.edu` or a dedicated organizational account), rather than a personal Google account.
> - Isolates student progress data from personal Google Drive files, photos, and emails.
> - Ensures quota limits or security events on Apps Script cannot impact personal Google services.

#### Incident Runbooks

1. **Suspected Quota Exhaustion or Flood Attack:**
   - Check statistics with `node scripts/export-students.mjs <SYNC_URL> --stats`.
   - If an ID is being targeted, `CacheService` automatically throttles and locks out attackers without exhausting Drive resources.
   - If needed, temporarily update the Apps Script deployment or pause the script from the Google Apps Script dashboard.

2. **Accidental Deletion or Database Corruption:**
   - Open Google Drive in the dedicated sync account.
   - Navigate to the `Hiragana Backups` folder.
   - Locate the most recent valid `students-backup-*.json` file.
   - Run `restoreBackup('<file-id>')` in the Apps Script editor, or copy its JSON contents into `students.json`.

3. **Compromised Teacher Key:**
   - Immediately update `TEACHER_KEY` in Google Apps Script **Project Settings → Script Properties** with a new cryptographically secure random value.

4. **Student Forgot Password:**
   - Set Script Property `RESET_ID` to the student ID.
   - Run `resetStudentFromProperty` in the Apps Script editor.
   - Provide the 10-character single-use reset code from the execution log to the student (valid 24 hours, canceled after 5 wrong guesses).

---

## 4. P2: Scalability Evaluation (Google Drive vs Firebase)

As educational adoption expands beyond single classrooms, here is the technical comparison between the current Google Drive JSON architecture and Firebase:

| Metric / Feature | Current (Apps Script + Drive) | Firebase Auth + Firestore |
| :--- | :--- | :--- |
| **Target Scale** | 1–500 students | 1,000–100,000+ students |
| **Concurrent Limit** | 30 simultaneous executions | 1,000,000+ simultaneous connections |
| **Write Model** | Serialized lock on `students.json` | Document-level writes (`/students/{id}`) |
| **Query Latency** | 500ms – 1,500ms | 30ms – 150ms |
| **Cost** | **$0** (Free Google account) | **$0** on Spark plan (up to 50k reads/day) |
| **Infrastructure** | No server or database to manage | Managed Google Cloud / Firebase console |

### Migration Blueprint: Firebase Authentication + Cloud Firestore

If the application ever outgrows Google Drive JSON storage:

1. **Data Model:**
   ```
   firestore
   └── students (collection)
       └── {studentId} (document)
           ├── name: string
           ├── av: { t: string, img: string }
           ├── savedAt: timestamp
           ├── secretHash: string
           └── progress: map (lesson, stats, goals, daily)
   ```

2. **Client Compatibility:**
   Because [`js/core/cloud.js`](../js/core/cloud.js) encapsulates synchronization behind `queueCloudSave()`, `restoreCloud()`, and `signInCloud()`, migrating to Firestore only requires updating the transport layer in `requestCloud()`, leaving all UI, study sessions, and offline queues completely unchanged.
