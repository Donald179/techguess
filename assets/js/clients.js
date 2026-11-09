/**
 * TECHGEST — Script dédié Page Gestion des Clients (assets/js/clients.js)
 */
(() => {
  let showArchived = false;
  let searchQuery = "";
  let modalInstance = null;

  function openClientModal(title, html) {
    document.getElementById("clientModalTitle").textContent = title;
    document.getElementById("clientModalBody").innerHTML = html;
    if (!modalInstance && window.bootstrap) {
      modalInstance = new window.bootstrap.Modal(document.getElementById("clientModal"));
    }
    if (modalInstance) modalInstance.show();
  }

  function closeClientModal() {
    if (modalInstance) modalInstance.hide();
  }

  function renderClients(ws) {
    const q = searchQuery.trim().toLowerCase();
    const list = (ws.clients || []).filter((c) => {
      if (Boolean(c.is_archived) !== showArchived) return false;
      if (!q) return true;
      return (
        (c.full_name || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.address || "").toLowerCase().includes(q)
      );
    });

    const grid = document.getElementById("clients-grid");
    if (list.length === 0) {
      grid.innerHTML = `<div class="col-12"><div class="tg-card p-5 text-center text-muted">Aucun client trouvé.</div></div>`;
      return;
    }

    grid.innerHTML = list
      .map((c) => {
        const cPrests = (ws.prestations || []).filter((p) => Number(p.client_id) === Number(c.id) && p.work_status !== "Annulée");
        const totalBilled = cPrests.reduce((s, p) => s + Number(p.price || 0), 0);
        const unpaid = cPrests.reduce((s, p) => s + Math.max(0, Number(p.price || 0) - Number(p.paid_amount || 0)), 0);

        return `
          <div class="col-md-6 col-xl-4">
            <div class="tg-card tg-client-card p-3 h-100 d-flex flex-column justify-content-between">
              <div>
                <div class="d-flex justify-content-between align-items-start mb-2">
                  <span class="badge badge-soft-blue">${TechGestLayout.esc(c.client_type)}</span>
                </div>
                <h3 class="h6 fw-bold mb-2">${TechGestLayout.esc(c.full_name)}</h3>
                <div class="small text-muted vstack gap-1">
                  <div><strong>Tél :</strong> ${TechGestLayout.esc(c.phone || "—")}</div>
                  <div><strong>Email :</strong> ${TechGestLayout.esc(c.email || "—")}</div>
                  <div><strong>Adresse :</strong> ${TechGestLayout.esc(c.address || "—")}</div>
                </div>
                ${c.notes ? `<div class="mt-2 p-2 rounded-3 small text-muted" style="background:#F3F6FB;">${TechGestLayout.esc(c.notes)}</div>` : ""}
              </div>

              <div class="mt-3 pt-3 border-top">
                <div class="row g-2 mb-3">
                  <div class="col-4"><div class="tg-client-stat-box"><small class="text-muted d-block" style="font-size:10px;">Prestations</small><strong class="small">${cPrests.length}</strong></div></div>
                  <div class="col-4"><div class="tg-client-stat-box"><small class="text-muted d-block" style="font-size:10px;">Facturé</small><strong class="small">${TechGestExport.formatFCFA(totalBilled)}</strong></div></div>
                  <div class="col-4"><div class="tg-client-stat-box"><small class="text-muted d-block" style="font-size:10px;">Impayés</small><strong class="small ${unpaid > 0 ? "text-warning" : "tg-text-green"}">${TechGestExport.formatFCFA(unpaid)}</strong></div></div>
                </div>

                <div class="d-flex gap-1">
                  <button class="btn tg-btn-navy btn-sm flex-grow-1" data-view="${c.id}">Fiche &amp; Historique</button>
                  <button class="btn btn-outline-secondary btn-sm" data-edit="${c.id}">Modifier</button>
                  <button class="btn btn-outline-warning btn-sm" data-arch="${c.id}">${c.is_archived ? "Restaurer" : "Archiver"}</button>
                  <button class="btn btn-outline-danger btn-sm" data-del="${c.id}">Suppr.</button>
                </div>
              </div>
            </div>
          </div>`;
      })
      .join("");

    // Consulter Fiche & Historique
    grid.querySelectorAll("[data-view]").forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.getAttribute("data-view"));
        const c = ws.clients.find((x) => Number(x.id) === id);
        if (!c) return;
        const cPrests = (ws.prestations || []).filter((p) => Number(p.client_id) === id);
        const cPays = (ws.payments || []).filter((p) => Number(p.client_id) === id);

        openClientModal(
          `Fiche Client — ${c.full_name}`,
          `
            <div class="p-3 rounded-3 mb-3 small" style="background:#F3F6FB;">
              <div><strong>Type :</strong> ${TechGestLayout.esc(c.client_type)} | <strong>Téléphone :</strong> ${TechGestLayout.esc(c.phone || "—")}</div>
              <div><strong>Email :</strong> ${TechGestLayout.esc(c.email || "—")} | <strong>Adresse :</strong> ${TechGestLayout.esc(c.address || "—")}</div>
              <div class="mt-1"><strong>Notes :</strong> ${TechGestLayout.esc(c.notes || "Aucune note")}</div>
            </div>
            <h6 class="fw-bold small">Historique des prestations (${cPrests.length})</h6>
            <ul class="list-group list-group-flush small mb-3">
              ${cPrests.map((p) => `<li class="list-group-item d-flex justify-content-between"><span><strong>${TechGestLayout.esc(p.reference)}</strong> — ${TechGestLayout.esc(p.service_name)} (${TechGestLayout.esc(p.work_status)})</span><strong>${TechGestExport.formatFCFA(p.price)}</strong></li>`).join("") || `<li class="list-group-item text-muted">Aucune prestation</li>`}
            </ul>
            <h6 class="fw-bold small">Historique des paiements (${cPays.length})</h6>
            <ul class="list-group list-group-flush small">
              ${cPays.map((pay) => `<li class="list-group-item d-flex justify-content-between"><span>${TechGestLayout.esc(pay.reference)} • ${TechGestLayout.esc(pay.payment_date)} (${TechGestLayout.esc(pay.payment_method)})</span><strong class="tg-text-green">+${TechGestExport.formatFCFA(pay.amount)}</strong></li>`).join("") || `<li class="list-group-item text-muted">Aucun paiement</li>`}
            </ul>
          `
        );
      };
    });

    // Modifier Client
    grid.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.getAttribute("data-edit"));
        const c = ws.clients.find((x) => Number(x.id) === id);
        if (!c) return;
        openClientModal(
          `Modifier le client — ${c.full_name}`,
          `
            <form id="form-edit-client" class="vstack gap-3 small">
              <div><label class="fw-bold">Nom complet *</label><input class="form-control form-control-sm" name="fullName" value="${TechGestLayout.esc(c.full_name)}" required></div>
              <div class="row g-2">
                <div class="col-6"><label class="fw-bold">Téléphone</label><input class="form-control form-control-sm" name="phone" value="${TechGestLayout.esc(c.phone || "")}"></div>
                <div class="col-6"><label class="fw-bold">Email</label><input class="form-control form-control-sm" name="email" value="${TechGestLayout.esc(c.email || "")}"></div>
              </div>
              <div><label class="fw-bold">Adresse</label><input class="form-control form-control-sm" name="address" value="${TechGestLayout.esc(c.address || "")}"></div>
              <div><label class="fw-bold">Notes techniques</label><textarea class="form-control form-control-sm" name="notes" rows="3">${TechGestLayout.esc(c.notes || "")}</textarea></div>
              <button type="submit" class="btn tg-btn-primary btn-sm">Enregistrer les modifications</button>
            </form>
          `
        );
        document.getElementById("form-edit-client").onsubmit = async (ev) => {
          ev.preventDefault();
          const fd = new FormData(ev.target);
          const payload = Object.assign({ id }, Object.fromEntries(fd.entries()));
          closeClientModal();
          await TechGestLayout.dispatchOperation(
            {
              entityType: "client",
              operationType: "UPDATE",
              entityId: id,
              baseVersion: Number(c.version || 1),
              payload,
              label: `Modification client : ${payload.fullName}`,
            },
            (prev) => {
              const target = prev.clients.find((x) => Number(x.id) === id);
              if (target) {
                Object.assign(target, {
                  full_name: payload.fullName,
                  phone: payload.phone,
                  email: payload.email,
                  address: payload.address,
                  notes: payload.notes,
                  version: Number(target.version || 1) + 1,
                });
              }
              return prev;
            }
          );
        };
      };
    });

    // Archiver / Restaurer
    grid.querySelectorAll("[data-arch]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-arch"));
        const c = ws.clients.find((x) => Number(x.id) === id);
        if (!c) return;
        const nextArch = !Boolean(c.is_archived);
        await TechGestLayout.dispatchOperation(
          {
            entityType: "client",
            operationType: "UPDATE",
            entityId: id,
            baseVersion: Number(c.version || 1),
            payload: { id, isArchived: nextArch },
            label: nextArch ? `Archivage client ${c.full_name}` : `Restauration client ${c.full_name}`,
          },
          (prev) => {
            const target = prev.clients.find((x) => Number(x.id) === id);
            if (target) target.is_archived = nextArch;
            return prev;
          }
        );
      };
    });

    // Supprimer
    grid.querySelectorAll("[data-del]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-del"));
        if (!window.confirm("Supprimer définitivement ce client ?")) return;
        await TechGestLayout.dispatchOperation(
          {
            entityType: "client",
            operationType: "DELETE",
            entityId: id,
            payload: { id },
            label: `Suppression client #${id}`,
          },
          (prev) => {
            prev.clients = prev.clients.filter((x) => Number(x.id) !== id);
            return prev;
          }
        );
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-filter-active").onclick = () => {
      showArchived = false;
      document.getElementById("btn-filter-active").className = "btn tg-btn-navy";
      document.getElementById("btn-filter-archived").className = "btn btn-outline-secondary";
      const ws = TechGestLayout.getWorkspace();
      if (ws) renderClients(ws);
    };

    document.getElementById("btn-filter-archived").onclick = () => {
      showArchived = true;
      document.getElementById("btn-filter-archived").className = "btn tg-btn-navy";
      document.getElementById("btn-filter-active").className = "btn btn-outline-secondary";
      const ws = TechGestLayout.getWorkspace();
      if (ws) renderClients(ws);
    };

    document.getElementById("input-search-client").oninput = (e) => {
      searchQuery = e.target.value;
      const ws = TechGestLayout.getWorkspace();
      if (ws) renderClients(ws);
    };

    document.getElementById("form-add-client").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = Object.fromEntries(fd.entries());
      e.target.reset();
      await TechGestLayout.dispatchOperation(
        {
          entityType: "client",
          operationType: "CREATE",
          payload,
          label: `Nouveau client : ${payload.fullName}`,
        },
        (prev) => {
          prev.clients.unshift({
            id: Date.now(),
            full_name: payload.fullName,
            phone: payload.phone,
            email: payload.email,
            address: payload.address,
            client_type: payload.clientType,
            notes: payload.notes || "",
            is_archived: false,
            version: 1,
          });
          return prev;
        }
      );
    };

    TechGestLayout.initPage("clients", (ws) => renderClients(ws));
  });
})();
