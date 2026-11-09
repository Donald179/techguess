/**
 * TECHGEST — Backend Client Supabase (Auth + PostgreSQL + RLS + Synchro Offline-First)
 * Pur JavaScript Vanilla utilisant @supabase/supabase-js v2
 */
const TechGestSupabase = (() => {
  let client = null;

  function isConfigured() {
    const cfg = window.TECHGEST_SUPABASE_CONFIG || {};
    return (
      cfg.SUPABASE_URL &&
      !cfg.SUPABASE_URL.includes("VOTRE-PROJET") &&
      cfg.SUPABASE_ANON_KEY &&
      !cfg.SUPABASE_ANON_KEY.includes("VOTRE_CLE")
    );
  }

  function getClient() {
    if (client) return client;
    if (!isConfigured()) {
      throw new Error(
        "Configurez SUPABASE_URL et SUPABASE_ANON_KEY dans assets/js/supabase-config.js"
      );
    }
    const cfg = window.TECHGEST_SUPABASE_CONFIG;
    client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    return client;
  }

  async function login(email, password, isDemo = false) {
    const sb = getClient();
    const targetEmail = isDemo
      ? "demo@techgest.bf"
      : String(email || "")
          .trim()
          .toLowerCase();
    const targetPass = isDemo ? "TechGest2026!" : String(password || "");

    const { data, error } = await sb.auth.signInWithPassword({
      email: targetEmail,
      password: targetPass,
    });
    if (error) throw new Error(error.message);
    return fetchWorkspace(data.user);
  }

  async function register({ fullName, email, password, phone, businessName }) {
    const sb = getClient();
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();
    const { data, error } = await sb.auth.signUp({
      email: cleanEmail,
      password: String(password || ""),
      options: {
        data: {
          full_name: String(fullName || "").trim(),
          phone: String(phone || "").trim(),
          business_name:
            String(businessName || "").trim() || `${fullName} — Services IT`,
        },
      },
    });
    if (error) throw new Error(error.message);
    if (!data.session || !data.user) {
      throw new Error(
        "Compte créé ! Vérifiez votre boîte mail si la confirmation email est activée dans Supabase."
      );
    }
    return fetchWorkspace(data.user);
  }

  async function logout() {
    if (!isConfigured()) return;
    const sb = getClient();
    await sb.auth.signOut();
  }

  async function getCurrentUser() {
    if (!isConfigured()) return null;
    const sb = getClient();
    const { data } = await sb.auth.getSession();
    return data?.session?.user || null;
  }

  async function fetchWorkspace(authUser) {
    const sb = getClient();
    const user = authUser || (await getCurrentUser());
    if (!user) return null;

    const [
      profRes,
      clientsRes,
      prestsRes,
      paysRes,
      expsRes,
      quotesRes,
      invoicesRes,
    ] = await Promise.all([
      sb.from("business_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      sb.from("clients").select("*").order("id", { ascending: false }),
      sb.from("prestations").select("*").order("service_date", { ascending: false }).order("id", { ascending: false }),
      sb.from("payments").select("*").order("payment_date", { ascending: false }).order("id", { ascending: false }),
      sb.from("expenses").select("*").order("expense_date", { ascending: false }).order("id", { ascending: false }),
      sb.from("quotes").select("*, items:quote_items(*)").order("issue_date", { ascending: false }).order("id", { ascending: false }),
      sb.from("invoices").select("*, items:invoice_items(*)").order("issue_date", { ascending: false }).order("id", { ascending: false }),
    ]);

    return {
      user: {
        id: user.id,
        full_name:
          user.user_metadata?.full_name ||
          profRes.data?.business_name ||
          user.email,
        email: user.email,
        phone: user.user_metadata?.phone || profRes.data?.phone || "",
        role: "owner",
      },
      profile: profRes.data || null,
      clients: clientsRes.data || [],
      prestations: prestsRes.data || [],
      payments: paysRes.data || [],
      expenses: expsRes.data || [],
      quotes: quotesRes.data || [],
      invoices: invoicesRes.data || [],
      serverTimestamp: new Date().toISOString(),
    };
  }

  async function processSyncBatch(userId, operations = []) {
    const sb = getClient();
    const results = [];
    let hasConflict = false;

    for (const op of operations) {
      const uuid = String(op.operationUuid || "").trim();
      if (!uuid) continue;

      // 1. Contrôle d'idempotence via sync_operations(operation_uuid)
      const { data: existing } = await sb
        .from("sync_operations")
        .select("*")
        .eq("operation_uuid", uuid)
        .maybeSingle();

      if (existing && existing.status === "SYNCED") {
        results.push({
          operationUuid: uuid,
          status: "SYNCED",
          data: existing.result_data || {},
        });
        continue;
      }

      try {
        const outcome = await executeSingleOperation(sb, userId, op);
        if (outcome && outcome.__conflict) {
          hasConflict = true;
          results.push({
            operationUuid: uuid,
            status: "CONFLICT",
            conflict: outcome.conflict,
          });
          continue;
        }

        await sb.from("sync_operations").insert({
          operation_uuid: uuid,
          user_id: userId,
          entity_type: op.entityType,
          entity_id: String(op.entityId || op.payload?.id || "new"),
          operation_type: op.operationType,
          payload: op.payload || {},
          status: "SYNCED",
          result_data: outcome || {},
        });

        results.push({
          operationUuid: uuid,
          status: "SYNCED",
          data: outcome || {},
        });
      } catch (err) {
        results.push({
          operationUuid: uuid,
          status: "ERROR",
          error: err.message || "Erreur Supabase",
        });
      }
    }

    const workspace = await fetchWorkspace();
    return { hasConflict, results, workspace };
  }

  async function executeSingleOperation(sb, userId, op) {
    const p = op.payload || {};
    const id = Number(op.entityId || p.id || 0);
    const today = new Date().toISOString().slice(0, 10);
    const year = new Date().getFullYear();

    if (op.entityType === "client") {
      if (op.operationType === "CREATE") {
        const { data, error } = await sb
          .from("clients")
          .insert({
            client_uuid: p.clientUuid || op.operationUuid,
            user_id: userId,
            full_name: String(p.fullName || "Client").trim(),
            phone: String(p.phone || "").trim(),
            email: String(p.email || "").trim(),
            address: String(p.address || "").trim(),
            client_type: String(p.clientType || "Particulier"),
            notes: String(p.notes || "").trim(),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      if (op.operationType === "UPDATE") {
        const { data: cur, error: fErr } = await sb
          .from("clients")
          .select("*")
          .eq("id", id)
          .single();
        if (fErr || !cur) throw new Error("Client introuvable.");
        if (!op.forceOverwrite && op.baseVersion > 0 && cur.version !== op.baseVersion) {
          return {
            __conflict: true,
            conflict: {
              entityType: "client",
              entityId: String(id),
              serverRecord: cur,
              localPayload: p,
            },
          };
        }
        const patch = { version: cur.version + 1, updated_at: new Date().toISOString() };
        if (p.fullName !== undefined) patch.full_name = String(p.fullName);
        if (p.phone !== undefined) patch.phone = String(p.phone);
        if (p.email !== undefined) patch.email = String(p.email);
        if (p.address !== undefined) patch.address = String(p.address);
        if (p.notes !== undefined) patch.notes = String(p.notes);
        if (p.isArchived !== undefined) patch.is_archived = Boolean(p.isArchived);

        const { data, error } = await sb
          .from("clients")
          .update(patch)
          .eq("id", id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      if (op.operationType === "DELETE") {
        const { error } = await sb.from("clients").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return { deleted: true };
      }
    }

    if (op.entityType === "prestation") {
      if (op.operationType === "CREATE") {
        const { count } = await sb
          .from("prestations")
          .select("*", { count: "exact", head: true });
        const ref = `PREST-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        const price = Math.max(0, Math.round(Number(p.price || 0)));
        const paid = Math.max(0, Math.round(Number(p.paidAmount || 0)));
        const payStatus =
          paid >= price && price > 0 ? "Payé" : paid > 0 ? "Partiel" : "Impayé";

        const { data, error } = await sb
          .from("prestations")
          .insert({
            client_uuid: p.clientUuid || op.operationUuid,
            user_id: userId,
            client_id: Number(p.clientId),
            reference: ref,
            service_name: String(p.serviceName || "Prestation IT"),
            category: String(p.category || "Maintenance informatique"),
            description: String(p.description || ""),
            price,
            paid_amount: paid,
            service_date: String(p.serviceDate || today),
            work_status: String(p.workStatus || "En attente"),
            payment_status: payStatus,
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      if (op.operationType === "UPDATE") {
        const { data: cur } = await sb
          .from("prestations")
          .select("*")
          .eq("id", id)
          .single();
        if (!cur) throw new Error("Prestation introuvable.");
        if (!op.forceOverwrite && op.baseVersion > 0 && cur.version !== op.baseVersion) {
          return {
            __conflict: true,
            conflict: {
              entityType: "prestation",
              entityId: String(id),
              serverRecord: cur,
              localPayload: p,
            },
          };
        }
        const { data, error } = await sb
          .from("prestations")
          .update({
            work_status: p.workStatus ?? cur.work_status,
            version: cur.version + 1,
          })
          .eq("id", id)
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      if (op.operationType === "DELETE") {
        const { error } = await sb.from("prestations").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return { deleted: true };
      }
    }

    if (op.entityType === "payment") {
      if (op.operationType === "CREATE") {
        const prestId = Number(p.prestationId);
        const { data: prest } = await sb
          .from("prestations")
          .select("*")
          .eq("id", prestId)
          .single();
        if (!prest) throw new Error("Prestation associée introuvable.");

        const { count } = await sb
          .from("payments")
          .select("*", { count: "exact", head: true });
        const ref = `PAY-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        const amount = Math.max(1, Math.round(Number(p.amount || 0)));

        const { data: payRec, error } = await sb
          .from("payments")
          .insert({
            client_uuid: p.clientUuid || op.operationUuid,
            user_id: userId,
            client_id: prest.client_id,
            prestation_id: prestId,
            reference: ref,
            amount,
            payment_method: String(p.paymentMethod || "Espèces"),
            payment_date: String(p.paymentDate || today),
            notes: String(p.notes || ""),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);

        const nextPaid = Number(prest.paid_amount) + amount;
        const nextStatus = nextPaid >= Number(prest.price) ? "Payé" : "Partiel";
        await sb
          .from("prestations")
          .update({
            paid_amount: nextPaid,
            payment_status: nextStatus,
            version: prest.version + 1,
          })
          .eq("id", prestId);

        return payRec;
      }

      if (op.operationType === "DELETE") {
        const { data: pay } = await sb
          .from("payments")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (pay) {
          await sb.from("payments").delete().eq("id", id);
          const { data: prest } = await sb
            .from("prestations")
            .select("*")
            .eq("id", pay.prestation_id)
            .maybeSingle();
          if (prest) {
            const nextPaid = Math.max(0, Number(prest.paid_amount) - Number(pay.amount));
            const nextStatus =
              nextPaid >= Number(prest.price)
                ? "Payé"
                : nextPaid > 0
                ? "Partiel"
                : "Impayé";
            await sb
              .from("prestations")
              .update({ paid_amount: nextPaid, payment_status: nextStatus })
              .eq("id", prest.id);
          }
        }
        return { deleted: true };
      }
    }

    if (op.entityType === "expense") {
      if (op.operationType === "CREATE") {
        const { data, error } = await sb
          .from("expenses")
          .insert({
            client_uuid: p.clientUuid || op.operationUuid,
            user_id: userId,
            title: String(p.title || "Dépense"),
            category: String(p.category || "Autres charges"),
            amount: Math.max(0, Math.round(Number(p.amount || 0))),
            expense_date: String(p.expenseDate || today),
            description: String(p.description || ""),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);
        return data;
      }

      if (op.operationType === "DELETE") {
        const { error } = await sb.from("expenses").delete().eq("id", id);
        if (error) throw new Error(error.message);
        return { deleted: true };
      }
    }

    if (op.entityType === "quote") {
      if (op.operationType === "CREATE") {
        const { count } = await sb
          .from("quotes")
          .select("*", { count: "exact", head: true });
        const qNum = `DEV-${year}-${String((count || 0) + 1).padStart(4, "0")}`;
        const items = Array.isArray(p.items) ? p.items : [];
        let total = 0;
        const rowsToInsert = items.map((it) => {
          const qty = Math.max(1, Math.round(Number(it.quantity || 1)));
          const unit = Math.max(0, Math.round(Number(it.unitPrice || 0)));
          total += qty * unit;
          return {
            description: String(it.description || "Service"),
            quantity: qty,
            unit_price: unit,
            total_price: qty * unit,
          };
        });

        const { data: quote, error } = await sb
          .from("quotes")
          .insert({
            client_uuid: p.clientUuid || op.operationUuid,
            user_id: userId,
            client_id: Number(p.clientId),
            quote_number: qNum,
            title: String(p.title || "Devis IT"),
            category: String(p.category || "Maintenance informatique"),
            notes: String(p.notes || ""),
            total_amount: total,
            status: String(p.status || "Envoyé"),
          })
          .select()
          .single();
        if (error) throw new Error(error.message);

        if (rowsToInsert.length > 0) {
          await sb.from("quote_items").insert(
            rowsToInsert.map((r) => ({ ...r, quote_id: quote.id }))
          );
        }
        return quote;
      }

      if (op.operationType === "CONVERT_QUOTE") {
        const { data: q } = await sb
          .from("quotes")
          .select("*, items:quote_items(*)")
          .eq("id", id)
          .single();
        if (!q || q.status === "Converti") return { ok: true };

        const { count: pCnt } = await sb
          .from("prestations")
          .select("*", { count: "exact", head: true });
        const { count: iCnt } = await sb
          .from("invoices")
          .select("*", { count: "exact", head: true });

        const { data: newPrest } = await sb
          .from("prestations")
          .insert({
            user_id: userId,
            client_id: q.client_id,
            reference: `PREST-${year}-${String((pCnt || 0) + 1).padStart(4, "0")}`,
            service_name: q.title,
            category: q.category,
            description: q.notes,
            price: q.total_amount,
            paid_amount: 0,
            service_date: today,
            work_status: "En cours",
            payment_status: "Impayé",
          })
          .select()
          .single();

        const { data: newInv } = await sb
          .from("invoices")
          .insert({
            user_id: userId,
            client_id: q.client_id,
            prestation_id: newPrest?.id || null,
            quote_id: q.id,
            invoice_number: `FACT-${year}-${String((iCnt || 0) + 1).padStart(4, "0")}`,
            title: q.title,
            total_amount: q.total_amount,
            paid_amount: 0,
            status: "Émise",
            notes: q.notes,
          })
          .select()
          .single();

        if (newInv && Array.isArray(q.items) && q.items.length > 0) {
          await sb.from("invoice_items").insert(
            q.items.map((it) => ({
              invoice_id: newInv.id,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
              total_price: it.total_price,
            }))
          );
        }

        await sb
          .from("quotes")
          .update({
            status: "Converti",
            converted_prestation_id: newPrest?.id || null,
            converted_invoice_id: newInv?.id || null,
            version: q.version + 1,
          })
          .eq("id", q.id);

        return { prestationId: newPrest?.id, invoiceId: newInv?.id };
      }
    }

    if (op.entityType === "invoice" && op.operationType === "CREATE") {
      const prestId = Number(p.prestationId);
      const { data: prest } = await sb
        .from("prestations")
        .select("*")
        .eq("id", prestId)
        .single();
      if (!prest) throw new Error("Prestation introuvable.");

      const { count } = await sb
        .from("invoices")
        .select("*", { count: "exact", head: true });
      const status =
        prest.paid_amount >= prest.price
          ? "Payée"
          : prest.paid_amount > 0
          ? "Partielle"
          : "Émise";

      const { data: inv, error } = await sb
        .from("invoices")
        .insert({
          user_id: userId,
          client_id: prest.client_id,
          prestation_id: prest.id,
          invoice_number: `FACT-${year}-${String((count || 0) + 1).padStart(4, "0")}`,
          title: prest.service_name,
          total_amount: prest.price,
          paid_amount: prest.paid_amount,
          status,
          notes: prest.description,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);

      await sb.from("invoice_items").insert({
        invoice_id: inv.id,
        description: prest.service_name,
        quantity: 1,
        unit_price: prest.price,
        total_price: prest.price,
      });
      return inv;
    }

    if (op.entityType === "profile" && op.operationType === "UPDATE") {
      const { data, error } = await sb
        .from("business_profiles")
        .update({
          business_name: p.businessName,
          tagline: p.tagline,
          phone: p.phone,
          email: p.email,
          address: p.address,
          tax_id: p.taxId,
          invoice_footer: p.invoiceFooter,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }

    return { ok: true };
  }

  return {
    isConfigured,
    login,
    register,
    logout,
    getCurrentUser,
    fetchWorkspace,
    processSyncBatch,
  };
})();
