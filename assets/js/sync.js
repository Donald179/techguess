/**
 * TECHGEST Supabase Edition — Moteur de Synchronisation Idempotent & Conflits HTTP 409
 */
const TechGestSync = (() => {
  let syncing = false;

  async function syncNow(workspace, onUpdated, notify) {
    if (!workspace || syncing) return;
    if (!navigator.onLine) {
      if (notify) {
        notify("warning", "Vous êtes hors ligne. Les opérations restent stockées dans IndexedDB.");
      }
      return;
    }

    if (!TechGestSupabase.isConfigured() || workspace.user.id === "local-demo-uuid") {
      if (notify) {
        notify("info", "Mode local actif (configurez assets/js/supabase-config.js pour synchroniser avec Supabase).");
      }
      return;
    }

    const userId = String(workspace.user.id);
    const queue = await TechGestDB.getQueue(userId);
    const pending = queue.filter((op) => op.status === "PENDING" || op.status === "FAILED");

    if (pending.length === 0) {
      try {
        const fresh = await TechGestSupabase.fetchWorkspace();
        if (fresh) {
          await TechGestDB.saveWorkspace(fresh);
          if (onUpdated) onUpdated(fresh, []);
          if (notify) notify("success", "Données synchronisées avec Supabase.");
        }
      } catch {
        // ignore network hiccup
      }
      return;
    }

    syncing = true;
    try {
      for (const op of pending) {
        op.attempts = (op.attempts || 0) + 1;
        op.status = "SYNCING";
        await TechGestDB.enqueueOperation(op);
      }

      const outcome = await TechGestSupabase.processSyncBatch(userId, pending);
      const confirmedUuids = [];
      let conflicts = 0;

      for (const op of pending) {
        const match = outcome.results.find((r) => r.operationUuid === op.operationUuid);
        if (!match) continue;

        if (match.status === "SYNCED") {
          confirmedUuids.push(op.operationUuid);
        } else if (match.status === "CONFLICT") {
          conflicts += 1;
          op.status = "CONFLICT";
          op.conflictData = match.conflict;
          await TechGestDB.enqueueOperation(op);
        } else {
          op.status = "FAILED";
          op.lastError = match.error || "Erreur Supabase";
          await TechGestDB.enqueueOperation(op);
        }
      }

      if (confirmedUuids.length > 0) {
        await TechGestDB.removeConfirmedOperations(confirmedUuids);
      }

      const updatedQueue = await TechGestDB.getQueue(userId);
      if (outcome.workspace) {
        await TechGestDB.saveWorkspace(outcome.workspace);
        if (onUpdated) onUpdated(outcome.workspace, updatedQueue);
      } else if (onUpdated) {
        onUpdated(workspace, updatedQueue);
      }

      if (conflicts > 0 && notify) {
        notify("warning", `${conflicts} conflit(s) de version détecté(s). Cliquez sur le badge réseau pour arbitrer.`);
      } else if (confirmedUuids.length > 0 && notify) {
        notify("success", `${confirmedUuids.length} opération(s) synchronisée(s) avec Supabase !`);
      }
    } finally {
      syncing = false;
    }
  }

  return { syncNow };
})();
