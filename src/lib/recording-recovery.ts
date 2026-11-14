/**
 * IndexedDB Segment Journal and Crash Recovery for StudyStation Lecture Recordings.
 *
 * Persists audio chunks every 1-2 seconds during live recording into IndexedDB.
 * If the browser crashes, the tab is accidentally closed, or the PC shuts down,
 * the student can immediately restore and upload their entire recording upon reopening.
 */

const DB_NAME = "studystation-recordings-db";
const DB_VERSION = 1;
const STORE_SESSIONS = "recording_sessions";
const STORE_CHUNKS = "recording_chunks";

export interface RecordingSessionMeta {
  id: string; // e.g. "active-session"
  title: string;
  courseId: string | null;
  mimeType: string;
  startedAt: number;
  lastUpdatedAt: number;
  totalDurationSeconds: number;
  chunkCount: number;
  isCompleted: boolean;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not supported in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        db.createObjectStore(STORE_SESSIONS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_CHUNKS)) {
        const chunkStore = db.createObjectStore(STORE_CHUNKS, { keyPath: "key" });
        chunkStore.createIndex("by_session", "sessionId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Failed to open IndexedDB"));
  });
}

export class RecordingJournal {
  private sessionId = "active-session";
  private chunkIndex = 0;
  private db: IDBDatabase | null = null;

  public async initSession(title: string, courseId: string | null, mimeType: string): Promise<void> {
    try {
      this.db = await openDatabase();
      this.chunkIndex = 0;

      // Clear any previous chunks for the active session
      await this.clearActiveSession();

      const meta: RecordingSessionMeta = {
        id: this.sessionId,
        title: title.trim() || "Lecture Recording",
        courseId,
        mimeType: mimeType || "audio/webm",
        startedAt: Date.now(),
        lastUpdatedAt: Date.now(),
        totalDurationSeconds: 0,
        chunkCount: 0,
        isCompleted: false,
      };

      const tx = this.db.transaction([STORE_SESSIONS], "readwrite");
      tx.objectStore(STORE_SESSIONS).put(meta);
      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn("[RecordingJournal] Failed to initialize recording session in IndexedDB:", e);
    }
  }

  public async appendChunk(chunk: Blob, elapsedSeconds: number): Promise<void> {
    if (!this.db || !chunk || chunk.size === 0) return;

    try {
      const chunkKey = `${this.sessionId}:${String(this.chunkIndex).padStart(6, "0")}`;
      const chunkData = {
        key: chunkKey,
        sessionId: this.sessionId,
        index: this.chunkIndex,
        data: chunk,
        timestamp: Date.now(),
      };

      this.chunkIndex += 1;

      const tx = this.db.transaction([STORE_CHUNKS, STORE_SESSIONS], "readwrite");
      tx.objectStore(STORE_CHUNKS).put(chunkData);

      // Update session metadata
      const sessionStore = tx.objectStore(STORE_SESSIONS);
      const getReq = sessionStore.get(this.sessionId);
      getReq.onsuccess = () => {
        const meta = getReq.result as RecordingSessionMeta | undefined;
        if (meta) {
          meta.lastUpdatedAt = Date.now();
          meta.chunkCount = this.chunkIndex;
          meta.totalDurationSeconds = elapsedSeconds;
          sessionStore.put(meta);
        }
      };

      await new Promise<void>((res, rej) => {
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
    } catch (e) {
      console.warn("[RecordingJournal] Failed to append audio chunk:", e);
    }
  }

  public async markCompleted(): Promise<void> {
    if (!this.db) return;
    try {
      const tx = this.db.transaction([STORE_SESSIONS], "readwrite");
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.get(this.sessionId);
      req.onsuccess = () => {
        const meta = req.result as RecordingSessionMeta | undefined;
        if (meta) {
          meta.isCompleted = true;
          meta.lastUpdatedAt = Date.now();
          store.put(meta);
        }
      };
      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    } catch (e) {
      console.warn("[RecordingJournal] Error marking completed:", e);
    }
  }

  public async clearActiveSession(): Promise<void> {
    try {
      const db = this.db || (await openDatabase());
      const tx = db.transaction([STORE_SESSIONS, STORE_CHUNKS], "readwrite");

      tx.objectStore(STORE_SESSIONS).delete(this.sessionId);

      const chunkStore = tx.objectStore(STORE_CHUNKS);
      const index = chunkStore.index("by_session");
      const req = index.openCursor(IDBKeyRange.only(this.sessionId));
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      await new Promise<void>((res) => {
        tx.oncomplete = () => res();
        tx.onerror = () => res();
      });
    } catch (e) {
      console.warn("[RecordingJournal] Clear session error:", e);
    }
  }

  /**
   * Check if there is an unfinalized / crashed recording session available for recovery.
   */
  public static async checkRecoverableSession(): Promise<{
    hasRecoverable: boolean;
    meta?: RecordingSessionMeta;
  }> {
    if (typeof window === "undefined" || !window.indexedDB) {
      return { hasRecoverable: false };
    }

    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_SESSIONS], "readonly");
      const store = tx.objectStore(STORE_SESSIONS);
      const req = store.get("active-session");

      const meta = await new Promise<RecordingSessionMeta | null>((res) => {
        req.onsuccess = () => res(req.result as RecordingSessionMeta || null);
        req.onerror = () => res(null);
      });

      if (!meta) return { hasRecoverable: false };

      // If session was not cleanly completed and has audio chunks
      if (!meta.isCompleted && meta.chunkCount > 0) {
        return { hasRecoverable: true, meta };
      }

      return { hasRecoverable: false };
    } catch {
      return { hasRecoverable: false };
    }
  }

  /**
   * Stitches all stored chunks from an unfinalized session into a single Blob for recovery.
   */
  public static async restoreRecoverableBlob(): Promise<{
    blob: Blob | null;
    meta: RecordingSessionMeta | null;
  }> {
    try {
      const db = await openDatabase();
      const meta = await new Promise<RecordingSessionMeta | null>((res) => {
        const tx = db.transaction([STORE_SESSIONS], "readonly");
        const req = tx.objectStore(STORE_SESSIONS).get("active-session");
        req.onsuccess = () => res(req.result as RecordingSessionMeta || null);
        req.onerror = () => res(null);
      });

      if (!meta) return { blob: null, meta: null };

      const chunks: Blob[] = [];
      const tx = db.transaction([STORE_CHUNKS], "readonly");
      const chunkStore = tx.objectStore(STORE_CHUNKS);
      const index = chunkStore.index("by_session");
      const req = index.openCursor(IDBKeyRange.only("active-session"));

      await new Promise<void>((res, rej) => {
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            const row = cursor.value as { data: Blob };
            if (row && row.data) chunks.push(row.data);
            cursor.continue();
          } else {
            res();
          }
        };
        req.onerror = () => rej(req.error);
      });

      if (chunks.length === 0) return { blob: null, meta };

      const blob = new Blob(chunks, { type: meta.mimeType || "audio/webm" });
      return { blob, meta };
    } catch (e) {
      console.warn("[RecordingJournal] Failed to restore chunks:", e);
      return { blob: null, meta: null };
    }
  }
}
