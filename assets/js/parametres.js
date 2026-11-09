/**
 * TECHGEST — Script dédié Page Paramètres & Synchronisation Hors Ligne (assets/js/parametres.js)
 */
(() => {
  function renderSettings(ws, queue = []) {
    const prof = ws.profile || {};
    document.getElementById("set-biz-name").value = prof.business_name || "TECHGEST Solutions IT";
    document.getElementById("set-tagline").value = prof.tagline || "";
    document.getElementById("set-phone").value = prof.phone || "";
    document.getElementById("set-email").value = prof.email || "";
    document.getElementById("set-address").value = prof.address || "";
    document.getElementById("set-tax").value = prof.tax_id || "";
    document.getElementById("set-footer").value = prof.invoice_footer || "";

    const container = document.getElementById("sync-queue-container");
    if (!queue || queue.length === 0) {
      container.innerHTML = `
        <div class="alert alert-success small mb-0">
          <strong>Toutes vos données sont synchronisées.</strong><br>
          Aucune opération locale en attente dans IndexedDB.
        </div>`;
      return;
    }

    container.innerHTML = queue
      .map(
        (op) => `
        <div class="tg-queue-card ${op.status === "CONFLICT" ? "conflict" : ""} small">
          <div class="d-flex justify-content-between align-items-center">
            <strong>[${TechGestLayout.esc(op.operationType)}] ${TechGestLayout.esc(op.label)}</strong>
            <span class="badge ${op.status === "CONFLICT" ? "bg-danger" : "bg-warning text-dark"}">${TechGestLayout.esc(op.status)}</span>
          </div>
          <div class="text-muted mt-1" style="font-size:11px;">UUID : ${TechGestLayout.esc(op.operationUuid)} • Tentatives : ${op.attempts}</div>
          ${
            op.status === "CONFLICT"
              ? `<div class="mt-2 d-flex gap-2">
                  <button class="btn btn-primary btn-sm" data-keep-local="${TechGestLayout.esc(op.operationUuid)}">Conserver ma version locale</button>
                  <button class="btn btn-outline-secondary btn-sm" data-accept-server="${TechGestLayout.esc(op.operationUuid)}">Accepter la version serveur</button>
                </div>`
              : ""
          }
        </div>`
      )
      .join("");

    container.querySelectorAll("[data-keep-local]").forEach((btn) => {
      btn.onclick = async () => {
        const uuid = btn.getAttribute("data-keep-local");
        const op = queue.find((x) => x.operationUuid === uuid);
        if (!op) return;
        op.status = "PENDING";
        op.forceOverwrite = true;
        await TechGestDB.enqueueOperation(op);
        await TechGestLayout.triggerSyncNow();
      };
    });

    container.querySelectorAll("[data-accept-server]").forEach((btn) => {
      btn.onclick = async () => {
        const uuid = btn.getAttribute("data-accept-server");
        await TechGestDB.removeConfirmedOperations([uuid]);
        await TechGestLayout.triggerSyncNow();
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-page-sync-now").onclick = () => TechGestLayout.triggerSyncNow();

    document.getElementById("form-settings-profile").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      await TechGestLayout.dispatchOperation(
        {
          entityType: "profile",
          operationType: "UPDATE",
          payload,
          label: "Mise à jour profil entreprise",
        },
        (prev) => {
          if (prev.profile) {
            Object.assign(prev.profile, {
              business_name: payload.businessName,
              tagline: payload.tagline,
              phone: payload.phone,
              email: payload.email,
              address: payload.address,
              tax_id: payload.taxId,
              invoice_footer: payload.invoiceFooter,
            });
          }
          return prev;
        }
      );
      TechGestLayout.showToast("success", "Profil professionnel enregistré !");
    };

    TechGestLayout.initPage("parametres", (ws, q) => renderSettings(ws, q));
  });
})();
