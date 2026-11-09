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
              <a href="${p.href}" data-key="${p.key}" class="tg-nav-link ${p.key === activeKey ? "active" : ""}">
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
                `<a href="${m.href}" data-key="${m.key}" class="${m.key === activeKey ? "active" : ""}">${m.label}</a>`
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
    setupSeamlessNavigation();
  }

  function updateActiveStates(url) {
    const targetPage = url.split("/").pop() || "index.html";
    document.querySelectorAll(".tg-nav-link, .tg-mobile-nav a").forEach((el) => {
      const href = el.getAttribute("href");
      if (href && href.includes(targetPage)) {
        el.classList.add("active");
      } else {
        el.classList.remove("active");
      }
    });
  }

  async function navigateTo(url, push = true) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Page introuvable");
      const htmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");

      const newMain = doc.querySelector("main") || doc.querySelector(".container") || doc.body;
      const currentMain = document.querySelector("main") || document.querySelector(".container");

      if (newMain && currentMain) {
        currentMain.innerHTML = newMain.innerHTML;
      }

      if (push) {
        window.history.pushState({}, "", url);
      }

      // Force la mise à jour immédiate de la barre bleue sur la sidebar et mobile
      updateActiveStates(url);

      // Exécuter et charger dynamiquement les scripts de la page cible si nécessaire
      const scripts = doc.querySelectorAll("script");
      scripts.forEach((script) => {
        if (script.src && !script.src.includes("layout.js") && !script.src.includes("db.js") && !script.src.includes("supabase")) {
          const existing = document.querySelector(`script[src="${script.src}"]`);
          if (!existing) {
            const s = document.createElement("script");
            s.src = script.src;
            document.body.appendChild(s);
          } else {
            const evt = new Event("DOMContentLoaded");
            document.dispatchEvent(evt);
          }
        }
      });
    } catch (err) {
      window.location.href = url;
    }
  }