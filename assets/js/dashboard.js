/**
 * TECHGEST — Script dédié Page Tableau de Bord (assets/js/dashboard.js)
 */
(() => {
  let currentPeriod = "month";
  let monthlyChart = null;
  let categoryChart = null;

  const TRIAL_DAYS = 15;

  const AI_QUESTIONS = [
    "Combien ai-je gagné ce mois-ci ?",
    "Quelle prestation me rapporte le plus ?",
    "Quels clients n'ont pas encore payé ?",
    "Quel est mon chiffre d'affaires annuel ?",
    "Comment évoluent mes revenus ?",
    "Quelles sont mes dépenses les plus importantes ?",
  ];

  function renderDashboard(ws) {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const y = `${now.getFullYear()}-`;

    const matchDate = (d) => {
      if (!d || currentPeriod === "all") return true;
      if (currentPeriod === "month") return d.startsWith(ym);
      if (currentPeriod === "year") return d.startsWith(y);
      return true;
    };

    const validPrest = (ws.prestations || []).filter((p) => p.work_status !== "Annulée" && matchDate(p.service_date));
    const pays = (ws.payments || []).filter((p) => matchDate(p.payment_date));
    const exps = (ws.expenses || []).filter((e) => matchDate(e.expense_date));

    const turnover = validPrest.reduce((s, p) => s + Number(p.price || 0), 0);
    const collected = pays.reduce((s, p) => s + Number(p.amount || 0), 0);
    const expenses = exps.reduce((s, e) => s + Number(e.amount || 0), 0);
    const profit = collected - expenses;

    const unpaidList = (ws.prestations || []).filter(
      (p) => p.work_status !== "Annulée" && Number(p.price) > Number(p.paid_amount)
    );
    const unpaidTotal = unpaidList.reduce((s, p) => s + (Number(p.price) - Number(p.paid_amount)), 0);

    document.getElementById("kpi-turnover").textContent = TechGestExport.formatFCFA(turnover);
    document.getElementById("kpi-collected").textContent = TechGestExport.formatFCFA(collected);
    document.getElementById("kpi-expenses").textContent = TechGestExport.formatFCFA(expenses);
    document.getElementById("kpi-profit").textContent = TechGestExport.formatFCFA(profit);
    document.getElementById("kpi-prestations-count").textContent = String(validPrest.length);
    document.getElementById("kpi-clients-count").textContent = String(
      (ws.clients || []).filter((c) => !Boolean(c.is_archived)).length
    );
    document.getElementById("kpi-unpaid").textContent = TechGestExport.formatFCFA(unpaidTotal);

    // Alertes impayés
    const alertBox = document.getElementById("unpaid-alerts-box");
    if (unpaidList.length > 0) {
      alertBox.classList.remove("d-none");
      document.getElementById("unpaid-alerts-title").textContent = `Alertes sur les paiements en attente (${unpaidList.length})`;
      document.getElementById("unpaid-alerts-grid").innerHTML = unpaidList
        .slice(0, 6)
        .map((p) => {
          const rem = Number(p.price) - Number(p.paid_amount);
          return `
            <div class="col-md-4">
              <div class="tg-unpaid-item p-2.5 d-flex justify-content-between align-items-center small">
                <div class="text-truncate me-2">
                  <strong class="tg-text-blue">${TechGestLayout.esc(p.reference)}</strong> • ${TechGestLayout.esc(TechGestLayout.clientName(p.client_id))}<br>
                  <span class="text-danger fw-bold">Reste : ${TechGestExport.formatFCFA(rem)}</span>
                </div>
                <a href="./paiements.html?prestation=${p.id}" class="btn tg-btn-green btn-sm">Encaisser</a>
              </div>
            </div>`;
        })
        .join("");
    } else {
      alertBox.classList.add("d-none");
    }

    // Dernières prestations
    document.getElementById("recent-prestations-tbody").innerHTML = (ws.prestations || [])
      .slice(0, 5)
      .map(
        (p) => `
        <tr>
          <td class="fw-bold tg-text-blue">${TechGestLayout.esc(p.reference)}</td>
          <td>${TechGestLayout.esc(TechGestLayout.clientName(p.client_id))}</td>
          <td>${TechGestLayout.esc(p.service_name)}</td>
          <td><span class="badge badge-soft-blue">${TechGestLayout.esc(p.work_status)}</span></td>
          <td class="text-end fw-bold">${TechGestExport.formatFCFA(p.price)}</td>
        </tr>`
      )
      .join("");

    // Derniers paiements
    document.getElementById("recent-payments-list").innerHTML = (ws.payments || [])
      .slice(0, 5)
      .map(
        (pay) => `
        <div class="tg-payment-row d-flex justify-content-between align-items-center small">
          <div>
            <strong>${TechGestLayout.esc(TechGestLayout.clientName(pay.client_id))}</strong><br>
            <span class="text-muted">${TechGestLayout.esc(pay.payment_date)} • ${TechGestLayout.esc(pay.payment_method)}</span>
          </div>
          <strong class="tg-text-green">+${TechGestExport.formatFCFA(pay.amount)}</strong>
        </div>`
      )
      .join("");

    // Graphiques Chart.js
    renderCharts(ws, validPrest);

    // Questions IA préparées
    const qBar = document.getElementById("ai-questions-bar");
    qBar.innerHTML = AI_QUESTIONS.map(
      (q, idx) => `<button type="button" class="btn btn-outline-secondary btn-sm" data-ai-idx="${idx}">${q}</button>`
    ).join("");
    qBar.querySelectorAll("[data-ai-idx]").forEach((btn) => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-ai-idx"));
        const ansBox = document.getElementById("ai-answer-box");
        ansBox.classList.remove("d-none");
        ansBox.innerHTML = `<strong>${AI_QUESTIONS[idx]}</strong><br>${computeAIAnswer(idx, ws, turnover, collected, expenses, profit, unpaidList)}`;
      };
    });
  }

  function computeAIAnswer(idx, ws, turnover, collected, expenses, profit, unpaidList) {
    if (idx === 0) {
      return `Sur la période sélectionnée, votre chiffre d'affaires est de ${TechGestExport.formatFCFA(turnover)}, vos encaissements atteignent ${TechGestExport.formatFCFA(collected)} et votre bénéfice net estimé est de ${TechGestExport.formatFCFA(profit)}.`;
    }
    if (idx === 1) {
      const catTotals = {};
      (ws.prestations || []).forEach((p) => {
        catTotals[p.category] = (catTotals[p.category] || 0) + Number(p.price || 0);
      });
      const top = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
      return top ? `La catégorie la plus rentable est « ${top[0]} » avec ${TechGestExport.formatFCFA(top[1])}.` : "Aucune prestation.";
    }
    if (idx === 2) {
      return unpaidList.length === 0
        ? "Tous vos clients sont à jour de leurs paiements."
        : `${unpaidList.length} prestation(s) ont un solde impayé : ${unpaidList.map((u) => `${TechGestLayout.clientName(u.client_id)} (${TechGestExport.formatFCFA(u.price - u.paid_amount)})`).join(", ")}.`;
    }
    if (idx === 3) {
      const y = `${new Date().getFullYear()}-`;
      const annual = (ws.prestations || []).filter((p) => (p.service_date || "").startsWith(y)).reduce((s, p) => s + Number(p.price || 0), 0);
      return `Votre chiffre d'affaires annuel ${new Date().getFullYear()} s'élève à ${TechGestExport.formatFCFA(annual)}.`;
    }
    if (idx === 4) {
      return `Vous avez enregistré ${(ws.payments || []).length} encaissement(s) pour un total de ${TechGestExport.formatFCFA(collected)} contre ${TechGestExport.formatFCFA(expenses)} de dépenses.`;
    }
    const expTotals = {};
    (ws.expenses || []).forEach((e) => {
      expTotals[e.category] = (expTotals[e.category] || 0) + Number(e.amount || 0);
    });
    const topExp = Object.entries(expTotals).sort((a, b) => b[1] - a[1])[0];
    return topExp ? `Votre poste de dépenses principal est « ${topExp[0]} » (${TechGestExport.formatFCFA(topExp[1])}).` : "Aucune dépense.";
  }

  function renderCharts(ws, periodPrestations) {
    if (typeof Chart === "undefined") return;

    const now = new Date();
    const series = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const pref = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      series.push({
        label: pref,
        turnover: (ws.prestations || []).filter((p) => (p.service_date || "").startsWith(pref)).reduce((s, p) => s + Number(p.price || 0), 0),
        collected: (ws.payments || []).filter((p) => (p.payment_date || "").startsWith(pref)).reduce((s, p) => s + Number(p.amount || 0), 0),
        expenses: (ws.expenses || []).filter((e) => (e.expense_date || "").startsWith(pref)).reduce((s, e) => s + Number(e.amount || 0), 0),
      });
    }

    const mCanvas = document.getElementById("chart-monthly");
    if (mCanvas) {
      if (monthlyChart) monthlyChart.destroy();
      monthlyChart = new Chart(mCanvas.getContext("2d"), {
        type: "bar",
        data: {
          labels: series.map((s) => s.label),
          datasets: [
            { label: "Chiffre d'affaires", data: series.map((s) => s.turnover), backgroundColor: "#2685D8", borderRadius: 6 },
            { label: "Encaissements", data: series.map((s) => s.collected), backgroundColor: "#16A36A", borderRadius: 6 },
            { label: "Dépenses", data: series.map((s) => s.expenses), backgroundColor: "#94A3B8", borderRadius: 6 },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } },
      });
    }

    const catMap = {};
    periodPrestations.forEach((p) => {
      catMap[p.category] = (catMap[p.category] || 0) + Number(p.price || 0);
    });
    const catEntries = Object.entries(catMap);
    const cCanvas = document.getElementById("chart-category");
    if (cCanvas) {
      if (categoryChart) categoryChart.destroy();
      categoryChart = new Chart(cCanvas.getContext("2d"), {
        type: "doughnut",
        data: {
          labels: catEntries.map((c) => c[0]),
          datasets: [
            {
              data: catEntries.map((c) => c[1]),
              backgroundColor: ["#102B46", "#2685D8", "#16A36A", "#0EA5E9", "#F59E0B", "#6366F1", "#14B8A6", "#64748B"],
              borderColor: "#FFFFFF",
              borderWidth: 2,
            },
          ],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: "65%", plugins: { legend: { position: "bottom" } } },
      });
    }
  }

  // --- LOGIQUE DE GESTION DE LA PÉRIODE D'ESSAI ET DE LICENCE ---

  async function checkTrialOrLicense() {
    const savedKey = localStorage.getItem('techgest_license_key');
    if (savedKey) {
      const isValid = await verifySupabaseLicense(savedKey);
      if (isValid) return true;
    }

    let installDateStr = localStorage.getItem('techgest_install_date');
    if (!installDateStr) {
      installDateStr = new Date().toISOString();
      localStorage.setItem('techgest_install_date', installDateStr);
    }

    const installDate = new Date(installDateStr);
    const now = new Date();
    const diffTime = Math.abs(now - installDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const remainingDays = TRIAL_DAYS - diffDays;

    if (remainingDays >= 0) {
      showTrialBanner(remainingDays);
      return true;
    }

    showLicenseModal("Votre période d'essai de 15 jours a expiré. Veuillez activer une licence pour continuer.");
    return false;
  }

  async function verifySupabaseLicense(key) {
    try {
      if (typeof _supabase === 'undefined') return true;

      const { data, error } = await _supabase
        .from('licenses')
        .select('*')
        .eq('license_key', key)
        .eq('status', 'active')
        .single();

      if (error || !data) return false;

      const expirationDate = new Date(data.expires_at);
      if (expirationDate < new Date()) return false;

      return true;
    } catch (err) {
      return true; // En mode hors-ligne, tolérance si une clé valide était en cache
    }
  }

  function showTrialBanner(daysLeft) {
    if (document.getElementById('trial-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'trial-banner';
    banner.style.cssText = "background:#FEF3C7;color:#92400E;padding:8px 15px;text-align:center;font-size:13px;font-weight:bold;border-bottom:1px solid #FCD34D;z-index:1000;position:relative;";
    banner.innerHTML = `⏳ Période d'essai gratuite : il vous reste <strong>${daysLeft} jour(s)</strong> d'utilisation.`;
    document.body.insertBefore(banner, document.body.firstChild);
  }

  function showLicenseModal(message = "Veuillez entrer votre clé de licence pour continuer.") {
    if (document.getElementById('license-modal')) return;

    const modalHtml = `
      <div id="license-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);display:flex;justify-content:center;align-items:center;z-index:99999;">
        <div style="background:white;padding:30px;border-radius:10px;width:420px;text-align:center;box-shadow:0 4px 20px rgba(0,0,0,0.25);">
          <h3 style="color:#102B46;margin-bottom:12px;">Activation de TECHGEST</h3>
          <p style="font-size:14px;color:#EF4444;margin-bottom:20px;font-weight:500;">${message}</p>
          <input type="text" id="license-input" placeholder="Ex: TECHGEST-XXXX-YYYY" style="width:100%;padding:10px;margin-bottom:15px;border:1px solid #CBD5E1;border-radius:6px;box-sizing:border-box;font-size:14px;text-align:center;">
          <button id="submit-license" style="background:#2685D8;color:white;border:none;padding:12px 20px;border-radius:6px;cursor:pointer;font-weight:bold;width:100%;font-size:15px;">Activer la licence</button>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    document.getElementById('submit-license').addEventListener('click', async () => {
      const keyInput = document.getElementById('license-input').value.trim();
      if (!keyInput) {
        alert("Veuillez entrer une clé valide.");
        return;
      }

      const isValid = await verifySupabaseLicense(keyInput);
      if (isValid) {
        localStorage.setItem('techgest_license_key', keyInput);
        alert("Licence activée avec succès ! Merci pour votre achat.");
        document.getElementById('license-modal'].remove();
        location.reload();
      } else {
        alert("Clé de licence invalide ou expirée.");
      }
    });
  }

  // --- INITIALISATION DOM ---

  document.addEventListener("DOMContentLoaded", async () => {
    // Vérification de la période d'essai ou de la licence avant d'initialiser le dashboard
    const isAccessAllowed = await checkTrialOrLicense();
    if (!isAccessAllowed) return; // Bloque le chargement si l'essai est expiré et la licence absente/invalide

    document.querySelectorAll("[data-period]").forEach((btn) => {
      btn.onclick = () => {
        currentPeriod = btn.getAttribute("data-period");
        document.querySelectorAll("[data-period]").forEach((b) => {
          b.className = b === btn ? "btn tg-btn-navy" : "btn btn-outline-secondary";
        });
        const ws = TechGestLayout.getWorkspace();
        if (ws) renderDashboard(ws);
      };
    });

    TechGestLayout.initPage("dashboard", (ws) => renderDashboard(ws));
  });
})();