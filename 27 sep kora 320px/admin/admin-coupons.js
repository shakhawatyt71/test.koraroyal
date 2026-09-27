/* ================================================================
   KORA ROYAL — Admin Coupons
   admin/admin-coupons.js  |  coupons.html-এর সব লজিক
   ─ সার্ভার API: worker.js-এর /api/admin/coupons/* রুটের সাথে মিলিয়ে লেখা
   ================================================================ */
'use strict';
(function(){
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('coupons');
  krAdminInitMobileNav();

  const $ = id => document.getElementById(id);
  const mb = $('krMobileMenuBtn');
  if (mb) mb.innerHTML = _SVG.menu;

  /* ── HTML escape (কুপন code/note/admin input সরাসরি HTML-এ বসে) ── */
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  let COUPONS = [];
  let EDITING = null;   /* edit চললে code (PK) — code ইনপুট লক হয় */

  /* ══════════════════ ১. প্রেজেন্টেশন helpers ══════════════════ */

  function typeLabel(c){
    if (c.type === 'percent')
      return `${c.value}% off` + (c.maxDiscount > 0 ? `<div class="cp-note">up to ${krFmtMoney(c.maxDiscount)}</div>` : '');
    if (c.type === 'fixed') return `${krFmtMoney(c.value)} off`;
    if (c.type === 'free_delivery') return '🚚 Free delivery';
    if (c.type === 'bogo') return `Buy ${c.bogoBuy} Get ${c.bogoGet} free`;
    return esc(c.type);
  }

  function validityHtml(c){
    const parts = [];
    if (c.startsAt > 0) parts.push('From ' + krFmtDateShort(c.startsAt));
    if (c.endsAt > 0)   parts.push('Until ' + krFmtDateShort(c.endsAt));
    return parts.length
      ? parts.join('<br>')
      : '<span style="color:var(--text-muted)">No limit</span>';
  }

  function usageHtml(c){
    const total = c.usageLimitTotal > 0 ? c.usageLimitTotal : '∞';
    const per   = c.usageLimitPerCustomer > 0 ? `<div class="cp-note">${c.usageLimitPerCustomer}× / customer</div>` : '';
    return `<b>${c.usedCount}</b> / ${total}${per}`;
  }

  function statusPill(c){
    return c.status === 'active'
      ? '<span class="cp-pill on">● Active</span>'
      : '<span class="cp-pill off">○ Disabled</span>';
  }

  /* datetime-local ↔ epoch ms */
  function toLocalVal(ts){
    if (!ts) return '';
    const off = new Date(ts).getTimezoneOffset() * 60000;
    return new Date(ts - off).toISOString().slice(0, 16);
  }
  function fromLocalVal(v){
    if (!v) return 0;
    const t = new Date(v).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  /* ══════════════════ ২. টেবিল রেন্ডার ══════════════════ */

  function renderTable(){
    $('cpCount').textContent = COUPONS.length ? `(${COUPONS.length})` : '';
    const tb = $('cpTbody');
    if (!COUPONS.length){
      tb.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.5rem;">No coupons yet — click “+ New Coupon”.</td></tr>';
      return;
    }
    tb.innerHTML = COUPONS.map(c => `
      <tr>
        <td>
          <span class="cp-code">${esc(c.code)}</span>
          ${c.note ? `<div class="cp-note">${esc(c.note)}</div>` : ''}
        </td>
        <td>${typeLabel(c)}</td>
        <td>${c.minSubtotal > 0 ? krFmtMoney(c.minSubtotal) : '—'}</td>
        <td>${validityHtml(c)}</td>
        <td>${usageHtml(c)}</td>
        <td>${statusPill(c)}</td>
        <td>
          <div class="cp-actions">
            <button class="kr-btn kr-btn-ghost kr-btn-sm" data-act="edit" data-code="${esc(c.code)}" type="button">Edit</button>
            <button class="kr-btn kr-btn-ghost kr-btn-sm" data-act="history" data-code="${esc(c.code)}" type="button">History</button>
            <button class="kr-btn kr-btn-sm ${c.status==='active' ? 'kr-btn-ghost' : 'kr-btn-primary'}" data-act="toggle" data-code="${esc(c.code)}" type="button">${c.status==='active' ? 'Disable' : 'Enable'}</button>
            <button class="kr-btn kr-btn-danger kr-btn-sm" data-act="delete" data-code="${esc(c.code)}" type="button">Delete</button>
          </div>
        </td>
      </tr>`).join('');
  }

  /* ══════════════════ ৩. ফর্ম open/close/fill ══════════════════ */

  function syncTypeFields(){
    const t = $('cpType').value;
    $('cpValueWrap').style.display     = (t === 'percent' || t === 'fixed') ? '' : 'none';
    $('cpMaxDiscWrap').style.display   = (t === 'percent') ? '' : 'none';
    $('cpApplyBaseWrap').style.display = (t === 'percent' || t === 'fixed') ? '' : 'none';
    $('cpBogoWrap').style.display      = (t === 'bogo') ? '' : 'none';
    $('cpValueLabel').textContent      = (t === 'fixed') ? 'Discount amount (৳)' : 'Discount %';
  }

  function openForm(coupon){
    EDITING = coupon ? coupon.code : null;
    $('cpFormTitle').textContent = coupon ? `Edit — ${coupon.code}` : 'New Coupon';
    $('cpCode').value   = coupon ? coupon.code : '';
    $('cpCode').disabled = !!coupon;   /* code = primary key, এডিটে বদলায় না */
    $('cpType').value   = coupon ? coupon.type : 'percent';
    $('cpValue').value  = coupon && coupon.value ? coupon.value : '';
    $('cpMaxDisc').value = coupon ? (coupon.maxDiscount || '') : '';
    $('cpApplyBase').value = coupon ? coupon.applyBase : 'subtotal';
    $('cpBogoBuy').value = coupon ? coupon.bogoBuy : 1;
    $('cpBogoGet').value = coupon ? coupon.bogoGet : 1;
    $('cpMinSub').value = coupon ? (coupon.minSubtotal || '') : '';
    $('cpStatus').value = coupon ? coupon.status : 'active';
    $('cpStarts').value = coupon ? toLocalVal(coupon.startsAt) : '';
    $('cpEnds').value   = coupon ? toLocalVal(coupon.endsAt)   : '';
    $('cpLimitTotal').value = coupon ? (coupon.usageLimitTotal || '') : '';
    $('cpLimitPer').value   = coupon ? (coupon.usageLimitPerCustomer || '') : '';
    $('cpNote').value   = coupon ? coupon.note : '';
    syncTypeFields();
    $('cpFormCard').style.display = '';
    $('cpFormCard').scrollIntoView({ behavior:'smooth', block:'start' });
  }
  function closeForm(){ $('cpFormCard').style.display = 'none'; EDITING = null; }

  /* ══════════════════ ৪. API কল ══════════════════ */

  async function load(){
    try {
      const r = await krAdminFetch('/api/admin/coupons');
      if (r.needsMigration){
        $('cpMigrateBanner').style.display = '';
        COUPONS = []; renderTable(); closeForm();
        return;
      }
      if (!r.ok) throw new Error(r.error || 'Failed to load coupons');
      $('cpMigrateBanner').style.display = 'none';
      COUPONS = r.coupons || [];
      renderTable();
    } catch (e) {
      krToast(e.message, 'error');
    }
  }

  async function saveForm(){
    const payload = {
      code:      $('cpCode').value.trim().toUpperCase(),
      type:      $('cpType').value,
      value:     Number($('cpValue').value) || 0,
      maxDiscount: Math.max(0, Number($('cpMaxDisc').value) || 0),
      minSubtotal: Math.max(0, Number($('cpMinSub').value) || 0),
      applyBase: $('cpApplyBase').value === 'total' ? 'total' : 'subtotal',
      bogoBuy:   Math.trunc(Number($('cpBogoBuy').value) || 1),
      bogoGet:   Math.trunc(Number($('cpBogoGet').value) || 1),
      startsAt:  fromLocalVal($('cpStarts').value),
      endsAt:    fromLocalVal($('cpEnds').value),
      usageLimitTotal:       Math.max(0, Math.trunc(Number($('cpLimitTotal').value) || 0)),
      usageLimitPerCustomer: Math.max(0, Math.trunc(Number($('cpLimitPer').value) || 0)),
      status:    $('cpStatus').value === 'disabled' ? 'disabled' : 'active',
      note:      $('cpNote').value.trim()
    };
    if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/.test(payload.code))
      return krToast('Code must be 3–40 chars (A–Z, 0–9, -, _)', 'warning');
    const btn = $('cpSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';
    try {
      const r = await krAdminFetch('/api/admin/coupons/save', {
        method:'POST', body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error(r.error || 'Save failed');
      krToast(r.updated ? 'Coupon updated ✓' : 'Coupon created ✓', 'success');
      closeForm(); load();
    } catch (e) {
      krToast(e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Save Coupon';
    }
  }

  async function toggleStatus(c){
    const next = c.status === 'active' ? 'disabled' : 'active';
    try {
      const r = await krAdminFetch('/api/admin/coupons/status', {
        method:'POST', body: JSON.stringify({ code:c.code, status:next })
      });
      if (!r.ok) throw new Error(r.error || 'Status change failed');
      krToast(`${c.code} ${next === 'active' ? 'enabled' : 'disabled'}`, 'success');
      load();
    } catch (e) { krToast(e.message, 'error'); }
  }

  async function deleteCoupon(c){
    const yes = await krConfirm(
      `"${c.code}" কুপনটি পুরোপুরি মুছে যাবে — এর usage history-ও ডিলিট হবে।`,
      'Delete coupon?'
    );
    if (!yes) return;
    try {
      const r = await krAdminFetch('/api/admin/coupons/delete', {
        method:'DELETE', body: JSON.stringify({ code:c.code })
      });
      if (!r.ok) throw new Error(r.error || 'Delete failed');
      krToast(`${c.code} deleted`, 'success');
      load();
    } catch (e) { krToast(e.message, 'error'); }
  }

  async function runMigration(){
    const btn = $('cpMigrateBtn');
    btn.disabled = true; btn.textContent = 'Running…';
    try {
      const r = await krAdminFetch('/api/admin/migrate-coupons', {
        method:'POST', body: JSON.stringify({ confirm:'MIGRATE_COUPONS' })
      });
      if (!r.ok) throw new Error(r.error || 'Migration failed');
      krToast(`Setup complete — ${r.counts?.coupons ?? 0} coupon(s) ready`, 'success');
      await load();
    } catch (e) {
      krToast(e.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = 'Run one-time setup';
    }
  }

  /* ══════════════════ ৫. Usage history modal ══════════════════ */

  function ensureModal(){
    let m = $('cpHistModal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'cpHistModal';
    m.className = 'kr-modal-backdrop';
    m.innerHTML = `
      <div class="kr-modal-box" style="max-width:480px;width:calc(100vw - 2rem);">
        <div class="cp-form-head">
          <div style="font-family:'Outfit',sans-serif;font-size:1.02rem;font-weight:700;" id="cpHistTitle">Usage</div>
          <button class="kr-btn kr-btn-ghost kr-btn-sm" id="cpHistClose" type="button">✕</button>
        </div>
        <div class="cp-modal-list" id="cpHistBody"></div>
      </div>`;
    document.body.appendChild(m);
    $('cpHistClose').onclick = () => { m.style.display = 'none'; };
    m.onclick = e => { if (e.target === m) m.style.display = 'none'; };
    return m;
  }

  async function showHistory(c){
    const m = ensureModal();
    $('cpHistTitle').textContent = `${c.code} — usage history`;
    $('cpHistBody').innerHTML = '<div class="cp-hint" style="padding:1rem 0;text-align:center;">Loading…</div>';
    m.style.display = 'flex';
    try {
      const r = await krAdminFetch(`/api/admin/coupons/redemptions?code=${encodeURIComponent(c.code)}`);
      const rows = r.redemptions || [];
      if (!rows.length){
        $('cpHistBody').innerHTML = '<div class="cp-hint" style="padding:1rem 0;text-align:center;">এই কুপন এখনো কেউ ব্যবহার করেনি।</div>';
        return;
      }
      $('cpHistBody').innerHTML = rows.map(x => `
        <div class="cp-hrow">
          <div>
            <b>${esc(x.order_id)}</b>
            <div class="cp-hmeta">${esc(x.customer_phone || '—')} · ${krFmtDate(x.created_at)}</div>
          </div>
          <div style="text-align:right;">
            ${x.free_delivery ? '🚚 Free delivery' : `<b>${krFmtMoney(x.discount_amount)}</b>`}
          </div>
        </div>`).join('');
    } catch (e) {
      $('cpHistBody').innerHTML = `<div class="cp-hint" style="padding:1rem 0;text-align:center;">${esc(e.message)}</div>`;
    }
  }

  /* ══════════════════ ৬. ইভেন্ট বাইন্ডিং ══════════════════ */

  $('cpNewBtn').onclick     = () => openForm(null);
  $('cpRefreshBtn').onclick = load;
  $('cpFormClose').onclick  = closeForm;
  $('cpCancelBtn').onclick  = closeForm;
  $('cpSaveBtn').onclick    = saveForm;
  $('cpMigrateBtn').onclick = runMigration;
  $('cpType').onchange      = syncTypeFields;
  $('cpCode').addEventListener('input', function(){ this.value = this.value.toUpperCase(); });

  $('cpTbody').addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const c = COUPONS.find(x => x.code === btn.dataset.code);
    if (!c) return;
    if (btn.dataset.act === 'edit')    openForm(c);
    if (btn.dataset.act === 'history') showHistory(c);
    if (btn.dataset.act === 'toggle')  toggleStatus(c);
    if (btn.dataset.act === 'delete')  deleteCoupon(c);
  });

  load();
})();
