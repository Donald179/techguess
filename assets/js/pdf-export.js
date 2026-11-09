/**
 * TECHGEST — Génération de Factures PDF & Export Rapports PDF / Excel (JavaScript Vanilla)
 */
const TechGestExport = (() => {
  function formatFCFA(amount) {
    return `${Math.round(Number(amount || 0)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} FCFA`;
  }

  function openInvoicePDF(invoice, client, profile) {
    const win = window.open("", "_blank", "width=900,height=1050");
    if (!win) return;

    const bizName = (profile && profile.business_name) || "TECHGEST Solutions IT";
    const items = Array.isArray(invoice.items) && invoice.items.length > 0
      ? invoice.items
      : [{ description: invoice.title, quantity: 1, unit_price: invoice.total_amount, total_price: invoice.total_amount }];

    const rows = items.map((it, i) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;">${i + 1}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;font-weight:600;">${it.description}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:center;">${it.quantity}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;">${formatFCFA(it.unit_price)}</td>
        <td style="padding:10px;border-bottom:1px solid #E2E8F0;text-align:right;font-weight:700;">${formatFCFA(it.total_price)}</td>
      </tr>
    `).join("");

    const remaining = Math.max(0, Number(invoice.total_amount) - Number(invoice.paid_amount));

    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><title>Facture ${invoice.invoice_number}</title></head>
<body style="font-family:Arial,sans-serif;color:#102B46;padding:30px;">
  <div style="text-align:right;margin-bottom:20px;">
    <button onclick="window.print()" style="background:#2685D8;color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:bold;cursor:pointer;">Imprimer / Enregistrer en PDF</button>
  </div>
  <div style="display:flex;justify-content:space-between;border-bottom:3px solid #102B46;padding-bottom:18px;margin-bottom:24px;">
    <div>
      <strong style="background:#102B46;color:#fff;padding:6px 12px;border-radius:6px;">TECHGEST</strong>
      <h2 style="margin:10px 0 4px;">${bizName}</h2>
      <div style="font-size:13px;color:#475569;">${(profile && profile.address) || ""} • Tél: ${(profile && profile.phone) || ""}</div>
    </div>
    <div style="text-align:right;">
      <h1 style="margin:0;font-size:26px;">FACTURE</h1>
      <div style="color:#2685D8;font-weight:bold;font-size:16px;">${invoice.invoice_number}</div>
      <div style="font-size:13px;margin-top:8px;">Date : ${invoice.issue_date} • Échéance : ${invoice.due_date}</div>
    </div>
  </div>
  <div style="background:#F3F6FB;padding:16px;border-radius:10px;margin-bottom:24px;">
    <strong>Client :</strong> ${(client && client.full_name) || "Client"} — ${(client && client.phone) || ""}
  </div>
  <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px;">
    <thead>
      <tr style="background:#102B46;color:#fff;">
        <th style="padding:10px;text-align:left;">#</th>
        <th style="padding:10px;text-align:left;">Désignation</th>
        <th style="padding:10px;text-align:center;">Qté</th>
        <th style="padding:10px;text-align:right;">PU</th>
        <th style="padding:10px;text-align:right;">Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div style="text-align:right;font-size:15px;">
    <div>Total : <strong>${formatFCFA(invoice.total_amount)}</strong></div>
    <div style="color:#16A36A;">Déjà payé : <strong>${formatFCFA(invoice.paid_amount)}</strong></div>
    <div style="font-size:18px;margin-top:8px;">Net à payer : <strong>${formatFCFA(remaining)}</strong></div>
  </div>
</body></html>`);
    win.document.close();
  }

  function exportReportExcel(summary) {
    const csv = [
      "\uFEFF\"TECHGEST - RAPPORT FINANCIER\"",
      `"Chiffre d'affaires";"${summary.turnover} FCFA"`,
      `"Encaissements";"${summary.collected} FCFA"`,
      `"Dépenses";"${summary.expenses} FCFA"`,
      `"Bénéfice estimé";"${summary.profit} FCFA"`,
      `"Nombre de prestations";"${summary.prestationsCount}"`,
    ].join("\r\n");

    const blob = new Blob([csv], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `TECHGEST_Rapport_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportReportPDF(summary) {
    const win = window.open("", "_blank", "width=900,height=950");
    if (!win) return;
    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Rapport Financier TECHGEST</title></head>
<body style="font-family:Arial,sans-serif;color:#102B46;padding:30px;">
  <button onclick="window.print()" style="background:#2685D8;color:#fff;border:none;padding:10px 18px;border-radius:8px;cursor:pointer;float:right;">Imprimer / PDF</button>
  <h1>TECHGEST — Rapport Financier</h1>
  <p>Date d'édition : ${new Date().toLocaleDateString("fr-FR")}</p>
  <table style="width:100%;border-collapse:collapse;margin-top:20px;font-size:14px;">
    <tr><td style="padding:12px;border:1px solid #CBD5E1;"><strong>Chiffre d'affaires</strong></td><td style="padding:12px;border:1px solid #CBD5E1;">${formatFCFA(summary.turnover)}</td></tr>
    <tr><td style="padding:12px;border:1px solid #CBD5E1;"><strong>Encaissements</strong></td><td style="padding:12px;border:1px solid #CBD5E1;color:#16A36A;">${formatFCFA(summary.collected)}</td></tr>
    <tr><td style="padding:12px;border:1px solid #CBD5E1;"><strong>Dépenses</strong></td><td style="padding:12px;border:1px solid #CBD5E1;">${formatFCFA(summary.expenses)}</td></tr>
    <tr><td style="padding:12px;border:1px solid #CBD5E1;"><strong>Bénéfice estimé</strong></td><td style="padding:12px;border:1px solid #CBD5E1;"><strong>${formatFCFA(summary.profit)}</strong></td></tr>
    <tr><td style="padding:12px;border:1px solid #CBD5E1;"><strong>Nombre de prestations</strong></td><td style="padding:12px;border:1px solid #CBD5E1;">${summary.prestationsCount}</td></tr>
  </table>
</body></html>`);
    win.document.close();
  }

  return { formatFCFA, openInvoicePDF, exportReportExcel, exportReportPDF };
})();
