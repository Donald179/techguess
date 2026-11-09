# TECHGEST — Architecture Multi-Pages (Chaque Page = HTML + CSS + JS) + Supabase

Chaque module fonctionnel de **TECHGEST** possède sa propre page **`.html`**, sa propre feuille de style **`.css`** et son propre script **`.js`**, connectés à **Supabase** (Auth + PostgreSQL + RLS) et au moteur hors ligne **IndexedDB + Service Worker**.

---

## 1. Correspondance Page HTML / Feuille CSS / Script JavaScript

| Module | Page HTML | Feuille CSS dédiée | Script JS dédié |
| :--- | :--- | :--- | :--- |
| **Connexion & Inscription** | `login.html` | `assets/css/login.css` | `assets/js/login.js` |
| **Tableau de bord** | `index.html` | `assets/css/dashboard.css` | `assets/js/dashboard.js` |
| **Gestion des clients** | `clients.html` | `assets/css/clients.css` | `assets/js/clients.js` |
| **Gestion des prestations** | `prestations.html` | `assets/css/prestations.css` | `assets/js/prestations.js` |
| **Gestion des paiements** | `paiements.html` | `assets/css/paiements.css` | `assets/js/paiements.js` |
| **Gestion des dépenses** | `depenses.html` | `assets/css/depenses.css` | `assets/js/depenses.js` |
| **Devis & Factures PDF** | `devis-factures.html` | `assets/css/devis-factures.css` | `assets/js/devis-factures.js` |
| **Rapports financiers** | `rapports.html` | `assets/css/rapports.css` | `assets/js/rapports.js` |
| **Paramètres & Synchro** | `parametres.html` | `assets/css/parametres.css` | `assets/js/parametres.js` |
| **Page hors ligne PWA** | `offline.html` | *(styles intégrés)* | — |

### Modules partagés (`assets/css/shared.css` & `assets/js/`)
- `assets/css/shared.css` : Charte graphique commune (`#102B46`, `#2685D8`, `#FFFFFF`, `#F3F6FB`, `#16A36A`), barre latérale et navigation mobile.
- `assets/js/layout.js` : Navigation, badge En ligne / Hors ligne, bouton *Synchroniser maintenant* et garde d'authentification sur toutes les pages.
- `assets/js/supabase-config.js` & `assets/js/supabase-service.js` : Connexion à Supabase Auth et PostgreSQL avec Row Level Security.
- `assets/js/db.js` & `assets/js/sync.js` : Base locale IndexedDB et file d'attente idempotente UUID.
- `assets/js/pdf-export.js` : Génération de factures PDF et export Excel / PDF des rapports financiers.
- `supabase/schema.sql` : Script SQL PostgreSQL à exécuter dans Supabase SQL Editor.
