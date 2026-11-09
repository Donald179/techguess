/**
 * TECHGEST — Script dédié Page Rapports Financiers (assets/js/rapports.js)
 */
(() => {
  let reportChart = null;
  let currentSummary = null;

  function renderReports(ws) {
    const validPrests = (ws.prestations || []).filter((p) => p.work_status !== "Annulée");
    const turnover = validPrests.reduce((s, p) => s + Number(p.price || 0), 0);
    const collected = (ws.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);
    const expenses = (ws.expenses || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const profit = collected - expenses;

    currentSummary = {
      turnover,
      collected,
      expenses,
      profit,
      prestationsCount: validPrests.length,
    };

    document.getElementById("rep-turnover").textContent = TechGestExport.formatFCFA(turnover);
    document.getElementById("rep-collected").textContent = TechGestExport.formatFCFA(collected);
    document.getElementById("rep-expenses").textContent = TechGestExport.formatFCFA(expenses);
    document.getElementById("rep-profit").textContent = TechGestExport.formatFCFA(profit);
    document.getElementById("rep-count").textContent = String(validPrests.length);

    // 6 derniers mois
    const now = new Date();
    const monthlyRows = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const mTurn = validPrests.filter((p) => (p.service_date || "").startsWith(pref)).reduce((s, p) => s + Number(p.price || 0), 0);
      const mColl = (ws.payments || []).filter((p) => (p.payment_date || "").startsWith(pref)).reduce((s, p) => s + Number(p.amount || 0), 0);
      const mExp = (ws.expenses || []).filter((e) => (e.expense_date || "").startsWith(pref)).reduce((s, e) => s + Number(e.amount || 0), 0);
      monthlyRows.push({ month: pref, turnover: mTurn, collected: mColl, expenses: mExp, profit: mColl - mExp });
    }

    document.getElementById("rep-monthly-tbody").innerHTML = monthlyRows
      .map(
        (r) => `
        <tr>
          <td class="fw-bold">${r.month}</td>
          <td class="text-end">${TechGestExport.formatFCFA(r.turnover)}</td>
          <td class="text-end tg-text-green fw-semibold">${TechGestExport.formatFCFA(r.collected)}</td>
          <td class="text-end">${TechGestExport.formatFCFA(r.expenses)}</td>
          <td class="text-end fw-bold">${TechGestExport.formatFCFA(r.profit)}</td>
        </tr>`
      )
      .join("");

    const canvas = document.getElementById("chart-report-monthly");
    if (canvas && typeof Chart !== "undefined") {
      if (reportChart) reportChart.destroy();
      reportChart = new Chart(canvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: monthlyRows.map((m) => m.month),
          datasets: [
            { label: "Chiffre d'affaires", data: monthlyRows.map((m) => m.turnover), backgroundColor: "#2685D8", borderRadius: 6 },
            { label: "Encaissements", data: monthlyRows.map((m) => m.collected), backgroundColor: "#16A36A", borderRadius: 6 },
            { label: "Dépenses", data: monthlyRows.map((m) => m.expenses), backgroundColor: "#94A3B8", borderRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
      });
    }

    // Top services
    const svcMap = {};
    validPrests.forEach((p) => {
      if (!svcMap[p.category]) svcMap[p.category] = { category: p.category, count: 0, total: 0 };
      svcMap[p.category].count += 1;
      svcMap[p.category].total += Number(p.price || 0);
    });
    const topServices = Object.values(svcMap).sort((a, b) => b.total - a.total);
    document.getElementById("rep-services-tbody").innerHTML = topServices
      .map(
        (s) => `<tr><td class="fw-semibold">${TechGestLayout.esc(s.category)}</td><td class="text-center">${s.count}</td><td class="text-end fw-bold tg-text-blue">${TechGestExport.formatFCFA(s.total)}</td></tr>`
      )
      .join("");

    // Top clients
    const cliMap = {};
    validPrests.forEach((p) => {
      if (!cliMap[p.client_id]) {
        cliMap[p.client_id] = { name: TechGestLayout.clientName(p.client_id), count: 0, total: 0, paid: 0 };
      }
      cliMap[p.client_id].count += 1;
      cliMap[p.client_id].total += Number(p.price || 0);
      cliMap[p.client_id].paid += Number(p.paid_amount || 0);
    });
    const topClients = Object.values(cliMap).sort((a, b) => b.total - a.total);
    document.getElementById("rep-clients-tbody").innerHTML = topClients
      .map(
        (c) => `<tr><td class="fw-semibold">${TechGestLayout.esc(c.name)}</td><td class="text-center">${c.count}</td><td class="text-end fw-bold">${TechGestExport.formatFCFA(c.total)}</td><td class="text-end fw-bold tg-text-green">${TechGestExport.formatFCFA(c.paid)}</td></tr>`
      )
      .join("");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("btn-export-pdf").onclick = () => {
      if (currentSummary) TechGestExport.exportReportPDF(currentSummary);
    };
    document.getElementById("btn-export-excel").onclick = () => {
      if (currentSummary) TechGestExport.exportReportExcel(currentSummary);
    };

    TechGestLayout.initPage("rapports", (ws) => renderReports(ws));
  });
})();
