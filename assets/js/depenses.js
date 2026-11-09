/**
 * TECHGEST — Script dédié Page Gestion des Dépenses (assets/js/depenses.js)
 */
(() => {
  function renderExpenses(ws) {
    const catFilter = document.getElementById("filter-exp-cat").value;
    const periodFilter = document.getElementById("filter-exp-period").value;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const y = `${now.getFullYear()}-`;

    const filtered = (ws.expenses || []).filter((ex) => {
      if (catFilter !== "ALL" && ex.category !== catFilter) return false;
      if (periodFilter === "month" && !(ex.expense_date || "").startsWith(ym)) return false;
      if (periodFilter === "year" && !(ex.expense_date || "").startsWith(y)) return false;
      return true;
    });

    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    document.getElementById("total-expenses-banner").textContent = `Total dépenses : ${TechGestExport.formatFCFA(total)}`;

    const tbody = document.getElementById("expenses-tbody");
    tbody.innerHTML =
      filtered
        .map(
          (ex) => `
          <tr>
            <td>${TechGestLayout.esc(ex.expense_date)}</td>
            <td class="fw-bold">${TechGestLayout.esc(ex.title)}</td>
            <td><span class="badge badge-soft-blue">${TechGestLayout.esc(ex.category)}</span></td>
            <td class="text-muted">${TechGestLayout.esc(ex.description || "—")}</td>
            <td class="text-end fw-bold">${TechGestExport.formatFCFA(ex.amount)}</td>
            <td class="text-end"><button class="btn btn-outline-danger btn-sm py-0 px-2" data-del-exp="${ex.id}">Suppr.</button></td>
          </tr>`
        )
        .join("") || `<tr><td colspan="6" class="text-center py-4 text-muted">Aucune dépense enregistrée.</td></tr>`;

    tbody.querySelectorAll("[data-del-exp]").forEach((btn) => {
      btn.onclick = async () => {
        const id = Number(btn.getAttribute("data-del-exp"));
        if (!window.confirm("Supprimer cette dépense ?")) return;
        await TechGestLayout.dispatchOperation(
          {
            entityType: "expense",
            operationType: "DELETE",
            entityId: id,
            payload: { id },
            label: `Suppression dépense #${id}`,
          },
          (prev) => {
            prev.expenses = prev.expenses.filter((x) => Number(x.id) !== id);
            return prev;
          }
        );
      };
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("input-expense-date").value = new Date().toISOString().slice(0, 10);

    ["filter-exp-cat", "filter-exp-period"].forEach((id) => {
      document.getElementById(id).onchange = () => {
        const ws = TechGestLayout.getWorkspace();
        if (ws) renderExpenses(ws);
      };
    });

    document.getElementById("form-add-expense").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const payload = {
        title: fd.get("title"),
        category: fd.get("category"),
        amount: Number(fd.get("amount")),
        expenseDate: fd.get("expenseDate"),
        description: fd.get("description") || "",
      };
      e.target.reset();
      document.getElementById("input-expense-date").value = new Date().toISOString().slice(0, 10);

      await TechGestLayout.dispatchOperation(
        {
          entityType: "expense",
          operationType: "CREATE",
          payload,
          label: `Dépense : ${payload.title}`,
        },
        (prev) => {
          prev.expenses.unshift({
            id: Date.now(),
            title: payload.title,
            category: payload.category,
            amount: payload.amount,
            expense_date: payload.expenseDate,
            description: payload.description,
          });
          return prev;
        }
      );
    };

    TechGestLayout.initPage("depenses", (ws) => renderExpenses(ws));
  });
})();
