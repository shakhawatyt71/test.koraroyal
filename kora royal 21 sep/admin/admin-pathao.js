'use strict';
/* KORA ROYAL — admin/admin-pathao.js (v1.0)
   Dedicated "Pathao Courier" section. Five tabs:
     Dispatch (ready orders → one-click send) · Shipments (consignments mirrored
     from webhook) · Parcel defaults (every field of Pathao's New-Parcel form) ·
     Connection & webhook · Tools & logs (fee calculator, customer score, webhook log,
     learned address map). Booking/CSV widgets come from admin-pathao-batch.js.
   Talks only to the Worker (/api/admin/pathao/* + operations-settings + diagnostics). */
(function(){
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('pathao');
  krAdminInitMobileNav();
  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const mb = $('krMobileMenuBtn'); if (mb) mb.innerHTML = _SVG.menu;

  const DEFAULT_INSTRUCTION = 'আমাদের সম্মানিত গ্রাহক "{name}" স্যার/ম্যাম-এর পার্সেলটি খুব যত্নসহকারে পৌঁছে দিবেন। আর, উনি যদি পার্সেল রিটার্ন করেন, তাহলে 130 টাকা ডেলিভারি চার্জ নেওয়ার চেষ্টা করবেন। ধন্যবাদ 𖹭';
  const DEFAULT_DESC = '{product} {options} [{sku}] x{qty} ৳{price}';
  const S = { settings: {}, defaults: { instruction: DEFAULT_INSTRUCTION, desc: DEFAULT_DESC }, storeIdByMode: { sandbox: '', live: '' }, selected: new Set(), dispatch: [], shipStatus: 'all', workerOrigin: '' };
  try { S.workerOrigin = new URL(KR_ADMIN.WORKER).origin; } catch (_) {}

  /* ── Tabs (deep-link: pathao.html#shipments) ── */
  function showTab(id) {
    document.querySelectorAll('#ptTabs .kr-set-tab').forEach(b => b.classList.toggle('is-active', b.dataset.tab === id));
    document.querySelectorAll('.pt-tab').forEach(s => s.style.display = s.dataset.tab === id ? 'flex' : 'none');
    if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
    if (id === 'shipments') loadShipments();
    if (id === 'tools') { loadWebhookLog(); loadAddressMap(); mountCalc(); }
  }
  document.querySelectorAll('#ptTabs .kr-set-tab').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  document.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { document.querySelectorAll('[data-sub]').forEach(x => x.classList.toggle('is-active', x === b)); $('ptSubLog').style.display = b.dataset.sub === 'log' ? 'block' : 'none'; $('ptSubMap').style.display = b.dataset.sub === 'map' ? 'block' : 'none'; });
  document.querySelectorAll('[data-eye]').forEach(b => b.onclick = () => { const i = $(b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; });

  const mode = () => $('ptSandbox').checked ? 'sandbox' : 'live';
  function chip() {
    const c = $('ptModeChip'), on = $('ptEnabled').checked, m = mode();
    c.textContent = !on ? 'Pathao OFF' : m === 'sandbox' ? 'SANDBOX (test)' : 'LIVE';
    c.style.background = !on ? 'rgba(113,119,119,0.12)' : m === 'sandbox' ? 'rgba(245,158,11,0.15)' : 'rgba(22,163,74,0.12)';
    c.style.color = !on ? '#717777' : m === 'sandbox' ? '#B45309' : '#15803D';
    $('ptStoreHint').textContent = `(${m} mode)`;
  }

  /* ══ SETTINGS LOAD ══ */
  async function loadSettings() {
    const r = await krAdminFetch('/api/admin/operations-settings');
    const s = r.settings || {}; S.settings = s;
    S.defaults.instruction = s.pathao_default_instruction || DEFAULT_INSTRUCTION;
    S.defaults.desc = s.pathao_default_desc_template || DEFAULT_DESC;
    $('ptEnabled').checked = s.pathao_enabled === '1';
    $('ptSandbox').checked = (s.pathao_mode || 'sandbox') === 'sandbox';
    $('ptAutoBook').checked = s.pathao_auto_book === '1';
    $('ptItemType').value = s.pathao_default_item_type || '2';
    $('ptDeliveryType').value = s.pathao_default_delivery_type || '48';
    const w = String(Number(s.pathao_default_weight || 0.5)); if (![...$('ptWeight').options].some(o => o.value === w)) $('ptWeight').insertAdjacentHTML('beforeend', `<option value="${esc(w)}">${esc(w)} kg</option>`); $('ptWeight').value = w;
    $('ptQtyMode').value = s.pathao_default_quantity_mode === 'sum' ? 'sum' : 'one';
    $('ptCodMode').value = s.pathao_cod_include_delivery === '0' ? '0' : '1';
    $('ptAddressMode').value = ['auto', 'resolver', 'manual'].includes(s.pathao_address_mode) ? s.pathao_address_mode : 'resolver';
    $('ptDescTpl').value = s.pathao_desc_template || '';
    $('ptInstrTpl').value = s.pathao_instruction_template || '';
    $('ptSenderName').value = s.pathao_sender_name || 'KORA ROYAL';
    $('ptSenderPhone').value = s.pathao_sender_phone || '01935158745';
    $('ptWebhookSecret').value = s.pathao_signature_secret || s.pathao_webhook_secret || '';
    $('ptIntegrationSecret').value = s.pathao_integration_secret || '';
    S.storeIdByMode = { sandbox: s.pathao_store_id_sandbox || (s.pathao_mode === 'sandbox' ? s.pathao_store_id : '') || '', live: s.pathao_store_id_live || (s.pathao_mode === 'live' ? s.pathao_store_id : '') || '' };
    $('ptWebhookUrl').textContent = (S.workerOrigin || 'https://kora-api.shakhawatyt77.workers.dev') + '/api/pathao/webhook';
    chip(); previews();
    loadStores(false);
  }
  function previews() {
    const it = ($('ptInstrTpl').value.trim() || S.defaults.instruction).replace(/\{name\}/g, 'Rahim').replace(/\{phone\}/g, '01712345678');
    $('ptInstrPreview').textContent = 'Preview: ' + it + (it.includes('𖹭') ? '' : '\n⚠ template does not end with 𖹭');
    const dt = $('ptDescTpl').value.trim() || S.defaults.desc;
    const one = (p, o, sku, q, pr) => dt.replace(/\{product\}/g, p).replace(/\{options\}/g, o ? '(' + o + ')' : '').replace(/\{sku\}/g, sku).replace(/\{qty\}/g, q).replace(/\{price\}/g, pr).replace(/\[\s*\]/g, '').replace(/\(\s*\)/g, '').replace(/\s{2,}/g, ' ').trim();
    $('ptDescPreview').textContent = 'Preview: ' + [one('Kora Signature', 'Black/M', 'KR-01-M-BLACK', '1', '1290'), one('Royal Kurti', 'Red/L', 'RK-02-L-RED', '2', '1980')].join('; ');
  }
  $('ptInstrTpl').addEventListener('input', previews); $('ptDescTpl').addEventListener('input', previews);
  $('ptEnabled').onchange = chip;
  $('ptSandbox').onchange = function() { const prev = this.checked ? 'live' : 'sandbox'; S.storeIdByMode[prev] = $('ptStore').value || S.storeIdByMode[prev]; chip(); $('ptStore').innerHTML = '<option value="">Save connection, then Sync Stores</option>'; if (S.storeIdByMode[mode()]) fillStores([], S.storeIdByMode[mode()]); krToast(`Mode → ${mode()}. Press "Save connection", then Sync Stores in Parcel defaults.`, 'info'); };

  /* ── Stores ── */
  function fillStores(stores, selectedId) {
    const sel = $('ptStore');
    const opts = stores.map(s => `<option value="${s.store_id}" ${String(s.store_id) === String(selectedId) ? 'selected' : ''}>${esc(s.store_name)}${s.store_address ? ' — ' + esc(s.store_address) : ''}${s.is_active === 0 ? ' (inactive)' : ''}${s.is_default_store ? ' ★ default' : ''}</option>`);
    if (selectedId && !stores.some(s => String(s.store_id) === String(selectedId))) opts.unshift(`<option value="${esc(selectedId)}" selected>Store #${esc(selectedId)} (saved${stores.length ? ', not in list' : ''})</option>`);
    sel.innerHTML = `<option value="">${stores.length ? '-- Select pickup store --' : '-- No stores loaded (' + mode() + ') --'}</option>` + opts.join('');
    if (selectedId) sel.value = String(selectedId);
  }
  async function loadStores(refresh) {
    const btn = $('ptSyncStores'); btn.disabled = true; if (refresh) btn.textContent = 'Syncing…';
    try { const r = await krAdminFetch('/api/admin/pathao/stores' + (refresh ? '?refresh=1' : '')); if (!r.ok) throw new Error(r.error || 'Store list failed'); fillStores(r.stores || [], $('ptStore').value || S.storeIdByMode[mode()]); if (refresh) krToast(`Synced ${(r.stores || []).length} store(s) from Pathao (${r.mode || mode()})`, 'success'); }
    catch (e) { fillStores([], S.storeIdByMode[mode()]); if (refresh) krToast(e.message, 'error'); else $('ptStoreHint').textContent += ' · ' + e.message; }
    finally { btn.disabled = false; btn.textContent = 'Sync Stores'; }
  }
  $('ptSyncStores').onclick = () => loadStores(true);

  /* ══ SAVE: parcel defaults ══ */
  $('ptSaveDefaults').onclick = async function() {
    this.disabled = true; $('ptSaveDefaultsState').textContent = 'Saving…';
    try {
      const instr = $('ptInstrTpl').value.trim();
      if (instr && !instr.includes('𖹭') && !confirm('Your special-instruction template does not end with 𖹭. Save anyway?')) throw new Error('Not saved');
      const payload = { pathaoStoreId: $('ptStore').value || S.storeIdByMode[mode()] || '', pathaoDefaultItemType: $('ptItemType').value, pathaoDefaultDeliveryType: $('ptDeliveryType').value, pathaoDefaultWeight: $('ptWeight').value,
        pathaoQuantityMode: $('ptQtyMode').value, pathaoCodIncludeDelivery: $('ptCodMode').value, pathaoAddressMode: $('ptAddressMode').value, pathaoDescTemplate: $('ptDescTpl').value.trim(), pathaoInstructionTemplate: instr,
        pathaoSenderName: $('ptSenderName').value.trim(), pathaoSenderPhone: $('ptSenderPhone').value.trim() };
      const r = await krAdminFetch('/api/admin/operations-settings', { method: 'POST', body: JSON.stringify(payload) });
      if (!r.ok) throw new Error(r.error || 'Save failed');
      S.storeIdByMode[mode()] = payload.pathaoStoreId;
      krToast('Parcel defaults saved', 'success'); $('ptSaveDefaultsState').textContent = '✓ saved ' + new Date().toLocaleTimeString();
      if ($('ptEnabled').checked && !payload.pathaoStoreId) krToast('No pickup store selected — Sync Stores and pick one', 'warning');
    } catch (e) { krToast(e.message, 'error'); $('ptSaveDefaultsState').textContent = ''; }
    finally { this.disabled = false; }
  };
  /* ══ SAVE: connection / webhook ══ */
  $('ptSaveConn').onclick = async function() {
    this.disabled = true;
    try { const r = await krAdminFetch('/api/admin/operations-settings', { method: 'POST', body: JSON.stringify({ pathaoEnabled: $('ptEnabled').checked, pathaoMode: mode(), pathaoAutoBook: $('ptAutoBook').checked, pathaoStoreId: S.storeIdByMode[mode()] || '' }) });
      if (!r.ok) throw new Error(r.error || 'Save failed'); krToast('Connection settings saved', 'success'); loadStores(false); loadDiag(false); }
    catch (e) { krToast(e.message, 'error'); } finally { this.disabled = false; }
  };
  $('ptSaveWebhook').onclick = async function() {
    this.disabled = true;
    try { const r = await krAdminFetch('/api/admin/operations-settings', { method: 'POST', body: JSON.stringify({ pathaoWebhookSecret: $('ptWebhookSecret').value.trim(), pathaoSignatureSecret: $('ptWebhookSecret').value.trim(), pathaoIntegrationSecret: $('ptIntegrationSecret').value.trim() }) });
      if (!r.ok) throw new Error(r.error || 'Save failed'); krToast('Webhook secrets saved', 'success'); loadDiag(false); }
    catch (e) { krToast(e.message, 'error'); } finally { this.disabled = false; }
  };
  $('ptCopyWebhook').onclick = () => navigator.clipboard.writeText($('ptWebhookUrl').textContent.trim()).then(() => krToast('Webhook URL copied', 'success'));
  $('ptTestConn').onclick = async function() {
    this.disabled = true; this.textContent = 'Testing…'; const box = $('ptMerchant'); box.style.display = 'block'; box.textContent = 'Contacting Pathao…';
    try { const r = await krAdminFetch('/api/admin/pathao/merchant'); if (!r.ok) throw new Error(r.error || 'Failed'); const m = r.merchant || {};
      box.innerHTML = `✅ Connected (${esc(mode())}) · Merchant <b>${esc(m.merchant_name || '—')}</b> #${esc(m.merchant_id || '')} · ${esc(m.user_email || '')} · ${esc(m.user_phone || '')}`; }
    catch (e) { box.innerHTML = `❌ ${esc(e.message)}`; }
    finally { this.disabled = false; this.textContent = 'Test connection'; }
  };

  /* ══ DIAGNOSTICS ══ */
  async function loadDiag(probe) {
    const card = $('ptDiagCard'), box = $('ptDiag');
    if (probe) { showTab('connection'); card.style.display = 'block'; box.innerHTML = '<div class="pt-hint">Probing Pathao API…</div>'; }
    try {
      const d = await krAdminFetch('/api/admin/diagnostics' + (probe ? '?probe=1' : '')); if (!d.ok) throw new Error(d.error || 'Diagnostics failed');
      const p = d.pathao || {}, w = d.webhook || {}, sec = d.secrets || {};
      const item = (label, ok, text) => `<div class="kr-diag-item"><span style="font-size:1rem;">${ok === true ? '✅' : ok === false ? '❌' : '⚠️'}</span><div><b>${esc(label)}</b><small>${text}</small></div></div>`;
      const items = [item('Integration', p.enabled, p.enabled ? `Mode <b>${esc(p.mode)}</b> · store ${p.storeId || '<span style="color:#DC2626">not set</span>'}` : 'Disabled')];
      if (p.mode === 'live') items.push(item('Live credentials', p.liveCredsSet, p.liveCredsSet ? 'PATHAO_CLIENT_ID + PATHAO_CLIENT_SECRET present' + (p.livePasswordGrantSet ? ' (+ username/password fallback)' : '') : 'Missing PATHAO_CLIENT_ID / PATHAO_CLIENT_SECRET in Worker secrets'));
      else items.push(item('Sandbox credentials', true, 'Built-in public test credentials'));
      if (p.merchant) items.push(item('Pathao account', true, `${esc(p.merchant.name)} · #${esc(p.merchant.id)}`)); if (p.merchantError) items.push(item('Pathao account', false, esc(p.merchantError)));
      if (p.probe) items.push(item('API reachable', p.probe.ok, p.probe.ok ? `${p.probe.cities} cities · ${p.probe.ms} ms${p.probe.cached ? ' (cached)' : ''}` : esc(p.probe.error)));
      if (p.stores) items.push(item('Store found', p.storeFound, p.storeFound ? 'Selected store exists in the account' : `Selected store not in list (${p.stores.length} available)`));
      items.push(item('Webhook secret', p.signatureSecretSet, p.signatureSecretSet ? 'Set' : 'Empty — events rejected'), item('Integration secret', p.integrationSecretSet, p.integrationSecretSet ? 'Set — portal handshake can pass' : 'Empty — portal shows ❌'),
        item('Webhook events', w.received > 0 ? true : null, w.received > 0 ? `${w.received} events · last ${krTimeAgo(w.lastAt)}` : 'None yet'), item('Shipments', w.shipments > 0 ? true : null, `${w.shipments || 0} consignments · ${w.learnedMappings || 0} learned mappings`));
      card.style.display = 'block'; box.innerHTML = `<div class="kr-diag">${items.join('')}</div><div class="pt-hint">Worker ${esc(d.worker)} · ${new Date(d.time).toLocaleTimeString()}</div>`;
      $('ptSecretsState').innerHTML = ['PATHAO_CLIENT_ID', 'PATHAO_CLIENT_SECRET'].map(k => `${sec[k] ? '✅' : '❌'} <code>${k}</code>`).join(' &nbsp; ') + ' &nbsp; ' + ['PATHAO_USERNAME', 'PATHAO_PASSWORD'].map(k => `${sec[k] ? '✅' : '⚪'} <code>${k}</code>`).join(' &nbsp; ') + ' <small>(optional)</small>';
    } catch (e) { card.style.display = 'block'; box.innerHTML = `<div style="color:#DC2626;font-size:0.8rem;">${esc(e.message)}</div>`; }
  }
  $('ptDiagBtn').onclick = () => loadDiag(true);

  /* ══ DISPATCH ══ */
  async function loadDispatch() {
    const el = $('ptDispatchRows'); el.innerHTML = '<tr><td colspan="8" class="kr-empty">Loading…</td></tr>';
    try {
      const r = await krAdminFetch(`/api/admin/pathao/dispatch?status=${encodeURIComponent($('ptDispatchStatus').value)}&q=${encodeURIComponent($('ptDispatchSearch').value.trim())}&limit=200`);
      if (!r.ok) throw new Error(r.error || 'Failed');
      S.dispatch = r.orders || []; S.selected = new Set([...S.selected].filter(id => S.dispatch.some(o => o.orderId === id)));
      $('ptStatReady').textContent = r.stats.ready; $('ptStatOpen').textContent = r.stats.open; $('ptStatDelivered').textContent = r.stats.delivered; $('ptStatProblem').textContent = r.stats.problem;
      if (!S.dispatch.length) { el.innerHTML = `<tr><td colspan="8" class="kr-empty">No unbooked orders in this status. Confirm orders in <a href="orders.html" style="color:var(--brand-coral)">Orders</a> first.</td></tr>`; selCount(); return; }
      el.innerHTML = S.dispatch.map(o => `<tr data-id="${esc(o.orderId)}">
        <td><input type="checkbox" class="pt-row-sel" data-sel="${esc(o.orderId)}" ${S.selected.has(o.orderId) ? 'checked' : ''}></td>
        <td><b style="font-family:'Outfit',sans-serif;color:var(--brand-coral);">${esc(o.orderId)}</b><div class="pt-hint" style="margin:0;">${krFmtDateShort(o.createdAt)}</div><div class="pt-hint" style="margin:0;">${esc(o.products)}</div></td>
        <td><b>${esc(o.name)}</b><div class="pt-hint" style="margin:0;">${esc(o.phone)} ${o.phoneOk ? '' : '<span style="color:#DC2626">⚠ invalid</span>'}</div></td>
        <td class="pt-addr">${esc(o.address)}<br><span style="color:var(--text-muted)">${esc(o.thana)}${o.thana ? ', ' : ''}${esc(o.district)}</span>${o.addressOk ? '' : ' <span style="color:#DC2626">⚠ short</span>'}</td>
        <td class="pt-zone" data-zone>—</td>
        <td><b>${krFmtMoney(o.amountToCollect)}</b><div class="pt-hint" style="margin:0;">${esc(o.payment)}${o.advance ? ' · adv ' + krFmtMoney(o.advance) : ''}</div></td>
        <td>${krStatusBadge(o.status)}</td>
        <td><button class="kr-btn kr-btn-primary kr-btn-sm" type="button" data-send="${esc(o.orderId)}">🚚 Send</button></td></tr>`).join('');
      el.querySelectorAll('[data-sel]').forEach(cb => cb.onchange = () => { cb.checked ? S.selected.add(cb.dataset.sel) : S.selected.delete(cb.dataset.sel); selCount(); });
      el.querySelectorAll('[data-send]').forEach(b => b.onclick = () => openPathaoBatch([b.dataset.send]));
      selCount(); previewZones();
    } catch (e) { el.innerHTML = `<tr><td colspan="8" class="kr-empty" style="color:#DC2626">${esc(e.message)}</td></tr>`; }
  }
  /* Zone preview (non-blocking, 50 per call — same resolver the booking uses) */
  async function previewZones() {
    const ids = S.dispatch.map(o => o.orderId).slice(0, 50); if (!ids.length) return;
    try { const r = await krAdminFetch('/api/admin/pathao/resolve', { method: 'POST', body: JSON.stringify({ orderIds: ids }) }); if (!r.ok) return;
      r.orders.forEach(x => { const td = document.querySelector(`tr[data-id="${CSS.escape(x.orderId)}"] [data-zone]`); if (!td) return;
        if (x.city && x.zone) { const conf = x.source === 'learned' ? 'learned' : x.confidence; td.innerHTML = `<span class="kr-pb-conf ${conf}">${conf === 'learned' ? 'learned' : conf}</span>${esc(x.city.name)} / ${esc(x.zone.name)}${x.area ? ' / ' + esc(x.area.name) : ''}`; }
        else td.innerHTML = r.addressMode === 'manual' ? '<span class="kr-pb-conf none">pick manually</span>' : '<span class="kr-pb-conf auto">Pathao auto-detect</span>'; });
    } catch (_) {}
  }
  function selCount() { $('ptSelCount').textContent = `${S.selected.size} selected`; $('ptCheckAll').checked = S.dispatch.length > 0 && S.selected.size === S.dispatch.length; }
  $('ptCheckAll').onchange = function() { S.selected = this.checked ? new Set(S.dispatch.map(o => o.orderId)) : new Set(); document.querySelectorAll('[data-sel]').forEach(cb => cb.checked = this.checked); selCount(); };
  $('ptSendBtn').onclick = () => openPathaoBatch([...S.selected]);
  $('ptCsvBtn').onclick = () => krPathaoCsv([...S.selected]);
  $('ptArchiveBtn').onclick = () => krPathaoCsvArchive();
  $('ptDispatchRefresh').onclick = loadDispatch; $('ptDispatchStatus').onchange = loadDispatch;
  let st; $('ptDispatchSearch').addEventListener('input', () => { clearTimeout(st); st = setTimeout(loadDispatch, 350); });
  window.KR_PATHAO_HOOKS = { afterBook: async () => { S.selected.clear(); await loadDispatch(); }, afterSync: async () => { await loadShipments(); } };

  /* ══ SHIPMENTS ══ */
  async function loadShipments() {
    const el = $('ptShipRows'); el.innerHTML = '<tr><td colspan="8" class="kr-empty">Loading…</td></tr>';
    try {
      const r = await krAdminFetch(`/api/admin/pathao/shipments?status=${encodeURIComponent(S.shipStatus)}&q=${encodeURIComponent($('ptShipSearch').value.trim())}&limit=300`);
      if (!r.ok) throw new Error(r.error || 'Failed');
      const counts = r.counts || {}; const total = Object.values(counts).reduce((a, b) => a + b, 0);
      $('ptShipCounts').innerHTML = [`<button type="button" class="pt-count ${S.shipStatus === 'all' ? 'is-active' : ''}" data-c="all">All ${total}</button>`].concat(Object.keys(counts).sort().map(k => `<button type="button" class="pt-count ${S.shipStatus === k ? 'is-active' : ''}" data-c="${esc(k)}">${esc(krCourierLabel(k))} ${counts[k]}</button>`)).join('');
      $('ptShipCounts').querySelectorAll('[data-c]').forEach(b => b.onclick = () => { S.shipStatus = b.dataset.c; loadShipments(); });
      const sel = $('ptShipStatus'); sel.innerHTML = '<option value="all">All courier statuses</option>' + Object.keys(counts).sort().map(k => `<option value="${esc(k)}" ${S.shipStatus === k ? 'selected' : ''}>${esc(krCourierLabel(k))} (${counts[k]})</option>`).join(''); sel.value = S.shipStatus;
      const rows = r.shipments || [];
      if (!rows.length) { el.innerHTML = '<tr><td colspan="8" class="kr-empty">No consignments yet.</td></tr>'; return; }
      el.innerHTML = rows.map(s => `<tr>
        <td><a href="${krTrackingUrl(s.consignmentId)}" target="_blank" rel="noopener" style="font-family:'Outfit',sans-serif;font-weight:700;color:#0284C7;">${esc(s.consignmentId)} ↗</a><div class="pt-hint" style="margin:0;">${esc(s.mode)}${s.zone ? ' · ' + esc(s.zone) : ''}</div></td>
        <td><a href="orders.html?q=${encodeURIComponent(s.orderId)}" style="color:var(--brand-coral);font-weight:700;">${esc(s.orderId)}</a></td>
        <td><b>${esc(s.name)}</b><div class="pt-hint" style="margin:0;">${esc(s.phone)} · ${esc(s.district)}</div></td>
        <td><span class="kr-courier-chip">${_SVG.truck} ${esc(krCourierLabel(s.courierStatus))}</span></td>
        <td>${krStatusBadge(s.orderStatus)}</td>
        <td>${krFmtMoney(s.deliveryFee)} / <b>${krFmtMoney(s.collectAmount)}</b></td>
        <td>${krFmtDateShort(s.updatedAt)}</td>
        <td style="white-space:nowrap;"><button class="kr-btn kr-btn-ghost kr-btn-sm" type="button" data-sync="${esc(s.orderId)}" title="Pull latest status from Pathao">🔄</button> <button class="kr-btn kr-btn-ghost kr-btn-sm" type="button" data-copy="${esc(s.consignmentId)}">Copy</button></td></tr>`).join('');
      el.querySelectorAll('[data-sync]').forEach(b => b.onclick = () => syncPathao([b.dataset.sync]));
      el.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => krToast('Consignment ID copied', 'success')));
    } catch (e) { el.innerHTML = `<tr><td colspan="8" class="kr-empty" style="color:#DC2626">${esc(e.message)}</td></tr>`; }
  }
  $('ptShipRefresh').onclick = loadShipments; $('ptShipStatus').onchange = function() { S.shipStatus = this.value; loadShipments(); };
  let st2; $('ptShipSearch').addEventListener('input', () => { clearTimeout(st2); st2 = setTimeout(loadShipments, 350); });
  $('ptShipSyncAll').onclick = () => syncPathao([]);

  /* ══ TOOLS ══ */
  let calc = null;
  async function mountCalc() {
    if (calc) return; calc = { city: '', zone: '' };
    const cityHost = document.querySelector('[data-pt-city]'), zoneHost = document.querySelector('[data-pt-zone]');
    let zoneW = null;
    try { const r = await krAdminFetch('/api/admin/pathao/cities'); const cities = r.ok ? r.cities || [] : [];
      krSearchSelect({ container: cityHost, options: cities.map(c => ({ value: String(c.city_id), label: c.city_name })), placeholder: 'City', searchPlaceholder: 'Search city…', onSelect: async v => { calc.city = v; calc.zone = ''; zoneW.setOptions([]); zoneW.setPlaceholder('Loading…'); const z = await krAdminFetch(`/api/admin/pathao/zones?city_id=${v}`); zoneW.setOptions((z.zones || []).map(x => ({ value: String(x.zone_id), label: x.zone_name }))); zoneW.setPlaceholder('Zone'); zoneW.setDisabled(false); } });
      zoneW = krSearchSelect({ container: zoneHost, options: [], placeholder: 'Zone', searchPlaceholder: 'Search zone…', disabled: true, onSelect: v => { calc.zone = v; } });
    } catch (e) { cityHost.textContent = e.message; }
  }
  $('ptCalcBtn').onclick = async function() { if (!calc || !calc.city || !calc.zone) return krToast('Pick city and zone', 'warning'); $('ptCalcOut').textContent = '…'; const r = await krAdminFetch('/api/admin/pathao/price', { method: 'POST', body: JSON.stringify({ cityId: calc.city, zoneId: calc.zone, weight: Number($('ptCalcWeight').value) }) }); $('ptCalcOut').textContent = r.ok ? `৳${r.price.final_price ?? r.price.price}${r.price.discount ? ` (discount ৳${r.price.discount})` : ''}` : r.error; };
  $('ptScoreBtn').onclick = async function() { const ph = $('ptScorePhone').value.trim(); if (!ph) return; $('ptScoreOut').textContent = '…'; const r = await krAdminFetch(`/api/admin/pathao/customer-score?phone=${encodeURIComponent(ph)}`); if (!r.ok) { $('ptScoreOut').innerHTML = `❌ ${esc(r.error || 'No data')}`; return; }
    const rating = String(r.rating || 'unknown').replace(/_/g, ' '), sr = r.successRate != null ? `${Math.round(Number(r.successRate) * (Number(r.successRate) <= 1 ? 100 : 1))}%` : '—';
    $('ptScoreOut').innerHTML = `Rating <b>${esc(rating)}</b> · success rate <b>${esc(sr)}</b> · total deliveries <b>${esc(r.totalDeliveries ?? '—')}</b>${(r.addresses || []).length ? `<div style="margin-top:6px;">Known addresses on Pathao network:<ul style="margin:4px 0 0;padding-left:18px;">${r.addresses.slice(0, 5).map(a => `<li>${esc(a.name || '')} — ${esc(a.address || '')} <small>(${esc(a.cityName || '')}${a.zoneName ? ' / ' + esc(a.zoneName) : ''}${a.areaName ? ' / ' + esc(a.areaName) : ''})</small></li>`).join('')}</ul></div>` : ''}`; };

  async function loadWebhookLog() {
    const el = $('ptWebhookLog');
    try { const r = await krAdminFetch('/api/admin/pathao/webhook-log'); if (!r.ok) throw new Error(r.error || 'Failed'); const ev = r.events || [];
      if (!ev.length) { el.innerHTML = '<div style="padding:14px;color:var(--text-muted);">No webhook events received yet.</div>'; return; }
      el.innerHTML = `<table><thead><tr><th>When</th><th>Event</th><th>Consignment</th><th>Order</th><th>Verified</th><th>Payload</th></tr></thead><tbody>${ev.map(e => `<tr><td>${krFmtDateShort(e.received_at)}</td><td><b>${esc(e.event)}</b></td><td>${esc(e.consignment_id || '—')}</td><td>${e.order_id ? `<a href="orders.html?q=${encodeURIComponent(e.order_id)}" style="color:var(--brand-coral);">${esc(e.order_id)}</a>` : esc(e.merchant_order_id || '—')}</td><td>${e.verified ? '✅' : '<span style="color:#DC2626">✕ bad secret</span>'}</td><td class="wrap"><code style="font-size:0.68rem;">${esc(String(e.payload || '').slice(0, 220))}</code></td></tr>`).join('')}</tbody></table>`;
    } catch (e) { el.innerHTML = `<div style="padding:14px;color:#DC2626;">${esc(e.message)}</div>`; }
  }
  async function loadAddressMap() {
    const el = $('ptAddressMap');
    try { const r = await krAdminFetch('/api/admin/pathao/address-map'); if (!r.ok) throw new Error(r.error || 'Failed'); const rows = r.mappings || [];
      if (!rows.length) { el.innerHTML = '<div style="padding:14px;color:var(--text-muted);">Nothing learned yet — mappings appear after you pick a city/zone manually in the review table.</div>'; return; }
      el.innerHTML = `<table><thead><tr><th>District</th><th>Thana</th><th>→ City</th><th>Zone</th><th>Area</th><th>Mode</th><th>Hits</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(m => `<tr><td>${esc(m.district)}</td><td>${esc(m.thana)}</td><td>${esc(m.city_name)} <small>#${m.city_id}</small></td><td>${esc(m.zone_name)} <small>#${m.zone_id}</small></td><td>${m.area_name ? esc(m.area_name) + ' <small>#' + m.area_id + '</small>' : '—'}</td><td>${esc(m.mode)}</td><td>${m.hits}</td><td>${krFmtDateShort(m.updated_at)}</td><td><button type="button" class="kr-btn kr-btn-ghost kr-btn-sm" data-del="${m.id}" style="color:#DC2626;">Delete</button></td></tr>`).join('')}</tbody></table>`;
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { if (!confirm('Forget this mapping?')) return; const d = await krAdminFetch(`/api/admin/pathao/address-map?id=${b.dataset.del}`, { method: 'DELETE' }); krToast(d.ok ? 'Mapping removed' : d.error, d.ok ? 'success' : 'error'); loadAddressMap(); });
    } catch (e) { el.innerHTML = `<div style="padding:14px;color:#DC2626;">${esc(e.message)}</div>`; }
  }
  $('ptLogRefresh').onclick = loadWebhookLog; $('ptMapRefresh').onclick = loadAddressMap;

  /* ── boot ── */
  (async () => {
    try { await loadSettings(); } catch (e) { krToast('Settings load failed: ' + e.message, 'error'); }
    loadDiag(false); loadDispatch();
    const h = (location.hash || '').replace('#', ''); if (['dispatch', 'shipments', 'defaults', 'connection', 'tools'].includes(h)) showTab(h);
  })();
})();
