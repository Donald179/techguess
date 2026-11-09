/**
 * TECHGEST — Couche IndexedDB Offline-First (JavaScript Vanilla)
 * Stocke localement : clients, prestations, paiements, dépenses, devis, factures et file de synchronisation.
 */
const TechGestDB = (() => {
  const DB_NAME = "techgest_local_indexeddb";
  const DB_VERSION = 1;
  const STORE_WORKSPACE = "workspace";
  const STORE_QUEUE = "sync_queue";

  function generateUUID() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function openDB() {
    return new Promise((resolve, reject) => {
      const req = window.indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_WORKSPACE)) {
          db.createObjectStore(STORE_WORKSPACE, { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains(STORE_QUEUE)) {
          const store = db.createObjectStore(STORE_QUEUE, { keyPath: "operationUuid" });
          store.createIndex("by_created", "createdAt", { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveWorkspace(workspace) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, "readwrite");
      tx.objectStore(STORE_WORKSPACE).put({
        key: "active_workspace",
        savedAt: new Date().toISOString(),
        data: workspace,
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function loadWorkspace() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_WORKSPACE, "readonly");
        const req = tx.objectStore(STORE_WORKSPACE).get("active_workspace");
        req.onsuccess = () => resolve(req.result ? req.result.data : null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  async function clearWorkspace() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_WORKSPACE, "readwrite");
      tx.objectStore(STORE_WORKSPACE).delete("active_workspace");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function enqueueOperation(op) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      tx.objectStore(STORE_QUEUE).put(op);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getQueue(userId) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_QUEUE, "readonly");
        const req = tx.objectStore(STORE_QUEUE).getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const filtered = userId !== undefined && userId !== null
            ? all.filter((i) => String(i.userId) === String(userId))
            : all;
          filtered.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          resolve(filtered);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  async function removeConfirmedOperations(uuids) {
    if (!uuids || uuids.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_QUEUE, "readwrite");
      const store = tx.objectStore(STORE_QUEUE);
      uuids.forEach((u) => store.delete(u));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return {
    generateUUID,
    saveWorkspace,
    loadWorkspace,
    clearWorkspace,
    enqueueOperation,
    getQueue,
    removeConfirmedOperations,
  };
})();
