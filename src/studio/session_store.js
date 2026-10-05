// MIT License — Copyright (c) 2026 Decentralized Science Labs
// Keeps the last dataset and model in this browser (IndexedDB) so a reload doesn't lose work.
const DB = "gl1f-crypto-session", STORE = "kv";
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function run(mode, fn) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function saveSession(key, value) {
  try { await run("readwrite", (s) => s.put({ savedAt: Date.now(), value }, key)); return true; }
  catch (error) { console.warn(`Session ${key} not saved:`, error?.message || error); return false; }
}
export async function loadSession(key, maxAgeMs = 14 * 86_400_000) {
  try {
    const rec = await run("readonly", (s) => s.get(key));
    if (!rec || Date.now() - rec.savedAt > maxAgeMs) return null;
    return { ...rec.value, savedAt: rec.savedAt };
  } catch { return null; }
}
export async function clearSession() {
  try { await run("readwrite", (s) => s.clear()); } catch {}
}
