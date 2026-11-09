/**
 * TECHGEST — Script dédié Page Devis & Factures PDF (assets/js/devis-factures.js)
 */
(() => {
  function renderQuotesInvoices(ws) {
    document.getElementById("select-quote-client").innerHTML = (ws.clients || [])
      .map((c) => `<option value="${c.id}">${TechGestLayout.esc(c.full_name)}</option>`)
      .join("");

    document.getElementById("select-invoice-prestation").innerHTML = (ws.prestations || [])
      .map(
        (p) =>
          `<option value="${p.id}">${TechGestLayout.esc(p.reference)} — ${TechGestLayout.esc(TechGestLayout.clientName(p.client_id))} (${TechGestExport.formatFCFA(p.price)})</option>`
      )
      .join("");

    const quotes = ws.quotes || [];
    document.getElementById("quotes-list-title").textContent = `Devis enregistrés (${quotes.length})`;
    document.getElementById("quotes-list").innerHTML =
      quotes
        .map(
          (q) => `
          <div class="tg-doc-item d-flex justify-content-between align-items-center gap-2 small">
            <div>
              <strong class="tg-text-blue">${TechGestLayout.esc(q.quote_number)}</strong> — ${TechGestLayout.esc(q.title)}<br>
              <span class="text-muted">${TechGestLayout.esc(TechGestLayout.clientName(q.client_id))} • ${TechGestExport.formatFCFA(q.total_amount)}</span>
            </div>
            <div>
              ${
                q.status !== "Converti"
                  ? `<button class="btn tg-btn-green btn-sm" data-convert-quote="${q.id}">Convertir en prestation</button>`
                  : `<span class="badge badge-soft-green">Converti</span>`
              }
            </div>
          </div>`
        )
        .join("") || `<p class="text-muted small mb-0">Aucun devis enregistré.</p>`;

    const invoices = ws.invoices || [];
    document.getElementById("invoices-list-title").textContent = `Factures générées (${invoices.length})`;
    document.getElementById("invoices-list").innerHTML =
      invoices
        .map(
          (inv) => `
          <div class="tg-doc-item d-flex justify-content-between align-items-center gap-2 small">
            <div>
              <strong>${TechGestLayout.esc(inv.invoice_number)}</strong> — ${TechGestLayout.esc(inv.title)}<br>
              <span class="text-muted">${TechGestLayout.esc(TechGestLayout.clientName(inv.client_id))} • ${TechGestExport.formatFCFA(inv.total_amount)} (${TechGestLayout.esc(inv.status)})</span>
            </div>
            <button class="btn tg-btn-primary btn-sm" data-print-inv="${inv.id}">Facture PDF</button>
          </div>`
        )
        .join("") || `<p class="text-muted small mb-0">Aucune facture générée.</p>`;

    document.querySelectorAll("[data-convert-quote]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-convert-quote"));
        await TechGestLayout.dispatchOperation(
          {
            entityType: "quote",
            operationType: "CONVERT_QUOTE",
            entityId: id,
            payload: { id },
            label: `Conversion devis #${id} en prestation`,
          },
          (prev) => {
            const q = prev.quotes.find((x) => Number(x.id) === id);
            if (q) {
              q.status = "Converti";
              const today = new Date().toISOString().slice(0, 10);
              const year = new Date().getFullYear();
              prev.prestations.unshift({
                id: Date.now(),
                client_id: q.client_id,
                reference: `PREST-${year}-${String(prev.prestations.length + 1).padStart(4, "0")}`,
                service_name: q.title,
                category: q.category,
                price: q.total_amount,
                paid_amount: 0,
                service_date: today,
                work_status: "En cours",
                payment_status: "Impayé",
              });
              prev.invoices.unshift({
                id: Date.now() + 1,
                client_id: q.client_id,
                invoice_number: `FACT-${year}-${String(prev.invoices.length + 1).padStart(4, "0")}`,
                title: q.title,
                issue_date: today,
                due_date: today,
                total_amount: q.total_amount,
                paid_amount: 0,
                status: "Émise",
                items: q.items || [],
              });
            }
            return prev;
          }
        );
        TechGestLayout.showToast("success", "Devis converti en prestation et facture !");
      };
    });

    document.querySelectorAll("[data-print-inv]").forEach((btn) => {
      btn.onclick = () => {
        const id = Number(btn.getAttribute("data-print-inv"));
        const inv = (ws.invoices || []).find((x) => Number(x.id) === id);
        const cli = (ws.clients || []).find((c) => Number(c.id) === Number(inv.client_id));
        if (inv) TechGestExport.openInvoicePDF(inv, cli, ws.profile);
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("form-add-quote").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const qty = Math.max(1, Number(fd.get("itemQty") || 1));
      const unitPrice = Math.max(0, Number(fd.get("itemPrice") || 0));
      const payload = {
        clientId: Number(fd.get("clientId")),
        category: fd.get("category"),
        title: fd.get("title"),
        notes: "Devis valable 30 jours.",
        status: "Envoyé",
        items: [{ description: fd.get("itemDesc"), quantity: qty, unitPrice }],
      };
      e.target.reset();

      await TechGestLayout.dispatchOperation(
        {
          entityType: "quote",
          operationType: "CREATE",
          payload,
          label: `Création devis : ${payload.title}`,
        },
        (prev) => {
          const today = new Date().toISOString().slice(0, 10);
          prev.quotes.unshift({
            id: Date.now(),
            client_id: payload.clientId,
            quote_number: `DEV-${new Date().getFullYear()}-${String(prev.quotes.length + 1).padStart(4, "0")}`,
            title: payload.title,
            category: payload.category,
            issue_date: today,
            valid_until: today,
            total_amount: qty * unitPrice,
            status: "Envoyé",
            items: [{ description: payload.items[0].description, quantity: qty, unit_price: unitPrice, total_price: qty * unitPrice }],
          });
          return prev;
        }
      );
    };

    document.getElementById("form-generate-invoice").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const prestationId = Number(fd.get("prestationId"));
      if (!prestationId) return;

      await TechGestLayout.dispatchOperation(
        {
          entityType: "invoice",
          operationType: "CREATE",
          payload: { prestationId },
          label: `Génération facture prestation #${prestationId}`,
        },
        (prev) => {
          const prest = prev.prestations.find((p) => Number(p.id) === prestationId);
          if (prest) {
            const today = new Date().toISOString().slice(0, 10);
            prev.invoices.unshift({
              id: Date.now(),
              client_id: prest.client_id,
              prestation_id: prest.id,
              invoice_number: `FACT-${new Date().getFullYear()}-${String(prev.invoices.length + 1).padStart(4, "0")}`,
              title: prest.service_name,
              issue_date: today,
              due_date: today,
              total_amount: prest.price,
              paid_amount: prest.paid_amount,
              status: Number(prest.paid_amount) >= Number(prest.price) ? "Payée" : "Émise",
              items: [{ description: prest.service_name, quantity: 1, unit_price: prest.price, total_price: prest.price }],
            });
          }
          return prev;
        }
      );
      TechGestLayout.showToast("success", "Facture générée avec succès !");
    };

    TechGestLayout.initPage("devis-factures", (ws) => renderQuotesInvoices(ws));
  });
})();
