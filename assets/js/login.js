/**
 * TECHGEST — Script dédié Page Connexion & Inscription (assets/js/login.js)
 */
(() => {
  const $ = (id) => document.getElementById(id);

  function showToast(type, message) {
    const container = $("tg-toast-container");
    const bg = type === "error" ? "#DC2626" : type === "info" ? "#2685D8" : "#102B46";
    const el = document.createElement("div");
    el.style.cssText = `background:${bg};color:#fff;padding:12px 16px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 20px rgba(0,0,0,0.16);margin-bottom:8px;`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function createBuiltInDemoWorkspace() {
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();
    return {
      user: {
        id: "local-demo-uuid",
        full_name: "Moussa Ouédraogo [DÉMO]",
        email: "demo@techgest.bf",
        phone: "+226 70 45 82 19",
        role: "owner",
      },
      profile: {
        business_name: "TECHGEST Solutions IT",
        tagline: "Maintenance Informatique, Réseaux & Solutions Numériques",
        phone: "+226 70 45 82 19",
        email: "contact@techgest.bf",
        address: "Avenue Kwamé N'Krumah, Ouagadougou",
        tax_id: "IFU 00184932M",
        currency: "FCFA",
        invoice_footer: "Règlement par Espèces, Orange Money, Moov Money, Wave ou Virement bancaire.",
      },
      clients: [
        { id: 1, full_name: "Cabinet Juridique Faso Conseil", phone: "+226 25 31 44 10", email: "secretariat@fasoconseil.bf", address: "Zone du Bois, Ouagadougou", client_type: "Entreprise", notes: "Parc de 12 postes Windows 11 + NAS.", is_archived: false, version: 1 },
        { id: 2, full_name: "Clinique Médicale Sainte-Marie", phone: "+226 76 12 88 04", email: "direction@clinique-saintemarie.bf", address: "Koulouba, Ouagadougou", client_type: "Entreprise", notes: "Réseau Wi-Fi sécurisé + logiciel médical.", is_archived: false, version: 1 },
        { id: 3, full_name: "Aminata Traoré", phone: "+226 78 90 33 21", email: "aminata.traore@gmail.com", address: "Ouaga 2000, Secteur 52", client_type: "Particulier", notes: "Station graphique Dell Precision.", is_archived: false, version: 1 },
      ],
      prestations: [
        { id: 1, client_id: 1, reference: `PREST-${year}-0001`, service_name: "Maintenance préventive parc 12 postes + NAS", category: "Maintenance informatique", description: "Mises à jour critiques et sauvegardes RAID.", price: 150000, paid_amount: 150000, service_date: today, work_status: "Terminée", payment_status: "Payé", version: 1 },
        { id: 2, client_id: 2, reference: `PREST-${year}-0002`, service_name: "Déploiement réseau sécurisé & pare-feu", category: "Sécurité informatique", description: "Configuration routeur Mikrotik et VLAN.", price: 220000, paid_amount: 120000, service_date: today, work_status: "Terminée", payment_status: "Partiel", version: 1 },
        { id: 3, client_id: 3, reference: `PREST-${year}-0003`, service_name: "Installation Windows 11 Pro & SSD NVMe", category: "Installation Windows", description: "Clonage données et optimisation système.", price: 85000, paid_amount: 0, service_date: today, work_status: "En cours", payment_status: "Impayé", version: 1 },
      ],
      payments: [
        { id: 1, client_id: 1, prestation_id: 1, reference: `PAY-${year}-0001`, amount: 150000, payment_method: "Virement bancaire", payment_date: today, notes: "Règlement intégral reçu." },
        { id: 2, client_id: 2, prestation_id: 2, reference: `PAY-${year}-0002`, amount: 120000, payment_method: "Orange Money", payment_date: today, notes: "Acompte 55% via Orange Money." },
      ],
      expenses: [
        { id: 1, title: "Disque SSD NVMe 1To Kingston", category: "Matériel informatique", amount: 42000, expense_date: today, description: "Pièce intervention PREST-0003." },
        { id: 2, title: "Abonnement Fibre Pro & Data Mobile", category: "Internet", amount: 25000, expense_date: today, description: "Connexion mensuelle." },
      ],
      quotes: [
        { id: 1, client_id: 2, quote_number: `DEV-${year}-0001`, title: "Sauvegarde Cloud & Antivirus 15 postes", category: "Sécurité informatique", notes: "Devis valable 30 jours.", issue_date: today, valid_until: today, total_amount: 195000, status: "Accepté", items: [{ description: "Licences Endpoint Security (15 postes)", quantity: 15, unit_price: 13000, total_price: 195000 }], version: 1 },
      ],
      invoices: [
        { id: 1, client_id: 1, prestation_id: 1, invoice_number: `FACT-${year}-0001`, title: "Maintenance préventive parc 12 postes + NAS", issue_date: today, due_date: today, total_amount: 150000, paid_amount: 150000, status: "Payée", notes: "Réglée par virement.", items: [{ description: "Maintenance préventive 12 postes", quantity: 1, unit_price: 150000, total_price: 150000 }], version: 1 },
      ],
    };
  }

  document.addEventListener("DOMContentLoaded", async () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    }

    if (!TechGestSupabase.isConfigured()) {
      $("supabase-config-banner").classList.remove("d-none");
    }

    $("tab-auth-login").onclick = () => {
      $("tab-auth-login").classList.add("active");
      $("tab-auth-login").classList.remove("text-dark");
      $("tab-auth-register").classList.remove("active");
      $("tab-auth-register").classList.add("text-dark");
      $("form-login").classList.remove("d-none");
      $("form-register").classList.add("d-none");
    };

    $("tab-auth-register").onclick = () => {
      $("tab-auth-register").classList.add("active");
      $("tab-auth-register").classList.remove("text-dark");
      $("tab-auth-login").classList.remove("active");
      $("tab-auth-login").classList.add("text-dark");
      $("form-register").classList.remove("d-none");
      $("form-login").classList.add("d-none");
    };

    $("btn-demo-login").onclick = async () => {
      try {
        let ws;
        if (TechGestSupabase.isConfigured()) {
          ws = await TechGestSupabase.login("demo@techgest.bf", "TechGest2026!", true);
        } else {
          ws = createBuiltInDemoWorkspace();
        }
        await TechGestDB.saveWorkspace(ws);
        window.location.href = "./index.html";
      } catch (err) {
        showToast("error", err.message);
      }
    };

    $("form-login").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const ws = await TechGestSupabase.login(fd.get("email"), fd.get("password"), false);
        await TechGestDB.saveWorkspace(ws);
        window.location.href = "./index.html";
      } catch (err) {
        showToast("error", err.message);
      }
    };

    $("form-register").onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const ws = await TechGestSupabase.register(Object.fromEntries(fd.entries()));
        await TechGestDB.saveWorkspace(ws);
        window.location.href = "./index.html";
      } catch (err) {
        showToast("error", err.message);
      }
    };
  });
})();
