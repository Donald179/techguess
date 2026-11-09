/**
 * TECHGEST — Script dédié Page Gestion des Prestations (assets/js/prestations.js)
 */
(() => {
  const WORK_STATUSES = ["En attente", "En cours", "Terminée", "Annulée"];

  function renderPrestations(ws) {
    const year = new Date().getFullYear();
    document.getElementById("input-auto-ref").value = `PREST-${year}-${String((ws.prestations || []).length + 1).padStart(4, "0")}`;

    const clientSel = document.getElementById("select-prestation-client");
    if (clientSel) {
      const currentVal = clientSel.value;
      clientSel.innerHTML = (ws.clients || [])
        .map((c) => `<option value="${c.id}">${TechGestLayout.esc(c.full_name)}</option>`)
        .join("");
      if (currentVal) clientSel.value = currentVal;
    }

    const q = (document.getElementById("filter-prest-search").value || "").trim().toLowerCase();
    const cat = document.getElementById("filter-prest-cat").value;
    const st = document.getElementById("filter-prest-status").value;

    const filtered = (ws.prestations || []).filter((p) => {
      if (cat !== "ALL" && p.category !== cat) return false;
      if (st !== "ALL" && p.work_status !== st) return false;
      if (!q) return true;
      return (
        (p.reference || "").toLowerCase().includes(q) ||
        (p.service_name || "").toLowerCase().includes(q) ||
        TechGestLayout.clientName(p.client_id).toLowerCase().includes(q)
      );
    });

    const tbody = document.getElementById("prestations-tbody");
    tbody.innerHTML =
      filtered
        .map((p) => {
          const remaining = Math.max(0, Number(p.price) - Number(p.paid_amount));
          return `
            <tr>
              <td><strong class="tg-text-blue">${TechGestLayout.esc(p.reference)}</strong><br><small class="text-muted">${TechGestLayout.esc(p.service_date)}</small></td>
              <td><strong>${TechGestLayout.esc(p.service_name)}</strong><br><small class="text-muted">Client : ${TechGestLayout.esc(TechGestLayout.clientName(p.client_id))}</small></td>
              <td><span class="badge badge-soft-blue">${TechGestLayout.esc(p.category)}</span></td>
              <td>
                <select class="form-select form-select-sm tg-status-select" data-work-status="${p.id}">
                  ${WORK_STATUSES.map((s) => `<option ${p.work_status === s ? "selected" : ""}>${s}</option>`).join("")}
                </select>
              </td>
              <td><span class="badge ${p.payment_status === "Payé" ? "badge-soft-green" : p.payment_status === "Partiel" ? "badge-soft-amber" : "badge-soft-red"}">${TechGestLayout.esc(p.payment_status)}</span></td>
              <td class="text-end fw-bold">${TechGestExport.formatFCFA(p.price)}<br><small class="${remaining > 0 ? "text-warning" : "tg-text-green"}">${remaining > 0 ? `Reste : ${TechGestExport.formatFCFA(remaining)}` : "Soldé"}</small></td>
              <td class="text-end text-nowrap">
                ${remaining > 0 && p.work_status !== "Annulée" ? `<a href="./paiements.html?prestation=${p.id}" class="btn tg-btn-green btn-sm py-0 px-2">Encaisser</a>` : ""}
                <button class="btn btn-outline-danger btn-sm py-0 px-2" data-del-prest="${p.id}">Suppr.</button>
              </td>
            </tr>`;
        })
        .join("") || `<tr><td colspan="7" class="text-center py-4 text-muted">Aucune prestation enregistrée.</td></tr>`;

    tbody.querySelectorAll("[data-work-status]").forEach((sel) => {
      sel.onchange = async () => {
        const id = Number(sel.getAttribute("data-work-status"));
        const p = ws.prestations.find((x) => Number(x.id) === id);
        if (!p) return;
        const workStatus = sel.value;
        await TechGestLayout.dispatchOperation(
          {
            entityType: "prestation",
            operationType: "UPDATE",
            entityId: id,
            baseVersion: Number(p.version || 1),
            payload: { id, workStatus },
            label: `Statut ${p.reference} → ${workStatus}`,
          },
          (prev) => {
            const target = prev.prestations.find((x) => Number(x.id) === id);
            if (target) target.work_status = workStatus;
            return prev;
          }
        );
      };
    });

    tbody.querySelectorAll("[data-del-prest]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-del-prest"));
        if (!window.confirm("Supprimer cette prestation ?")) return;
        await TechGestLayout.dispatchOperation(
          {
            entityType: "prestation",
            operationType: "DELETE",
            entityId: id,
            payload: { id },
            label: `Suppression prestation #${id}`,
          },
          (prev) => {
            prev.prestations = prev.prestations.filter((x) => Number(x.id) !== id);
            return prev;
          }
        );
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("input-service-date").value = new Date().toISOString().slice(0, 10);

    ["filter-prest-search", "filter-prest-cat", "filter-prest-status"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        const ws = TechGestLayout.getWorkspace();
        if (ws) renderPrestations(ws);
      });
    });

    document.getElementById("form-add-prestation").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        clientId: Number(fd.get("clientId")),
        serviceName: fd.get("serviceName"),
        category: fd.get("category"),
        price: Number(fd.get("price")),
        serviceDate: fd.get("serviceDate"),
        workStatus: fd.get("workStatus"),
        description: fd.get("description") || "",
        paymentStatus: "Impayé",
      };
      e.target.reset();
      document.getElementById("input-service-date").value = new Date().toISOString().slice(0, 10);

      await TechGestLayout.dispatchOperation(
        {
          entityType: "prestation",
          operationType: "CREATE",
          payload,
          label: `Nouvelle prestation : ${payload.serviceName}`,
        },
        (prev) => {
          prev.prestations.unshift({
            id: Date.now(),
            client_id: payload.clientId,
            reference: `PREST-${new Date().getFullYear()}-${String(prev.prestations.length + 1).padStart(4, "0")}`,
            service_name: payload.serviceName,
            category: payload.category,
            description: payload.description,
            price: payload.price,
            paid_amount: 0,
            service_date: payload.serviceDate,
            work_status: payload.workStatus,
            payment_status: "Impayé",
            version: 1,
          });
          return prev;
        }
      );
    };

    TechGestLayout.initPage("prestations", (ws) => renderPrestations(ws));
  });
})();
