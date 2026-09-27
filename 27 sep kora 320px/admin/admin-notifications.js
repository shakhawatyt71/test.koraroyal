/* ================================================================
   KORA ROYAL — Admin Notifications v1.0
   admin/admin-notifications.js  |  notifications.html এর সাথে load হয়
   ================================================================ */
'use strict';

(function () {
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('notifications');
  krAdminInitMobileNav();

  const $ = (id) => document.getElementById(id);
  const mb = $('krMobileMenuBtn');
  if (mb) mb.innerHTML = _SVG.menu;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  const BN_WEEKDAYS = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
  const BN_MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  const toBn = (v) => String(v).split('').map((c) => (/[0-9]/.test(c) ? BN_DIGITS[Number(c)] : c)).join('');

  let rows = [];
  let devices = [];
  let selectedPhones = [];
  let pollOptions = [{ id: 'opt1', label: '' }, { id: 'opt2', label: '' }];

  /* ── live preview vars (mirrors the worker template engine) ── */
  function previewVars() {
    const d = new Date(Date.now() + 6 * 3600000);
    const h = d.getUTCHours();
    const greeting = h < 5 ? 'শুভ রাত্রি' : h < 12 ? 'শুভ সকাল' : h < 16 ? 'শুভ দুপুর' : h < 19 ? 'শুভ বিকাল' : 'শুভ সন্ধ্যা';
    return {
      weekday_bn: BN_WEEKDAYS[d.getUTCDay()],
      day_bn: BN_WEEKDAYS[d.getUTCDay()],
      date_bn: toBn(d.getUTCDate()),
      month_bn: BN_MONTHS[d.getUTCMonth()],
      year_bn: toBn(d.getUTCFullYear()),
      full_bn: BN_WEEKDAYS[d.getUTCDay()] + ', ' + toBn(d.getUTCDate()) + ' ' + BN_MONTHS[d.getUTCMonth()] + ' ' + toBn(d.getUTCFullYear()),
      greeting,
      time: String(h).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0')
    };
  }
  const renderTpl = (s, v) => String(s || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => (v[k] !== undefined ? String(v[k]) : m));

  /* ══════════ BANNER / SETUP STATE ══════════ */
  async function checkSetup() {
    try {
      const r = await krAdminFetch('/api/admin/notifications?limit=1');
      if (!r.ok) { banner('Could not reach the notification API: ' + (r.error || 'unknown'), false); return false; }
      if (!r.ready) {
        banner('Notification tables are not created yet. Open <a href="setup-notify.html">setup-notify.html</a> once to finish the setup.', false);
        return false;
      }
      banner('Notification system is live. ' + (r.subscribers || 0) + ' device(s) subscribed.', true);
      return true;
    } catch (e) {
      banner('Setup check failed: ' + esc(e.message), false);
      return false;
    }
  }
  function banner(html, ok) {
    $('krNtfBanner').innerHTML = `<div class="kr-banner${ok ? ' ok' : ''}">
      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <div>${html}</div></div>`;
  }

  /* ══════════ STATS ══════════ */
  function renderStats() {
    const total = rows.length;
    const sent = rows.filter((r) => r.status === 'sent').length;
    const scheduled = rows.filter((r) => r.status === 'scheduled').length;
    const delivered = rows.reduce((n, r) => n + Number(r.delivered || 0), 0);
    const clicks = rows.reduce((n, r) => n + Number(r.clicks || 0), 0);
    const subs = $('krNtfDevCount').textContent || devices.length;
    $('krNtfStats').innerHTML = [
      ['Subscribed devices', subs],
      ['Total notifications', total],
      ['Delivered', delivered],
      ['Clicks', clicks],
      ['Scheduled', scheduled]
    ].map((x) => `<div class="kr-stat-card"><div class="kr-stat-label">${esc(x[0])}</div><div class="kr-stat-value">${esc(x[1])}</div></div>`).join('');
    $('krNtfHistCount').textContent = total;
  }

  /* ══════════ COMPOSE ══════════ */
  function refreshPreview() {
    const v = previewVars();
    $('pvTitle').textContent = renderTpl($('cnTitle').value || 'Your title appears here', v) || 'Your title appears here';
    $('pvBody').textContent = renderTpl($('cnBody').value || 'Your message appears here.', v);

    const img = $('cnImage').value.trim();
    const pvImg = $('pvImage');
    if (img) { pvImg.style.display = ''; pvImg.style.backgroundImage = `url('${img}')`; }
    else pvImg.style.display = 'none';

    const mins = parseInt($('cnTimer').value || '0', 10);
    const pvT = $('pvTimer');
    if (mins > 0) {
      pvT.style.display = '';
      const end = Date.now() + mins * 60000;
      const tick = () => {
        const left = end - Date.now();
        if (left <= 0) { pvT.textContent = 'Offer ended'; return; }
        const hh = Math.floor(left / 3600000), mm = Math.floor((left % 3600000) / 60000), ss = Math.floor((left % 60000) / 1000);
        pvT.textContent = (hh ? hh + 'h ' : '') + String(mm).padStart(2, '0') + 'm ' + String(ss).padStart(2, '0') + 's left';
      };
      tick();
      clearInterval(window.__krPvTimer);
      window.__krPvTimer = setInterval(tick, 1000);
    } else { pvT.style.display = 'none'; clearInterval(window.__krPvTimer); }

    const pvA = $('pvActions');
    if ($('cnPollEnabled').checked && pollOptions.filter((o) => o.label.trim()).length) {
      pvA.style.display = '';
      pvA.innerHTML = pollOptions.filter((o) => o.label.trim()).slice(0, 2)
        .map((o) => `<span>${esc(o.label.slice(0, 18))}</span>`).join('') + '<span>Close</span>';
    } else pvA.style.display = 'none';
  }

  function renderVarChips() {
    const vars = ['{{weekday_bn}}', '{{date_bn}}', '{{month_bn}}', '{{year_bn}}', '{{full_bn}}', '{{greeting}}', '{{time}}'];
    $('cnVarChips').innerHTML = vars.map((v) => `<button type="button" class="kr-chip" data-var="${esc(v)}">${esc(v)}</button>`).join('');
  }

  function renderPollOptions() {
    $('cnPollOptions').innerHTML = pollOptions.map((o, i) => `
      <div class="kr-poll-row">
        <input class="kr-input" data-poll="${i}" value="${esc(o.label)}" placeholder="Option ${i + 1}" maxlength="60" />
        <button class="kr-mini-btn" type="button" data-poll-del="${i}" ${pollOptions.length <= 2 ? 'disabled style="opacity:.4"' : ''}>
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');
  }

  function renderAudienceBox() {
    const kind = $('cnAudience').value;
    const box = $('cnAudienceBox');
    const inner = $('cnAudienceInner');
    if (kind === 'all') { box.style.display = 'none'; inner.innerHTML = ''; return; }
    box.style.display = '';

    if (kind === 'district') {
      inner.innerHTML = `<label class="kr-label">District name</label><input class="kr-input" id="cnDistrict" placeholder="Noakhali" />`;
    } else if (kind === 'tag') {
      inner.innerHTML = `<label class="kr-label">Tag</label><input class="kr-input" id="cnTag" placeholder="vip" />`;
    } else {
      inner.innerHTML = `
        <label class="kr-label">Selected customers — <b id="cnSelCount">${selectedPhones.length}</b> phone(s)</label>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
          <input class="kr-input" id="cnCustSearch" placeholder="Search customer by name or phone…" style="flex:1 1 200px;" />
          <button class="kr-btn kr-btn-ghost kr-btn-sm" id="cnCustLoad" type="button">Load customers</button>
        </div>
        <div id="cnCustList" class="kr-dev-list" style="max-height:260px;overflow-y:auto;"></div>
        <div class="kr-field" style="margin-top:8px;">
          <label class="kr-label">Or paste phone numbers (one per line)</label>
          <textarea class="kr-input" id="cnPhones" placeholder="01967002782&#10;01712345678">${esc(selectedPhones.join('\n'))}</textarea>
        </div>`;
      const loadBtn = $('cnCustLoad');
      if (loadBtn) loadBtn.onclick = loadCustomers;
    }
  }

  async function loadCustomers() {
    const host0 = $('cnCustList');
    if (!host0) return;                       /* audience is not "phones" right now */
    const q = ($('cnCustSearch') ? $('cnCustSearch').value : '').trim();
    try {
      krShowLoading(true);
      const r = await krAdminFetch('/api/admin/customers?page=1&limit=60&search=' + encodeURIComponent(q));
      if (!r.ok) throw new Error(r.error || 'Failed to load customers');
      const list = r.customers || [];
      host0.innerHTML = list.length ? list.map((c) => {
        const phone = String(c.primary_phone || '').replace(/^0/, '');
        const on = selectedPhones.includes(phone);
        return `<div class="kr-dev"><div class="kr-dev-info"><b>${esc(c.display_name || 'Unnamed')}</b>
          <small>${esc(c.primary_phone || '')} · ${esc(c.district || '')} · ${c.order_count || 0} orders</small></div>
          <button class="kr-btn ${on ? 'kr-btn-primary' : 'kr-btn-ghost'} kr-btn-sm" data-cust="${esc(phone)}">${on ? 'Added' : 'Add'}</button></div>`;
      }).join('') : '<div class="kr-empty">No customers found</div>';
    } catch (e) { krToast(e.message, 'error'); }
    finally { krShowLoading(false); }
  }

  function buildPayload() {
    const when = $('cnWhen').value;
    const title = $('cnTitle').value.trim();
    const body = $('cnBody').value.trim();
    if (!title) throw new Error('Title is required');

    const payload = {
      title, body,
      image: $('cnImage').value.trim(),
      url: $('cnUrl').value.trim() || '/',
      category: $('cnCategory').value,
      priority: $('cnPriority').value,
      audience: $('cnAudience').value,
      timerMinutes: parseInt($('cnTimer').value || '0', 10) || 0,
      expiresAt: (parseInt($('cnExpires').value || '0', 10) || 0) ? Date.now() + parseInt($('cnExpires').value, 10) * 3600000 : 0,
      audienceConfig: {}
    };

    const kind = payload.audience;
    const val = (id) => { const el = $(id); return el ? String(el.value || '').trim() : ''; };
    if (kind === 'district') {
      payload.audienceConfig.district = val('cnDistrict');
      if (!payload.audienceConfig.district) throw new Error('District name is required');
    } else if (kind === 'tag') {
      payload.audienceConfig.tag = val('cnTag');
      if (!payload.audienceConfig.tag) throw new Error('Tag is required');
    } else if (kind === 'phones') {
      const fromBox = val('cnPhones').split(/[\n,\s]+/).map((x) => x.trim()).filter(Boolean);
      const merged = Array.from(new Set(selectedPhones.concat(fromBox)));
      if (!merged.length) throw new Error('Select at least one customer or paste a phone number');
      payload.audienceConfig.phones = merged;
    }

    if ($('cnPollEnabled').checked) {
      const opts = pollOptions.map((o, i) => ({ id: 'opt' + (i + 1), label: o.label.trim() })).filter((o) => o.label);
      if (opts.length < 2) throw new Error('A poll needs at least 2 options');
      payload.poll = { question: $('cnPollQuestion').value.trim() || title, options: opts };
    }

    if (when === 'once') {
      const d = $('cnDate').value, t = $('cnTime').value || '09:00';
      if (!d) throw new Error('Pick a date');
      payload.sendDate = d; payload.sendTime = t;
    } else if (when !== 'now') {
      payload.recurrence = when;
      const at = $('cnRecurAt').value;
      if (at) payload.sendTime = at;
      else { payload.randomFrom = $('cnRandFrom').value || '07:00'; payload.randomTo = $('cnRandTo').value || '10:30'; }
    }
    return payload;
  }

  async function act(mode) {
    let payload;
    try { payload = buildPayload(); }
    catch (e) { krToast(e.message, 'error'); return; }

    try {
      krShowLoading(true);
      let r;
      if (mode === 'send') {
        r = await krAdminFetch('/api/admin/notifications/send', { method: 'POST', body: JSON.stringify({ ...payload, recurrence: '', status: 'queued' }) });
      } else if (mode === 'schedule') {
        r = await krAdminFetch('/api/admin/notifications/create', { method: 'POST', body: JSON.stringify({ ...payload, status: payload.recurrence ? 'scheduled' : 'queued' }) });
      } else {
        r = await krAdminFetch('/api/admin/notifications/create', { method: 'POST', body: JSON.stringify({ ...payload, recurrence: '', scheduledAt: 0, status: 'draft' }) });
      }
      if (!r.ok) throw new Error(r.error || 'Failed');
      if (mode === 'send') krToast(`Sent to ${r.delivered || 0} device(s)${r.hasMore ? ' — the rest will finish within a minute' : ''}`, 'success');
      else if (mode === 'schedule') krToast('Scheduled — next run ' + krFmtDate(r.nextRun), 'success');
      else krToast('Saved as draft', 'success');
      await loadHistory();
      renderStats();
      switchPane('history');
    } catch (e) { krToast(e.message, 'error'); }
    finally { krShowLoading(false); }
  }

  function resetForm() {
    $('cnTitle').value = ''; $('cnBody').value = ''; $('cnImage').value = '';
    $('cnUrl').value = '/#kr-products'; $('cnTimer').value = '0'; $('cnExpires').value = '0';
    $('cnWhen').value = 'now'; $('cnPollEnabled').checked = false; $('cnPollBox').style.display = 'none';
    $('cnAudience').value = 'all';
    $('cnWhen').value = 'now';
    $('cnOnceBox').style.display = 'none';
    $('cnRecurBox').style.display = 'none';
    selectedPhones = [];
    pollOptions = [{ id: 'opt1', label: '' }, { id: 'opt2', label: '' }];
    renderPollOptions(); renderAudienceBox(); refreshPreview();
  }

  /* ══════════ HISTORY ══════════ */
  async function loadHistory() {
    $('krNtfList').innerHTML = '<div class="kr-empty">Loading…</div>';
    try {
      const r = await krAdminFetch('/api/admin/notifications?limit=200');
      if (!r.ok) throw new Error(r.error || 'Failed to load');
      rows = r.notifications || [];
      $('krNtfDevCount').textContent = r.subscribers || 0;
      renderStats();
      renderHistory();
    } catch (e) { $('krNtfList').innerHTML = `<div class="kr-empty">${esc(e.message)}</div>`; }
  }

  const STATUS_PILL = {
    sent: 'green', scheduled: 'blue', sending: 'amber', draft: 'grey',
    queued: 'amber', cancelled: 'grey', expired: 'grey', failed: 'grey'
  };

  function renderHistory() {
    if (!rows.length) { $('krNtfList').innerHTML = '<div class="kr-empty">No notifications yet</div>'; return; }
    $('krNtfList').innerHTML = rows.map((n) => {
      const rt = (() => { try { return JSON.parse(n.random_time_json || ''); } catch (e) { return null; } })();
      const schedule = n.recurrence
        ? `${n.recurrence}${rt && rt.from ? ' · random ' + rt.from + '–' + rt.to : rt && rt.at ? ' · ' + rt.at : ''}`
        : n.next_run_at ? 'runs ' + krFmtDate(n.next_run_at) : (n.sent_at ? 'sent ' + krFmtDate(n.sent_at) : 'not sent');
      const hasPoll = !!n.poll_json;
      return `<article class="kr-ntf-card" data-nid="${esc(n.id)}">
        <div class="kr-ntf-card-top">
          <div style="min-width:0;flex:1;">
            <h4>${esc(n.title)}</h4>
            <p>${esc(n.body)}</p>
            <div class="kr-ntf-meta">
              <span class="kr-pill ${STATUS_PILL[n.status] || 'grey'}">${esc(n.status)}</span>
              <span class="kr-pill coral">${esc(n.type || 'general')}</span>
              <span class="kr-pill">${esc(n.audience)}</span>
              ${Number(n.timer_duration_min) > 0 ? `<span class="kr-pill amber">${esc(n.timer_duration_min)} min timer</span>` : ''}
              ${hasPoll ? '<span class="kr-pill blue">poll</span>' : ''}
              ${n.image ? '<span class="kr-pill">image</span>' : ''}
              <span class="kr-pill">${esc(schedule)}</span>
            </div>
          </div>
        </div>
        <div class="kr-ntf-stats">
          <div class="kr-ntf-stat"><b>${esc(n.delivered || 0)}</b>delivered</div>
          <div class="kr-ntf-stat"><b>${esc(n.failed || 0)}</b>failed</div>
          <div class="kr-ntf-stat"><b>${esc(n.clicks || 0)}</b>clicks</div>
          <div class="kr-ntf-stat"><b>${esc(n.total_targets || 0)}</b>targets</div>
        </div>
        <div class="kr-poll-result" data-poll-result></div>
        <div class="kr-ntf-card-actions">
          <button class="kr-btn kr-btn-primary kr-btn-sm" data-a="send">Send now</button>
          ${hasPoll ? '<button class="kr-btn kr-btn-ghost kr-btn-sm" data-a="poll">Poll results</button>' : ''}
          ${n.status === 'cancelled'
            ? '<button class="kr-btn kr-btn-ghost kr-btn-sm" data-a="resume">Resume</button>'
            : '<button class="kr-btn kr-btn-ghost kr-btn-sm" data-a="cancel">Cancel</button>'}
          <button class="kr-btn kr-btn-danger kr-btn-sm" data-a="delete">Delete</button>
        </div>
      </article>`;
    }).join('');
  }

  async function showPollResults(card, n) {
    const host = card.querySelector('[data-poll-result]');
    try {
      const r = await krAdminFetch('/api/admin/notifications/detail?id=' + encodeURIComponent(n.id));
      if (!r.ok) throw new Error(r.error || 'Failed');
      const res = r.pollResults || [];
      const total = res.reduce((s, o) => s + Number(o.votes || 0), 0);
      host.innerHTML = total || res.length ? res.map((o) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        return `<div class="kr-poll-bar-row"><div class="kr-poll-bar-meta"><span>${esc(o.label)}</span><span>${o.votes} (${pct}%)</span></div>
          <div class="kr-poll-bar-track"><div class="kr-poll-bar-fill" style="width:${pct}%"></div></div></div>`;
      }).join('') + `<div class="kr-hint">${total} total vote(s)</div>` : '<div class="kr-empty">No votes yet</div>';
    } catch (e) { host.innerHTML = `<div class="kr-empty">${esc(e.message)}</div>`; }
  }

  /* ══════════ DEVICES ══════════ */
  async function loadDevices() {
    $('krDevList').innerHTML = '<div class="kr-empty">Loading…</div>';
    try {
      const q = $('dvSearch').value.trim();
      const r = await krAdminFetch('/api/admin/notifications/subscribers?limit=300&search=' + encodeURIComponent(q));
      devices = r.subscribers || [];
      $('krNtfDevCount').textContent = r.total || 0;
      renderStats();
      $('krDevList').innerHTML = devices.length ? devices.map((d) => `
        <div class="kr-dev"><div class="kr-dev-info">
          <b>${esc(d.phone || 'no phone')}</b>
          <small>${esc(d.district || '—')} · ${esc(d.platform || 'unknown')} · last seen ${esc(krTimeAgo(d.last_seen_at))}${d.is_active ? '' : ' · INACTIVE'}</small>
        </div><button class="kr-btn kr-btn-ghost kr-btn-sm" data-test="${esc(d.id)}">Test</button></div>`).join('')
        : '<div class="kr-empty">No subscribed devices yet</div>';
    } catch (e) { $('krDevList').innerHTML = `<div class="kr-empty">${esc(e.message)}</div>`; }
  }

  async function sendTest(subscriberId) {
    try {
      krShowLoading(true);
      const r = await krAdminFetch('/api/admin/notifications/test', {
        method: 'POST',
        body: JSON.stringify({ subscriberId, title: 'KORA ROYAL test', body: 'আপনার নোটিফিকেশন সিস্টেম ঠিকঠাক কাজ করছে।' })
      });
      krToast(r.ok ? 'Test push delivered' : 'Push failed: ' + (r.error || r.status), r.ok ? 'success' : 'error');
    } catch (e) { krToast(e.message, 'error'); }
    finally { krShowLoading(false); }
  }

  /* ══════════ PANES ══════════ */
  function switchPane(name) {
    document.querySelectorAll('.kr-ntab').forEach((b) => b.classList.toggle('is-active', b.dataset.pane === name));
    document.querySelectorAll('.kr-ntf-pane').forEach((p) => p.classList.toggle('is-active', p.id === 'krPane' + name.charAt(0).toUpperCase() + name.slice(1)));
    if (name === 'history') loadHistory();
    if (name === 'devices') loadDevices();
  }

  /* ══════════ EVENTS ══════════ */
  $('krNtfTabs').onclick = (e) => { const b = e.target.closest('[data-pane]'); if (b) switchPane(b.dataset.pane); };
  $('krNtfRefreshBtn').onclick = () => { checkSetup(); loadHistory(); loadDevices(); };

  ['cnTitle', 'cnBody', 'cnImage', 'cnTimer'].forEach((id) => {
    $(id).addEventListener('input', refreshPreview);
  });
  $('cnVarChips').onclick = (e) => {
    const b = e.target.closest('[data-var]');
    if (!b) return;
    const el = $('cnTitle');
    el.value = (el.value + ' ' + b.dataset.var).trim();
    refreshPreview();
  };
  $('cnPollEnabled').onchange = () => { $('cnPollBox').style.display = $('cnPollEnabled').checked ? '' : 'none'; refreshPreview(); };
  $('cnPollAdd').onclick = () => {
    if (pollOptions.length >= 6) { krToast('Maximum 6 options', 'info'); return; }
    pollOptions.push({ id: 'opt' + (pollOptions.length + 1), label: '' });
    renderPollOptions(); refreshPreview();
  };
  $('cnPollOptions').addEventListener('input', (e) => {
    const i = e.target.dataset.poll;
    if (i === undefined) return;
    pollOptions[Number(i)].label = e.target.value;
    refreshPreview();
  });
  $('cnPollOptions').addEventListener('click', (e) => {
    const b = e.target.closest('[data-poll-del]');
    if (!b || b.disabled) return;
    pollOptions.splice(Number(b.dataset.pollDel), 1);
    renderPollOptions(); refreshPreview();
  });
  $('cnAudience').onchange = renderAudienceBox;
  $('cnWhen').onchange = () => {
    const w = $('cnWhen').value;
    $('cnOnceBox').style.display = w === 'once' ? '' : 'none';
    $('cnRecurBox').style.display = (w === 'daily' || w === 'weekday' || w === 'weekly' || w === 'monthly') ? '' : 'none';
  };
  $('cnSend').onclick = () => act('send');
  $('cnSchedule').onclick = () => act('schedule');
  $('cnDraft').onclick = () => act('draft');
  $('cnReset').onclick = resetForm;

  document.addEventListener('click', async (e) => {
    const cust = e.target.closest('[data-cust]');
    if (cust) {
      const p = cust.dataset.cust;
      if (selectedPhones.includes(p)) selectedPhones = selectedPhones.filter((x) => x !== p);
      else selectedPhones.push(p);
      const cnt = $('cnSelCount');
      if (cnt) cnt.textContent = selectedPhones.length;
      cust.textContent = selectedPhones.includes(p) ? 'Added' : 'Add';
      cust.className = 'kr-btn ' + (selectedPhones.includes(p) ? 'kr-btn-primary' : 'kr-btn-ghost') + ' kr-btn-sm';
      return;
    }

    const test = e.target.closest('[data-test]');
    if (test) { sendTest(test.dataset.test); return; }

    const btn = e.target.closest('[data-a]');
    if (!btn) return;
    const card = btn.closest('[data-nid]');
    if (!card) return;
    const n = rows.filter((x) => x.id === card.dataset.nid)[0];
    if (!n) return;
    const a = btn.dataset.a;

    if (a === 'poll') { showPollResults(card, n); return; }
    if (a === 'send') {
      const ok = await krConfirm(`Send "${n.title}" to all matching devices now?`);
      if (!ok) return;
      try {
        krShowLoading(true);
        const r = await krAdminFetch('/api/admin/notifications/send', { method: 'POST', body: JSON.stringify({ id: n.id }) });
        if (!r.ok) throw new Error(r.error || 'Failed');
        krToast(`Sent to ${r.delivered || 0} device(s)${r.hasMore ? ' — the rest will finish within a minute' : ''}`, 'success');
        await loadHistory();
      } catch (err) { krToast(err.message, 'error'); }
      finally { krShowLoading(false); }
      return;
    }
    if (a === 'cancel' || a === 'resume') {
      const status = a === 'cancel' ? 'cancelled' : 'scheduled';
      const r = await krAdminFetch('/api/admin/notifications/status', { method: 'POST', body: JSON.stringify({ id: n.id, status }) });
      krToast(r.ok ? 'Updated' : (r.error || 'Failed'), r.ok ? 'success' : 'error');
      if (r.ok) await loadHistory();
      return;
    }
    if (a === 'delete') {
      const ok = await krConfirm(`Delete "${n.title}" and its delivery history?`);
      if (!ok) return;
      const r = await krAdminFetch('/api/admin/notifications?id=' + encodeURIComponent(n.id), { method: 'DELETE' });
      krToast(r.ok ? 'Deleted' : (r.error || 'Failed'), r.ok ? 'success' : 'error');
      if (r.ok) await loadHistory();
    }
  });

  $('dvSearchBtn').onclick = loadDevices;
  $('dvSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDevices(); });
  $('dvTestBtn').onclick = () => {
    if (!devices.length) { krToast('No devices to test', 'info'); return; }
    sendTest(devices[0].id);
  };

  /* ══════════ INIT ══════════ */
  renderVarChips();
  renderPollOptions();
  renderAudienceBox();
  refreshPreview();
  enhanceSelects(document);
  checkSetup().then((ok) => { if (ok) { loadHistory(); loadDevices(); } });
})();
