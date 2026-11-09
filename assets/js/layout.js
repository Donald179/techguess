/**
 * TECHGEST — Noyau Partagé Multi-Pages (assets/js/layout.js)
 * Gère la navigation latérale/mobile, le statut En ligne / Hors ligne,
 * la synchronisation IndexedDB ↔ Supabase et la garde d'authentification sur chaque page HTML.
 */
const TechGestLayout = (() => {
  let workspace = null;
  let syncQueue = [];
  let onDataRefreshCallback = null;

  const NAV_PAGES = [
    { key: "dashboard", label: "Tableau de bord", href: "./index.html" },
    { key: "clients", label: "Clients", href: "./clients.html" },
    { key: "prestations", label: "Prestations", href: "./prestations.html" },
    { key: "paiements", label: "Paiements", href: "./paiements.html" },
    { key: "depenses", label: "Dépenses", href: "./depenses.html" },
    { key: "devis-factures", label: "Devis & Factures", href: "./devis-factures.html" },
    { key: "rapports", label: "Rapports financiers", href: "./rapports.html" },
    { key: "parametres", label: "Paramètres & Synchro", href: "./parametres.html" },
  ];

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function showToast(type, message) {
    let container = document.getElementById("tg-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "tg-toast-container";
      document.body.appendChild(container);
    }
    const bg =
      type === "success"
        ? "#102B46"
        : type === "warning"
        ? "#D97706"
        : type === "error"
        ? "#DC2626"
        : "#2685D8";
    const el = document.createElement("div");
    el.style.cssText = `background:${bg};color:#fff;padding:12px 16px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,0.16);margin-bottom:8px;`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function renderShell(activeKey) {
    const sidebarEl = document.getElementById("tg-sidebar-mount");
    if (sidebarEl) {
      sidebarEl.innerHTML = `
        <aside class="tg-sidebar">
          <a href="./index.html" class="tg-brand-link">
            <img src="./assets/images/icon-192.png" alt="TECHGEST" width="36" height="36" class="rounded-2" />
            <div>
              <div class="fw-bolder fs-5 lh-1">TECHGEST</div>
              <small class="text-white-50" style="font-size:11px;">Gestion IT • Offline PWA</small>
            </div>
          </a>

          <nav class="flex-grow-1">
            ${NAV_PAGES.map(
              (p) => `
              <a href="${p.href}" class="tg-nav-link ${p.key === activeKey ? "active" : ""}">
                <span>${p.label}</span>
              </a>`
            ).join("")}
          </nav>

          <div class="pt-3 border-top border-secondary border-opacity-25 d-flex justify-content-between align-items-center px-1">
            <div class="small text-truncate me-2">
              <div class="fw-bold text-truncate">${esc(workspace?.user?.full_name || "Utilisateur")}</div>
              <div class="text-white-50 text-truncate" style="font-size:11px;">${esc(
                workspace?.profile?.business_name || "TECHGEST IT"
              )}</div>
            </div>
            <button type="button" id="btn-shell-logout" class="btn btn-outline-light btn-sm">Quitter</button>
          </div>
        </aside>
      `;
    }

    const topbarEl = document.getElementById("tg-topbar-mount");
    if (topbarEl) {
      topbarEl.innerHTML = `
        <header class="tg-topbar">
          <div class="d-flex align-items-center gap-2">
            <a href="./index.html" class="d-lg-none fw-bolder tg-text-navy text-decoration-none">TECHGEST</a>
            <span class="d-none d-lg-inline small text-muted">
              <strong>${esc(workspace?.profile?.business_name || "TECHGEST Solutions IT")}</strong> — Devise : FCFA
            </span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <a href="./parametres.html" id="tg-network-badge" class="btn btn-sm btn-outline-success fw-bold">● En ligne</a>
            <button type="button" id="btn-shell-sync" class="btn tg-btn-navy btn-sm">Synchroniser maintenant</button>
          </div>
        </header>
      `;
    }

    const mobileNavEl = document.getElementById("tg-mobilenav-mount");
    if (mobileNavEl) {
      const mobileItems = [
        { key: "dashboard", label: "Accueil", href: "./index.html" },
        { key: "clients", label: "Clients", href: "./clients.html" },
        { key: "prestations", label: "Prestations", href: "./prestations.html" },
        { key: "paiements", label: "Paiements", href: "./paiements.html" },
        { key: "devis-factures", label: "Devis/Fact.", href: "./devis-factures.html" },
      ];
      mobileNavEl.innerHTML = `
        <nav class="tg-mobile-nav d-lg-none">
          ${mobileItems
            .map(
              (m) =>
                `<a href="${m.href}" class="${m.key === activeKey ? "active" : ""}">${m.label}</a>`
            )
            .join("")}
        </nav>
      `;
    }

    const logoutBtn = document.getElementById("btn-shell-logout");
    if (logoutBtn) {
      logoutBtn.onclick = async () => {
        try {
          await TechGestSupabase.logout();
        } catch {}
        await TechGestDB.clearWorkspace();
        window.location.href = "./login.html";
      };
    }

    const syncBtn = document.getElementById("btn-shell-sync");
    if (syncBtn) {
      syncBtn.onclick = () => triggerSyncNow();
    }

    updateNetworkBadge();
  }

  function updateNetworkBadge() {
    const online = navigator.onLine;
    const badge = document.getElementById("tg-network-badge");
    const pendingCount = syncQueue.length;
    if (badge) {
      badge.className = `btn btn-sm fw-bold ${
        online ? "btn-outline-success" : "btn-warning text-dark"
      }`;
      badge.innerHTML = `${online ? "● En ligne" : "● Hors ligne"} ${
        pendingCount > 0 ? `<span class="badge bg-danger ms-1">${pendingCount}</span>` : ""
      }`;
    }
  }

  async function triggerSyncNow() {
    if (!workspace) return;
    await TechGestSync.syncNow(
      workspace,
      (updatedWs, updatedQ) => {
        workspace = updatedWs;
        syncQueue = updatedQ;
        updateNetworkBadge();
        if (onDataRefreshCallback) onDataRefreshCallback(workspace, syncQueue);
      },
      showToast
    );
  }

  async function dispatchOperation(opMeta, optimisticFn) {
    if (!workspace) return;
    const uuid = TechGestDB.generateUUID();
    const userId = String(workspace.user.id);

    const op = {
      operationUuid: uuid,
      userId,
      entityType: opMeta.entityType,
      operationType: opMeta.operationType,
      entityId: opMeta.entityId,
      baseVersion: opMeta.baseVersion,
      forceOverwrite: opMeta.forceOverwrite || false,
      payload: Object.assign({}, opMeta.payload, { clientUuid: uuid }),
      label: opMeta.label,
      createdAt: new Date().toISOString(),
      status: "PENDING",
      attempts: 0,
    };

    if (TechGestSupabase.isConfigured() && userId !== "local-demo-uuid") {
      await TechGestDB.enqueueOperation(op);
    }

    if (optimisticFn) {
      workspace = optimisticFn(workspace);
      await TechGestDB.saveWorkspace(workspace);
    }

    syncQueue = await TechGestDB.getQueue(userId);
    updateNetworkBadge();
    if (onDataRefreshCallback) onDataRefreshCallback(workspace, syncQueue);

    if (navigator.onLine && TechGestSupabase.isConfigured() && userId !== "local-demo-uuid") {
      await triggerSyncNow();
    } else if (!navigator.onLine) {
      showToast(
        "info",
        `Enregistré localement (${opMeta.label}). Synchronisation automatique avec Supabase au retour d'Internet.`
      );
    }
  }

  async function initPage(activeKey, onReady) {
    onDataRefreshCallback = onReady;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }

    const cached = await TechGestDB.loadWorkspace();
    try {
      if (TechGestSupabase.isConfigured()) {
        const fresh = await TechGestSupabase.fetchWorkspace();
        if (fresh) {
          workspace = fresh;
          await TechGestDB.saveWorkspace(workspace);
        } else if (cached) {
          workspace = cached;
        }
      } else if (cached) {
        workspace = cached;
      }
    } catch {
      if (cached) {
        workspace = cached;
      }
    }

    if (!workspace) {
      window.location.href = "./login.html";
      return;
    }

    syncQueue = await TechGestDB.getQueue(String(workspace.user.id));
    renderShell(activeKey);

    window.addEventListener("online", () => {
      updateNetworkBadge();
      showToast("info", "Connexion Internet rétablie : synchronisation avec Supabase...");
      triggerSyncNow();
    });

    window.addEventListener("offline", () => {
      updateNetworkBadge();
      showToast("warning", "Mode hors ligne activé (IndexedDB).");
    });

    if (onReady) {
      onReady(workspace, syncQueue);
    }
  }

  function getWorkspace() {
    return workspace;
  }

  function getSyncQueue() {
    return syncQueue;
  }

  function clientName(clientId) {
    const c = (workspace?.clients || []).find((x) => Number(x.id) === Number(clientId));
    return c ? c.full_name : "Client";
  }

  return {
    initPage,
    dispatchOperation,
    triggerSyncNow,
    getWorkspace,
    getSyncQueue,
    clientName,
    showToast,
    esc,
  };
})();
