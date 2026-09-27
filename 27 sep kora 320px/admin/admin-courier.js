'use strict';
/* ================================================================
   KORA ROYAL — Admin: Courier (Pathao) page logic
   admin/admin-courier.js

   দুই ধরনের সেটিংস:
     ① worker-backed → POST /api/admin/operations-settings
     ② admin-local   → localStorage (krCourierPrefs / krSaveCourierPrefs,
                        দুটোই admin-core.js-এ সংজ্ঞায়িত)
   orders.html একই krCourierPrefs() পড়ে, তাই দুই পেজ সিঙ্কে থাকে।
   ================================================================ */
(function () {
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('courier');
  krAdminInitMobileNav();

  const $ = id => document.getElementById(id);
  const mb = $('krMobileMenuBtn');
  if (mb) mb.innerHTML = _SVG.menu;

  /* ── ① worker-backed ফিল্ড ── */
  const W = {
    enabled:       $('cEnabled'),
    sandbox:       $('cSandbox'),
    store:         $('cStore'),
    itemType:      $('cItemType'),
    deliveryType:  $('cDeliveryType'),
    weight:        $('cWeight'),
    senderName:    $('cSenderName'),
    senderPhone:   $('cSenderPhone'),
    autoBook:      $('cAutoBook'),
    webhookSecret: $('cWebhookSecret')
  };

  /* ── ② admin-local ফিল্ড ── */
  const L = {
    quantity:      $('cQuantity'),
    amountSource:  $('cAmountSource'),
    roundAmount:   $('cRoundAmount'),
    secondaryPhone:$('cSecondaryPhone'),
    descSku:       $('cDescSku'),
    descPrice:     $('cDescPrice'),
    descQty:       $('cDescQty'),
    descFallback:  $('cDescFallback'),
    instrApi:      $('cInstrApi'),
    instrCsv:      $('cInstrCsv'),
    autoCity:      $('cAutoCity'),
    autoZone:      $('cAutoZone'),
    autoArea:      $('cAutoArea'),
    csvAscii:      $('cCsvAscii'),
    csvCityMatch:  $('cCsvCityMatch'),
    csvAreaEmpty:  $('cCsvAreaEmpty'),
    integration:   $('cIntegrationSecret')
  };

  const WEBHOOK_URL = KR_ADMIN.WORKER + '/api/pathao/webhook';
  $('cWebhookUrl').value = WEBHOOK_URL;

  /* ══════════ PREFS (localStorage) ══════════ */
  function readPrefsIntoForm() {
    const p = krCourierPrefs();
    L.quantity.value       = p.quantity;
    L.amountSource.value   = p.amountSource;
    L.roundAmount.checked  = p.roundAmount;
    L.secondaryPhone.checked = p.secondaryPhone;
    L.descSku.checked      = p.descSku;
    L.descPrice.checked    = p.descPrice;
    L.descQty.checked      = p.descQty;
    L.descFallback.value   = p.descFallback;
    L.instrApi.value       = p.instrApi;
    L.instrCsv.value       = p.instrCsv;
    L.autoCity.checked     = p.autoCity;
    L.autoZone.checked     = p.autoZone;
    L.autoArea.checked     = p.autoArea;
    L.csvAscii.checked     = p.csvAscii;
    L.csvCityMatch.checked = p.csvCityMatch;
    L.csvAreaEmpty.checked = p.csvAreaEmpty;
    L.integration.value    = p.integrationSecret || '';
    refreshPreviews();
  }

  function collectPrefs() {
    return {
      quantity:        Math.max(1, Math.min(50, parseInt(L.quantity.value, 10) || 1)),
      amountSource:    L.amountSource.value === 'total_payable' ? 'total_payable' : 'cod_remaining',
      roundAmount:     L.roundAmount.checked,
      secondaryPhone:  L.secondaryPhone.checked,
      descSku:         L.descSku.checked,
      descPrice:       L.descPrice.checked,
      descQty:         L.descQty.checked,
      descFallback:    L.descFallback.value.trim() || 'Clothing',
      instrApi:        L.instrApi.value,
      instrCsv:        L.instrCsv.value,
      autoCity:        L.autoCity.checked,
      autoZone:        L.autoZone.checked,
      autoArea:        L.autoArea.checked,
      csvAscii:        L.csvAscii.checked,
      csvCityMatch:    L.csvCityMatch.checked,
      csvAreaEmpty:    L.csvAreaEmpty.checked,
      /* ⚠ শুধু রেকর্ড রাখার জন্য। আসল ভ্যালু Cloudflare secret-এ বসাতে হবে,
         ব্রাউজারে রাখাটা নিরাপদ না — সেভের সময় সতর্কবার্তা দেখাই। */
      integrationSecret: L.integration.value.trim()
    };
  }

  function savePrefs(quiet) {
    if (krSaveCourierPrefs(collectPrefs())) {
      if (!quiet) krToast('Courier preferences saved', 'success');
      return true;
    }
    krToast('Browser storage unavailable — preferences saved only for this session', 'warning');
    return false;
  }

  /* ══════════ WORKER SETTINGS ══════════ */
  async function loadWorkerSettings() {
    try {
      const r = await krAdminFetch('/api/admin/operations-settings');
      const s = (r && r.settings) || {};
      W.enabled.checked       = s.pathao_enabled === '1';
      W.sandbox.checked       = s.pathao_mode === 'sandbox';
      W.itemType.value        = String(s.pathao_default_item_type || '2');
      W.deliveryType.value    = String(s.pathao_default_delivery_type || '48');
      W.weight.value          = s.pathao_default_weight || '0.5';
      W.senderName.value      = s.pathao_sender_name || 'Kora Royal';
      W.senderPhone.value     = s.pathao_sender_phone || '01935158745';
      W.autoBook.checked      = s.pathao_auto_book === '1';
      W.webhookSecret.value   = s.pathao_webhook_secret || '';
      $('cModeLabel').textContent = (s.pathao_mode === 'live') ? 'LIVE' : 'SANDBOX';
      /* worker-এর মান প্যানেলে ফিরিয়ে আনা — যাতে দুই জায়গা একই থাকে।
         খালি মান এলে (migration এখনো চলেনি) লোকাল পছন্দ মুছে ফেলা হয় না। */
      const merged = {};
      if (s.pathao_default_quantity)     merged.quantity     = Number(s.pathao_default_quantity) || 1;
      if (s.pathao_amount_source)        merged.amountSource = s.pathao_amount_source;
      if (s.pathao_instruction_template) merged.instrApi     = s.pathao_instruction_template;
      if (s.pathao_item_desc_sku)        merged.descSku      = s.pathao_item_desc_sku === '1';
      if (s.pathao_item_desc_price)      merged.descPrice    = s.pathao_item_desc_price === '1';
      if (s.pathao_item_desc_qty)        merged.descQty      = s.pathao_item_desc_qty === '1';
      if (s.pathao_item_desc_fallback)   merged.descFallback = s.pathao_item_desc_fallback;
      if (Object.keys(merged).length) {
        krSaveCourierPrefs(Object.assign(krCourierPrefs(), merged));
        readPrefsIntoForm();
      }
      await loadStores(s.pathao_store_id || '');
      refreshPreviews();
    } catch (e) {
      $('cWorker').innerHTML = '<span style="color:#DC2626">' + (e.message || 'Load failed') + '</span>';
    }
  }

  function workerPayload() {
    /* প্যানেলের কন্ট্রোলগুলো এখন worker-এও যায় — না পাঠালে auto-booking
       অ্যাডমিনের পছন্দ দেখতেই পায় না (আগে শুধু localStorage-এ থাকত)। */
    const p = krCourierPrefs();
    return {
      pathaoDefaultQuantity:     p.quantity,
      pathaoAmountSource:        p.amountSource,
      pathaoInstructionTemplate: p.instrApi,
      pathaoItemDescSku:         p.descSku,
      pathaoItemDescPrice:       p.descPrice,
      pathaoItemDescQty:         p.descQty,
      pathaoItemDescFallback:    p.descFallback,
      pathaoEnabled:            W.enabled.checked,
      pathaoAutoBook:           W.autoBook.checked,
      pathaoMode:               W.sandbox.checked ? 'sandbox' : 'live',
      pathaoSenderName:         W.senderName.value.trim(),
      pathaoSenderPhone:        W.senderPhone.value.trim(),
      pathaoDefaultWeight:      W.weight.value,
      pathaoDefaultItemType:    W.itemType.value,
      pathaoDefaultDeliveryType:W.deliveryType.value,
      pathaoStoreId:            W.store.value,
      pathaoWebhookSecret:      W.webhookSecret.value.trim()
    };
  }

  async function saveWorkerSettings() {
    const r = await krAdminFetch('/api/admin/operations-settings', {
      method: 'POST',
      body: JSON.stringify(workerPayload())
    });
    if (!r || !r.ok) throw new Error((r && r.error) || 'Worker rejected the settings');
    $('cModeLabel').textContent = W.sandbox.checked ? 'SANDBOX' : 'LIVE';
    return true;
  }

  /* ══════════ STORES ══════════ */
  function renderStores(stores, selectedId) {
    const sel = W.store;
    if (!stores || !stores.length) {
      sel.innerHTML = '<option value="">-- No stores found on Pathao --</option>';
      return;
    }
    sel.innerHTML = stores.map(s => {
      const nm = String(s.store_name || '').replace(/[<>&"]/g, '');
      const ad = String(s.store_address || '').replace(/[<>&"]/g, '');
      const on = String(s.store_id) === String(selectedId) ? ' selected' : '';
      return `<option value="${s.store_id}"${on}>${nm}${ad ? ' — ' + ad : ''}</option>`;
    }).join('');
  }

  async function loadStores(selectedId) {
    try {
      const res = await krAdminFetch('/api/admin/pathao/stores');
      if (res && res.ok) { renderStores(res.stores || [], selectedId); return (res.stores || []).length; }
      renderStores([], selectedId);
      return 0;
    } catch (e) {
      renderStores([], selectedId);
      return 0;
    }
  }

  /* ══════════ CITIES ══════════ */
  async function loadCityInfo() {
    const cnt = $('cCityCount'), sample = $('cCitySample');
    cnt.textContent = 'loading…';
    try {
      const r = await krAdminFetch('/api/admin/pathao/cities');
      const list = (r && r.ok && Array.isArray(r.cities)) ? r.cities : [];
      if (!list.length) {
        cnt.innerHTML = '<span style="color:#DC2626">খালি / পাওয়া যায়নি</span>';
        sample.textContent = (r && r.error) ? String(r.error).slice(0, 200)
          : 'Pathao কোনো সিটি ফেরত দেয়নি। Cloudflare Secrets-এ PATHAO_CLIENT_ID, PATHAO_CLIENT_SECRET, PATHAO_USERNAME, PATHAO_PASSWORD — চারটাই আছে কি না দেখুন।';
        return;
      }
      cnt.textContent = list.length + 'টা';
      const names = list.map(c => String(c.city_name || '').trim());
      sample.textContent = 'নমুনা: ' + names.slice(0, 14).join(' · ') +
        (names.length > 14 ? ' …' : '');
    } catch (e) {
      cnt.innerHTML = '<span style="color:#DC2626">error</span>';
      sample.textContent = e.message || 'Failed';
    }
  }

  /* ══════════ HEALTH / TEST ══════════ */
  async function healthCheck() {
    const t0 = Date.now();
    try {
      const r = await krAdminFetch('/api/admin/stats');
      $('cWorker').innerHTML = '<span style="color:#16A34A">Online · ' + (Date.now() - t0) + 'ms · ' + (r.totalOrders || 0) + ' orders</span>';
      return true;
    } catch (e) {
      $('cWorker').innerHTML = '<span style="color:#DC2626">Offline / ' + (e.message || 'error') + '</span>';
      return false;
    }
  }

  async function testConnection() {
    const btn = $('cTestBtn'), out = $('cTestResult');
    btn.disabled = true; btn.textContent = 'Testing…';
    out.className = 'kr-note'; out.textContent = '';
    const lines = [];
    try {
      const ok = await healthCheck();
      lines.push((ok ? '✅' : '❌') + ' Worker reachable');

      let n = 0;
      try {
        const s = await krAdminFetch('/api/admin/pathao/stores');
        n = (s && s.ok && Array.isArray(s.stores)) ? s.stores.length : 0;
        lines.push((n ? '✅' : '❌') + ' Pathao stores: ' + n +
          (n ? '' : ' (Pathao API ক্রেডেনশিয়াল / store approval দেখুন)'));
      } catch (e) { lines.push('❌ Pathao stores: ' + e.message); }

      let c = 0;
      try {
        const r = await krAdminFetch('/api/admin/pathao/cities');
        c = (r && r.ok && Array.isArray(r.cities)) ? r.cities.length : 0;
        lines.push((c ? '✅' : '❌') + ' Pathao cities: ' + c +
          (c ? '' : ' ← এটাই City/Zone ড্রপডাউন খালি থাকার প্রধান কারণ'));
      } catch (e) { lines.push('❌ Pathao cities: ' + e.message); }

      lines.push('');
      lines.push(W.sandbox.checked
        ? 'ℹ Mode: SANDBOX — পার্সেলগুলো merchant.pathao.com-এর লাইভ প্যানেলে দেখাবে না।'
        : '⚠ Mode: LIVE — আসল পার্সেল তৈরি হবে।');

      out.textContent = lines.join('\n');
      out.className = 'kr-alert ' + ((c && n) ? 'is-ok' : 'is-bad');
      out.style.whiteSpace = 'pre-line';
    } finally {
      btn.disabled = false; btn.textContent = 'Test connection';
    }
  }

  /* ══════════ PREVIEWS ══════════ */
  const SAMPLE = {
    items: [{ productName: 'Kora Polo', sku: 'KR-02-L-OLIVE', quantity: 2, lineTotal: 1378.2 }],
    totals: { totalPayable: 1508.2, advance: 130, codRemaining: 1378.2, delivery: 130 },
    name: 'Rahim', phone: '01711000000', orderId: 'KR-TEST-001'
  };

  function refreshPreviews() {
    const p = collectPrefs();

    /* Item description preview */
    $('cDescPreview').textContent =
      'নমুনা: ' + krBuildItemDescription(SAMPLE.items, p);

    /* Amount preview — চার পরিস্থিতি */
    const cases = [
      ['পুরো COD',            { totalPayable: 1200, codRemaining: 1200 }],
      ['৫০০ অ্যাডভান্স',      { totalPayable: 1200, codRemaining: 700  }],
      ['সম্পূর্ণ প্রি-পেইড',  { totalPayable: 1200, codRemaining: 0    }],
      ['দশমিক (৬৮৯.১০)',      { totalPayable: 819.1, codRemaining: 689.1 }]
    ];
    $('cAmountPreview').innerHTML = '<b>নমুনা Amount to Collect:</b><br>' + cases
      .map(([l, t]) => '· ' + l + ' → ৳' + krResolveCollectAmount(t, p))
      .join('<br>');

    /* CSV instruction ASCII check */
    const warn = $('cInstrWarn');
    const bad = p.csvAscii ? krNonAsciiChars(p.instrCsv) : [];
    if (bad.length) {
      warn.className = 'kr-alert is-bad';
      warn.textContent = '⚠ CSV instruction-এ নন-ASCII অক্ষর আছে: ' + bad.join(' ') +
        ' — পাঠাওর ইমপোর্টারে গাল্মিল হয়ে যাবে। ইংরেজিতে লিখুন।';
    } else {
      warn.className = 'kr-alert is-ok';
      warn.textContent = '✅ CSV instruction ASCII-safe — ইমপোর্টারে গাল্মিল হবে না।';
    }
  }

  /* ══════════ EVENTS ══════════ */
  Object.values(L).forEach(el => {
    if (!el) return;
    el.addEventListener('change', () => { savePrefs(true); refreshPreviews(); });
    el.addEventListener('input', () => { refreshPreviews(); });
  });

  async function saveAll() {
    const btn = $('cSaveAll'), note = $('cSaveAllNote');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      savePrefs(true);
      await saveWorkerSettings();
      note.textContent = '✅ সেভ হয়েছে — ' + new Date().toLocaleTimeString();
      krToast('সব কুরিয়ার সেটিংস সেভ হয়েছে', 'success');
    } catch (e) {
      note.textContent = '❌ ' + (e.message || 'failed');
      krToast(e.message || 'Save failed', 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'সব সেভ করুন';
    }
  }

  $('cSaveAll').onclick = saveAll;
  ['cSave1', 'cSave2', 'cSave3', 'cSave6', 'cSave10'].forEach(id => {
    const b = $(id);
    if (b) b.onclick = saveAll;
  });

  /* নতুন সেটিংস কী বসাতে POST /api/admin/setup-database।
     নিরাপদ — worker-এ CREATE TABLE IF NOT EXISTS ও INSERT OR IGNORE চলে,
     তাই পুরনো ডেটা মুছে না। ডেস্কটপ ছাড়া চালানোর জন্যই এই বাটন। */
  async function runMigration() {
    const btn = $('cMigrateBtn'), out = $('cTestResult');
    if (!confirm('Courier migration চালাবেন?\n\nনতুন সেটিংস কী ও courier_shipments টেবিল তৈরি/আপডেট হবে।\nপুরনো ডেটা মুছবে না (CREATE TABLE IF NOT EXISTS + INSERT OR IGNORE)।')) return;
    btn.disabled = true; btn.textContent = 'Running…';
    try {
      const r = await krAdminFetch('/api/admin/setup-database', {
        method: 'POST',
        body: JSON.stringify({ confirm: 'INITIALIZE_KORA_DATABASE' })
      });
      if (!r || !r.ok) throw new Error((r && (r.error || r.detail)) || 'Migration rejected');
      out.className = 'kr-alert is-ok';
      out.textContent = '✅ Migration সফল। এবার Save করে Courier সেটিংস আবার লোড করুন — নতুন ৭টা কী এখন worker-এ আছে।';
      krToast('Migration successful', 'success');
      await loadWorkerSettings();
    } catch (e) {
      out.className = 'kr-alert is-bad';
      out.textContent = '❌ Migration ব্যর্থ: ' + (e.message || e);
      krToast('Migration failed: ' + (e.message || e), 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Run DB Migration';
    }
  }

  $('cTestBtn').onclick = testConnection;
  $('cMigrateBtn').onclick = runMigration;

  $('cSyncStores').onclick = async function () {
    this.disabled = true; this.textContent = 'Syncing…';
    try {
      const n = await loadStores(W.store.value);
      krToast(n ? n + 'টা store পাওয়া গেছে' : 'কোনো store পাওয়া যায়নি', n ? 'success' : 'error');
    } finally { this.disabled = false; this.textContent = 'Sync Stores'; }
  };

  $('cReloadCities').onclick = loadCityInfo;

  $('cInstrReset').onclick = function () {
    L.instrApi.value = KR_COURIER_DEFAULTS.instrApi;
    L.instrCsv.value = KR_COURIER_DEFAULTS.instrCsv;
    savePrefs(true); refreshPreviews();
    krToast('ডিফল্ট instruction ফিরিয়ে আনা হয়েছে', 'success');
  };

  $('cCopyWebhook').onclick = async function () {
    try {
      await navigator.clipboard.writeText(WEBHOOK_URL);
      krToast('Webhook URL কপি হয়েছে', 'success');
    } catch (e) {
      $('cWebhookUrl').select();
      krToast('কপি করা যায়নি — নিজে সিলেক্ট করে কপি করুন', 'warning');
    }
  };

  /* ══════════ INIT ══════════ */
  readPrefsIntoForm();
  healthCheck();
  loadWorkerSettings();
  loadCityInfo();
})();
