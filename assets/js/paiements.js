/**
 * TECHGEST — Script dédié Page Gestion des Paiements (assets/js/paiements.js)
 */
(() => {
  function syncSelectedPrestationBalance(ws) {
    const sel = document.getElementById("select-payment-prestation");
    const amtInput = document.getElementById("input-payment-amount");
    const prest = (ws.prestations || []).find((p) => Number(p.id) === Number(sel.value));
    if (prest && amtInput) {
      amtInput.value = Math.max(0, Number(prest.price) - Number(prest.paid_amount));
    }
  }

  function renderPayments(ws) {
    const unpaidPrests = (ws.prestations || []).filter(
      (p) => p.work_status !== "Annulée" && Number(p.price) > Number(p.paid_amount)
    );

    const sel = document.getElementById("select-payment-prestation");
    const params = new URLSearchParams(window.location.search);
    const preselectId = Number(params.get("prestation") || 0);

    sel.innerHTML =
      unpaidPrests
        .map((p) => {
          const rem = Math.max(0, Number(p.price) - Number(p.paid_amount));
          return `<option value="${p.id}">${TechGestLayout.esc(p.reference)} — ${TechGestLayout.esc(TechGestLayout.clientName(p.client_id))} : ${TechGestLayout.esc(p.service_name)} (Solde: ${TechGestExport.formatFCFA(rem)})</option>`;
        })
        .join("") || `<option value="">Toutes les prestations sont soldées</option>`;

    if (preselectId && unpaidPrests.some((x) => Number(x.id) === preselectId)) {
      sel.value = String(preselectId);
    }
    syncSelectedPrestationBalance(ws);

    const methodFilter = document.getElementById("filter-pay-method").value;
    const periodFilter = document.getElementById("filter-pay-period").value;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const y = `${now.getFullYear()}-`;

    const filtered = (ws.payments || []).filter((pay) => {
      if (methodFilter !== "ALL" && pay.payment_method !== methodFilter) return false;
      if (periodFilter === "month" && !(pay.payment_date || "").startsWith(ym)) return false;
      if (periodFilter === "year" && !(pay.payment_date || "").startsWith(y)) return false;
      return true;
    });

    const total = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
    document.getElementById("total-collected-banner").textContent = `Total encaissé : ${TechGestExport.formatFCFA(total)}`;

    const tbody = document.getElementById("payments-tbody");
    tbody.innerHTML =
      filtered
        .map((pay) => {
          const prest = (ws.prestations || []).find((x) => Number(x.id) === Number(pay.prestation_id));
          const rem = prest ? Math.max(0, Number(prest.price) - Number(prest.paid_amount)) : 0;
          return `
            <tr>
              <td><strong>${TechGestLayout.esc(pay.reference)}</strong><br><small class="text-muted">${TechGestLayout.esc(pay.payment_date)}</small></td>
              <td class="fw-semibold">${TechGestLayout.esc(TechGestLayout.clientName(pay.client_id))}</td>
              <td><strong class="tg-text-blue">${TechGestLayout.esc(prest?.reference || "—")}</strong> ${TechGestLayout.esc(prest?.service_name || "")}</td>
              <td><span class="badge badge-soft-blue">${TechGestLayout.esc(pay.payment_method)}</span></td>
              <td>${rem === 0 ? `<span class="badge badge-soft-green">Soldée</span>` : `<span class="text-warning fw-bold">Reste : ${TechGestExport.formatFCFA(rem)}</span>`}</td>
              <td class="text-end fw-bold tg-text-green">+${TechGestExport.formatFCFA(pay.amount)}</td>
              <td class="text-end"><button class="btn btn-outline-danger btn-sm py-0 px-2" data-del-pay="${pay.id}">Annuler</button></td>
            </tr>`;
        })
        .join("") || `<tr><td colspan="7" class="text-center py-4 text-muted">Aucune transaction enregistrée.</td></tr>`;

    tbody.querySelectorAll("[data-del-pay]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-del-pay"));
        if (!window.confirm("Annuler ce paiement et recalculer le solde ?")) return;
        await TechGestLayout.dispatchOperation(
          {
            entityType: "payment",
            operationType: "DELETE",
            entityId: id,
            payload: { id },
            label: `Annulation paiement #${id}`,
          },
          (prev) => {
            const pay = prev.payments.find((x) => Number(x.id) === id);
            prev.payments = prev.payments.filter((x) => Number(x.id) !== id);
            if (pay) {
              const pr = prev.prestations.find((x) => Number(x.id) === Number(pay.prestation_id));
              if (pr) {
                pr.paid_amount = Math.max(0, Number(pr.paid_amount) - Number(pay.amount));
                pr.payment_status = pr.paid_amount >= Number(pr.price) ? "Payé" : pr.paid_amount > 0 ? "Partiel" : "Impayé";
              }
            }
            return prev;
          }
        );
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("input-payment-date").value = new Date().toISOString().slice(0, 10);

    document.getElementById("select-payment-prestation").onchange = () => {
      const ws = TechGestLayout.getWorkspace();
      if (ws) syncSelectedPrestationBalance(ws);
    };

    ["filter-pay-method", "filter-pay-period"].forEach((id) => {
      document.getElementById(id).onchange = () => {
        const ws = TechGestLayout.getWorkspace();
        if (ws) renderPayments(ws);
      };
    });

    document.getElementById("form-add-payment").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const prestationId = Number(fd.get("prestationId"));
      if (!prestationId) return;
      const payload = {
        prestationId,
        amount: Number(fd.get("amount")),
        paymentMethod: fd.get("paymentMethod"),
        paymentDate: fd.get("paymentDate"),
        notes: fd.get("notes") || "",
      };

      await TechGestLayout.dispatchOperation(
        {
          entityType: "payment",
          operationType: "CREATE",
          payload,
          label: `Paiement ${payload.amount} FCFA (${payload.paymentMethod})`,
        },
        (prev) => {
          const prest = prev.prestations.find((x) => Number(x.id) === payload.prestationId);
          if (prest) {
            prest.paid_amount = Number(prest.paid_amount) + payload.amount;
            prest.payment_status = prest.paid_amount >= Number(prest.price) ? "Payé" : "Partiel";
            prev.payments.unshift({
              id: Date.now(),
              client_id: prest.client_id,
              prestation_id: prest.id,
              reference: `PAY-${new Date().getFullYear()}-${String(prev.payments.length + 1).padStart(4, "0")}`,
              amount: payload.amount,
              payment_method: payload.paymentMethod,
              payment_date: payload.paymentDate,
              notes: payload.notes,
            });
          }
          return prev;
        }
      );
    };

    TechGestLayout.initPage("paiements", (ws) => renderPayments(ws));
  });
})();
