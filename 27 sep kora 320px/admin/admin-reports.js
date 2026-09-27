/* ================================================================
   KORA ROYAL — Admin Reports (Bug Reports + Device Logs) v2
   admin/admin-reports.js  |  reports.html এর সাথে load হয়

   Two views:
   1) Bug Reports  — click a row -> POPUP window (same as Orders).
                     Inside the popup: the report + the user's FULL
                     session trail (site entry -> report submit) +
                     a site-error verdict (was it OUR fault or not).
   2) Device Logs  — PROBLEM-ONLY logs (JS errors, promise errors,
                     console errors/warnings, HTTP errors, network
                     fails) in developer-fixable form. Normal traffic
                     (clicks, page loads) is never shown here.

   Nothing here is ever shown on the public site.
   ================================================================ */
'use strict';

(function () {
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('reports');
  krAdminInitMobileNav();

  const $ = (id) => document.getElementById(id);
  const mb = $('krMobileMenuBtn');
  if (mb) mb.innerHTML = _SVG.menu;

  const esc = (v) => String(v ?? '').replace(/[&<>\"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;'
  }[c]));

  let rows = [];
  let cats = [];
  let statusFilter = '';
  let searchTimer;
  let view = 'reports';           /* 'reports' | 'logs' */

  const STATUS_LABEL = {
    new: 'New',
    investigating: 'Investigating',
    resolved: 'Resolved',
    dismissed: 'Dismissed'
  };

  const CAT_LABEL = {
    display: 'Display Issue',
    function: 'Not Working',
    slow: 'Slow / Loading',
    crash: 'App Crashed',
    order: 'Order Problem',
    payment: 'Payment Issue',
    other: 'Other'
  };

  const LOG_KIND = {
    error: 'JS Error',
    rejection: 'Promise Error',
    'console-error': 'Console Error',
    'console-warn': 'Console Warning',
    http: 'HTTP Error',
    fetch: 'Network Fail',
    click: 'Click',
    nav: 'Page',
    'report-diag': 'Report Snapshot',
    'push-health': 'Push Health'
  };

  /* Problem kinds — the ONLY things the Device Logs view shows. */
  const PROBLEM_KINDS = ['error', 'rejection', 'console-error', 'console-warn', 'http', 'fetch'];
  const isProblem = (l) => PROBLEM_KINDS.indexOf(l.kind) >= 0;

  function catLabel(id) {
    const hit = cats.find((c) => c.id === id);
    return hit ? hit.label : (CAT_LABEL[id] || id || '—');
  }

  function deviceOf(row) {
    try { return JSON.parse(row.device_info || '{}'); } catch (e) { return {}; }
  }

  function payloadOf(row) {
    try { return JSON.parse(row.payload || '{}'); } catch (e) { return {}; }
  }

  /* ── LOAD ── */
  async function loadCategories() {
    try {
      const r = await krAdminFetch('/api/admin/bug-reports/categories');
      cats = (r && r.ok && r.categories) ? r.categories : [];
    } catch (e) { cats = []; }
    const sel = $('krRptCategory');
    if (!sel) return;
    sel.innerHTML = '<option value="">All categories</option>' +
      cats.map((c) => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
    if (window.reenhanceSelect) reenhanceSelect(sel);   /* keep custom dropdown in sync */
  }

  async function load() {
    $('krRptList').innerHTML = '<div class="kr-empty">Loading…</div>';
    try {
      /* First run creates the tables if setup was never done — self-healing. */
      try { await krAdminFetch('/api/admin/bug-reports/migrate', { method: 'POST', body: '{}' }); } catch (e) {}
      const r = await krAdminFetch('/api/admin/bug-reports?limit=500');
      if (!r.ok) throw new Error(r.error || 'Failed to load reports');
      rows = r.reports || [];
      render();
    } catch (e) {
      $('krRptList').innerHTML = `<div class="kr-empty">${esc(e.message)}</div>`;
    }
  }

  /* ── FILTER ── */
  function visible() {
    const q = $('krRptSearch').value.trim().toLowerCase();
    const cat = $('krRptCategory').value;
    const plat = $('krRptPlatform').value;
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (cat && r.category !== cat) return false;
      if (plat && r.platform !== plat) return false;
      if (!q) return true;
      return [r.id, r.description, r.name, r.phone, r.email, r.category, r.admin_note]
        .join(' ').toLowerCase().includes(q);
    });
  }

  /* ── RENDER ── */
  function counts() {
    const c = { all: rows.length, new: 0, investigating: 0, resolved: 0, dismissed: 0 };
    rows.forEach((r) => { if (c[r.status] !== undefined) c[r.status]++; });
    return c;
  }

  function renderCounts() {
    const c = counts();
    $('krRptAllCount').textContent = c.all;
    $('krRptNewCount').textContent = c.new;
    $('krRptInvCount').textContent = c.investigating;
    $('krRptResCount').textContent = c.resolved;
    $('krRptDisCount').textContent = c.dismissed;

    $('krRptStats').innerHTML = [
      ['Total reports', c.all],
      ['New', c.new],
      ['Investigating', c.investigating],
      ['Resolved', c.resolved]
    ].map((x) => `
      <div class="kr-stat-card">
        <div class="kr-stat-label">${esc(x[0])}</div>
        <div class="kr-stat-value">${esc(x[1])}</div>
      </div>`).join('');
  }

  function render() {
    renderCounts();
    const list = visible();
    if (!list.length) {
      $('krRptList').innerHTML = '<div class="kr-empty">No reports found</div>';
      return;
    }
    $('krRptList').innerHTML = list.map((r) => rowHTML(r)).join('');
  }

  /* One-line row — clicking opens the POPUP (list never moves). */
  function rowHTML(r) {
    return `
    <article class="kr-rpt-card" data-id="${esc(r.id)}">
      <div class="kr-rpt-summary">
        <div style="min-width:0">
          <div class="kr-rpt-head">
            <span class="kr-rpt-cat">${esc(catLabel(r.category))}</span>
            <span class="kr-rpt-platform">${esc(r.platform || 'website')}</span>
          </div>
          <div class="kr-rpt-desc">${esc(r.description)}</div>
        </div>
        <span class="kr-rpt-status ${esc(r.status)}">${esc(STATUS_LABEL[r.status] || r.status)}</span>
        <span class="kr-rpt-time">${esc(krTimeAgo(r.created_at))}</span>
        <span style="opacity:0.45">${_SVG.chevron}</span>
      </div>
    </article>`;
  }

  /* ── LOG ROW (developer-fixable form) ── */
  function logRowHTML(l) {
    const pl = payloadOf(l);
    const kind = LOG_KIND[l.kind] || l.kind || 'Log';
    const msg = pl.msg || pl.m || '';
    const stack = pl.stack || pl.s || '';
    const extra = pl.extra || pl.x || '';
    return `
    <div class="kr-rpt-log-row kr-kind-${esc(l.kind || '')}">
      <div class="kr-rpt-log-top">
        <span class="kr-rpt-log-kind">${esc(kind)}</span>
        <span class="kr-rpt-log-time">${esc(krTimeAgo(l.ts))} · ${esc(krFmtDate(Number(l.ts) || l.ts))}</span>
        <span class="kr-rpt-log-uid">${esc(l.uid || '—')}</span>
      </div>
      ${msg ? `<div class="kr-rpt-log-msg">${esc(msg)}</div>` : ''}
      ${stack ? `<pre class="kr-rpt-log-stack">${esc(stack)}</pre>` : ''}
      ${extra ? `<div class="kr-rpt-log-page">source: ${esc(typeof extra === 'string' ? extra : JSON.stringify(extra))}</div>` : ''}
      ${l.page ? `<div class="kr-rpt-log-page">${esc(l.page)}</div>` : ''}
    </div>`;
  }

  /* ── REPORT POPUP (same system as Orders) ── */
  function openReport(r) {
    const d = deviceOf(r);
    const box = $('krRptModalBox');
    if (!box) return;
    const note = r.admin_note ? `
      <div class="kr-rpt-note-box">
        <span class="kr-rpt-note-label">Admin note</span>${esc(r.admin_note)}
      </div>` : '';

    box.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:.85rem 1rem;border-bottom:1px solid var(--border-subtle);position:sticky;top:0;background:var(--bg-card);z-index:3;">
        <div style="display:flex;align-items:center;gap:8px;min-width:0;">
          <span class="kr-rpt-cat">${esc(catLabel(r.category))}</span>
          <span class="kr-rpt-status ${esc(r.status)}">${esc(STATUS_LABEL[r.status] || r.status)}</span>
          <span class="kr-rpt-time">${esc(krFmtDate(r.created_at))}</span>
        </div>
        <button type="button" id="krRptModalClose" aria-label="Close"
          style="width:32px;height:32px;border:none;background:var(--bg-input);border-radius:8px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div style="padding:1rem 1.1rem;">
        <div class="kr-rpt-block">${esc(r.description)}</div>

        <div class="kr-rpt-grid">
          <div class="kr-rpt-field">Report ID<strong>${esc(r.id)}</strong></div>
          <div class="kr-rpt-field">Reported<strong>${esc(krFmtDate(r.created_at))}</strong></div>
          <div class="kr-rpt-field">Name<strong>${esc(r.name || '—')}</strong></div>
          <div class="kr-rpt-field">Phone<strong>${esc(r.phone || '—')}</strong></div>
          <div class="kr-rpt-field">Email<strong>${esc(r.email || '—')}</strong></div>
          <div class="kr-rpt-field">Platform<strong>${esc(r.platform || 'website')}</strong></div>
          <div class="kr-rpt-field">Theme<strong>${esc(r.theme || '—')}</strong></div>
          <div class="kr-rpt-field">Page URL<strong>${esc(r.url || '—')}</strong></div>
          <div class="kr-rpt-field">Device<strong>${esc([d.browser, d.browserVersion, d.os].filter(Boolean).join(' ') || '—')}</strong></div>
          <div class="kr-rpt-field">Screen<strong>${esc(d.screenSize || '—')}</strong></div>
          <div class="kr-rpt-field">User ID<strong>${esc(d._uid || d.uid || '—')}</strong></div>
          <div class="kr-rpt-field">Language<strong>${esc(d.language || '—')}</strong></div>
        </div>

        <div id="krRptVerdict" class="kr-rpt-block">Checking this user's session log…</div>

        <div class="kr-rpt-diag-label">User activity trail — site entry until this report (the user never sees this)</div>
        <div class="kr-rpt-diag" id="krRptTrail"><div class="kr-rpt-diag-empty">Loading the session log…</div></div>

        ${note}

        <div class="kr-rpt-actions">
          <select class="kr-input" id="krRptStatusSel" data-native>
            ${['new', 'investigating', 'resolved', 'dismissed'].map((s) =>
              `<option value="${s}"${r.status === s ? ' selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
          </select>
          <input class="kr-input" id="krRptNote" placeholder="Admin note (internal)" value="${esc(r.admin_note || '')}" />
          <button class="kr-btn kr-btn-primary kr-btn-sm" id="krRptSave">Save</button>
          ${r.phone ? `<a class="kr-btn kr-btn-ghost kr-btn-sm" target="_blank" href="${krWhatsAppUrl(r.phone, 'KORA ROYAL support — আপনার bug report সম্পর্কে যোগাযোগ করছি।')}">WhatsApp</a>` : ''}
          <button class="kr-btn kr-btn-danger kr-btn-sm" id="krRptDelete">Delete</button>
        </div>
      </div>`;

    $('krRptModalClose').onclick = closeModal;
    $('krRptSave').onclick = () => save(r.id);
    $('krRptDelete').onclick = () => remove(r.id);
    if (window.enhanceSelect) enhanceSelect($('krRptStatusSel'));

    $('krRptModal').classList.add('is-open');
    loadTrail(r);
  }

  function closeModal() {
    const m = $('krRptModal');
    if (m) m.classList.remove('is-open');
  }

  /* Full session trail + "was it our fault?" verdict. */
  async function loadTrail(r) {
    const host = $('krRptTrail');
    const verdict = $('krRptVerdict');
    if (!host) return;
    const d = deviceOf(r);
    let uid = d._uid || d.uid || '';
    let sess = d._session || '';
    host.innerHTML = '<div class="kr-rpt-diag-empty">Loading the session log…</div>';
    try {
      const [byReport, byUid] = await Promise.all([
        krAdminFetch(`/api/admin/client-logs?reportId=${encodeURIComponent(r.id)}&limit=60`).catch(() => ({})),
        uid ? krAdminFetch(`/api/admin/client-logs?uid=${encodeURIComponent(uid)}&limit=300`).catch(() => ({})) : Promise.resolve({})
      ]);
      const snapRows = (byReport && byReport.ok && byReport.logs) ? byReport.logs : [];
      const uidRows = (byUid && byUid.ok && byUid.logs) ? byUid.logs : [];

      const snapRow = snapRows.find((l) => l.kind === 'report-diag') ||
                      uidRows.find((l) => l.kind === 'report-diag' && l.report_id === r.id);
      const snap = snapRow ? payloadOf(snapRow) : {};
      if (!uid && (snap.uid || (snapRow && snapRow.uid))) uid = snap.uid || (snapRow && snapRow.uid);
      if (!sess && snap.session) sess = snap.session;

      const seen = {};
      const all = snapRows.concat(uidRows).filter((l) => {
        if (seen[l.id]) return false;
        seen[l.id] = 1;
        return true;
      });

      /* The full trail = THIS visit only: site entry up to the report. */
      let trail = sess
        ? all.filter((l) => (payloadOf(l).sess === sess) || l.kind === 'report-diag')
        : [];
      if (!trail.length) {
        /* Fallback for rows without a session id: 2h before the report. */
        const t0 = Number(r.created_at || r.timestamp || 0);
        trail = all.filter((l) => Number(l.ts) >= t0 - 7200000 && Number(l.ts) <= t0 + 120000);
      }
      trail = trail.filter((l) => l.kind !== 'push-health')
                   .sort((a, b) => Number(a.ts) - Number(b.ts));

      const problems = trail.filter(isProblem);
      const actions = trail.filter((l) => l.kind === 'click' || l.kind === 'nav').length;

      if (verdict) {
        verdict.innerHTML = problems.length
          ? `<span style="color:#B91C1C;font-weight:700;">Site-side errors found: ${problems.length}.</span> The red/amber entries below are real problems from this user's browser — this report is about a real site issue.`
          : `<span style="color:#15803D;font-weight:700;">No site-side errors in this session.</span> Nothing broke on the site between entry and this report (${actions} actions checked) — likely a user/device/network issue or a misunderstanding.`;
      }

      const head = `
        <div class="kr-rpt-diag-head">
          <span>${esc(snap.ua || d.browser || '')}</span>
          <span>Screen ${esc(snap.screen || d.screenSize || '—')} · Viewport ${esc(snap.viewport || '—')}</span>
          <span>TZ ${esc(snap.tz || '—')} · Net ${esc(snap.net || d.networkType || '—')}</span>
          <span>User ${esc(uid || '—')} · Session ${esc(sess || '—')}</span>
          <span>Trail: ${trail.length} entries · ${actions} actions · ${problems.length} problems</span>
          <span>Page ${esc(snap.href || r.url || '')}</span>
        </div>`;

      host.innerHTML = trail.length
        ? head + trail.map(logRowHTML).join('')
        : head + '<div class="kr-rpt-diag-empty">No session log found for this visit.</div>';
    } catch (e) {
      host.innerHTML = `<div class="kr-rpt-diag-empty">${esc(e.message)}</div>`;
    }
  }

  /* ── DEVICE LOGS VIEW (problems only) ── */
  async function loadLogs() {
    $('krRptList').innerHTML = '<div class="kr-empty">Loading problem logs…</div>';
    try {
      const q = $('krLogSearch').value.trim();
      const kind = $('krLogKind').value;
      let url = `/api/admin/client-logs?limit=400`;
      if (q) url += `&uid=${encodeURIComponent(q)}`;
      if (kind) url += `&kind=${encodeURIComponent(kind)}`;
      const r = await krAdminFetch(url);
      if (!r.ok) throw new Error(r.error || 'Failed to load logs');
      /* Problems ONLY — clicks, page loads and snapshots stay hidden. */
      const logs = (r.logs || []).filter((l) => {
        if (!isProblem(l)) return false;
        if (!q) return true;
        const pl = payloadOf(l);
        return (l.uid || '').toLowerCase().includes(q.toLowerCase()) ||
               String(pl.msg || '').toLowerCase().includes(q.toLowerCase()) ||
               String(pl.stack || '').toLowerCase().includes(q.toLowerCase());
      }).sort((a, b) => Number(b.ts) - Number(a.ts));
      if (!logs.length) {
        $('krRptList').innerHTML = '<div class="kr-empty">No problems logged — everything is running clean.</div>';
        return;
      }
      $('krRptList').innerHTML = `<div class="kr-rpt-log-wrap">${logs.map(logRowHTML).join('')}</div>`;
    } catch (e) {
      $('krRptList').innerHTML = `<div class="kr-empty">${esc(e.message)}</div>`;
    }
  }

  function setView(v) {
    view = v;
    document.querySelectorAll('.kr-vtab').forEach((b) => b.classList.toggle('is-active', b.dataset.view === v));
    $('krRptReportsTools').style.display = v === 'reports' ? '' : 'none';
    $('krRptLogsTools').style.display = v === 'logs' ? '' : 'none';
    $('krRptStats').style.display = v === 'reports' ? '' : 'none';
    if (v === 'reports') load(); else loadLogs();
  }

  /* ── SAVE / DELETE ── */
  async function save(id) {
    const status = $('krRptStatusSel').value;
    const admin_note = $('krRptNote').value;
    try {
      const r = await krAdminFetch('/api/admin/bug-reports/update', {
        method: 'POST',
        body: JSON.stringify({ id, status, admin_note })
      });
      if (!r.ok) throw new Error(r.error || 'Update failed');
      krToast('Report updated', 'success');
      closeModal();
      await load();
    } catch (err) { krToast(err.message, 'error'); }
  }

  async function remove(id) {
    const ok = await krConfirm(`Delete report ${id}? This cannot be undone.`);
    if (!ok) return;
    try {
      const r = await krAdminFetch(`/api/admin/bug-reports/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(r.error || 'Delete failed');
      krToast('Report deleted', 'success');
      closeModal();
      await load();
    } catch (err) { krToast(err.message, 'error'); }
  }

  /* ── EVENTS ── */
  document.addEventListener('click', (e) => {
    const summary = e.target.closest('.kr-rpt-summary');
    if (!summary) return;
    const card = summary.closest('[data-id]');
    if (!card) return;
    const r = rows.find((x) => x.id === card.dataset.id);
    if (r) openReport(r);
  });

  $('krViewTabs').onclick = (e) => {
    const btn = e.target.closest('[data-view]');
    if (btn) setView(btn.dataset.view);
  };

  $('krRptTabs').onclick = (e) => {
    const btn = e.target.closest('[data-status]');
    if (!btn) return;
    document.querySelectorAll('#krRptTabs .kr-rtab').forEach((b) => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    statusFilter = btn.dataset.status;
    render();
  };

  $('krRptRefreshBtn').onclick = () => {
    if (view === 'reports') { loadCategories(); load(); }
    else loadLogs();
  };
  $('krRptCategory').onchange = render;
  $('krRptPlatform').onchange = render;
  $('krRptSearch').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(render, 200);
  };
  $('krLogSearch').oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadLogs, 250);
  };
  $('krLogKind').onchange = loadLogs;

  /* Popup close: X button, backdrop click, Escape key. */
  $('krRptModal').addEventListener('click', (e) => {
    if (e.target.id === 'krRptModal') closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  /* Site-style custom dropdowns everywhere on this page. */
  if (window.enhanceSelects) enhanceSelects(document);

  loadCategories();
  setView('reports');
})();
