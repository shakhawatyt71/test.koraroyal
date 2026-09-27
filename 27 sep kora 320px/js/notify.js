/* ================================================================
   KORA ROYAL — Notification Client v1.0
   js/notify.js

   - Web Push permission (asked once, never nagging)
   - Subscribes the device to the Cloudflare Worker
   - In-app notification center (bell + mobile menu entry)
   - Live countdown timer, poll voting, read/delete
   - Click tracking back to the Worker
   ================================================================ */

'use strict';

(function () {
  'use strict';

  const API = 'https://kora-api.shakhawatyt77.workers.dev';

  const LS = {
    sid: 'kr_notify_sid',
    asked: 'kr_notify_asked_at',
    endpoint: 'kr_notify_endpoint',
    enabled: 'kr_notify_enabled',
    unread: 'kr_notify_unread'
  };

  const ICONS = {
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    markAll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/><polyline points="22 10 13 19"/></svg>',
    inbox: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>'
  };

  let panel = null;
  let items = [];
  let unread = 0;
  let timerHandle = null;
  let subscription = null;
  let pollVoteCache = {};

  function sid() { return localStorage.getItem(LS.sid) || ''; }
  function setSid(v) { if (v) localStorage.setItem(LS.sid, v); else localStorage.removeItem(LS.sid); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function api(path, body, method) {
    const opts = { method: method || (body ? 'POST' : 'GET'), headers: {} };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch(API + path, opts);
    return res.json();
  }

  /* =========================================================
     PERMISSION — accurate on/off detection, polite 24h re-ask

     Rules:
     - Every visit checks whether notifications are really ON.
     - If ON  -> never bother the user at all.
     - If OFF -> ask again, but at most once per 24 hours.
     - Detection is ACCURATE: browser permission + a live push
       subscription + real display proof (the service worker
       reports 'shown'/'show_failed' after every notification).
     ========================================================= */
  const ASK_INTERVAL_MS = 24 * 60 * 60 * 1000;   /* one ask per 24h */

  function askedAt() { return parseInt(localStorage.getItem(LS.asked) || '0', 10) || 0; }
  function markAsked() { localStorage.setItem(LS.asked, String(Date.now())); }
  function canAskAgain() { return (Date.now() - askedAt()) >= ASK_INTERVAL_MS; }

  /* Returns 'on' | 'off' | 'blocked' | 'unsupported'.
     blocked = permission denied at browser or OS level (needs Settings). */
  async function detectNotifyState() {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
      const perm = Notification.permission;
      if (perm === 'denied') return 'blocked';
      if (perm === 'default') return 'off';
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && reg.pushManager ? await reg.pushManager.getSubscription() : null;
      if (!sub) return 'off';
      if (sid()) {
        const st = await api('/api/notify/state?sid=' + encodeURIComponent(sid()));
        if (st && st.ok) {
          if (st.exists && Number(st.active) === 0) return 'off';
          /* The service worker reports after every real display attempt.
             'show_failed' as the last report = the phone is swallowing
             notifications (OS-level off). */
          if (st.lastType === 'show_failed') return 'blocked';
          if (Number(st.showFailed || 0) > 0 && Number(st.shown || 0) === 0) return 'blocked';
        }
      }
      return 'on';
    } catch (e) {
      return 'off';
    }
  }

  async function requestPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    if (Notification.permission === 'granted') { await subscribe(); return true; }
    if (Notification.permission === 'denied') { showSettingsHelp('browser'); return false; }

    markAsked();
    const granted = await showPrePermission();
    if (!granted) return false;

    const result = await Notification.requestPermission();
    if (result !== 'granted') {
      if (result === 'denied') showSettingsHelp('browser');
      return false;
    }
    await subscribe();
    return true;
  }

  /* Settings-help card: shown when the browser or the phone OS already
     blocks notifications, so the normal permission dialog cannot appear. */
  function showSettingsHelp(kind) {
    if (document.querySelector('.kr-ntf-perm')) return;
    markAsked();
    const wrap = document.createElement('div');
    wrap.className = 'kr-ntf-perm';
    const steps = kind === 'os'
      ? 'ফোনের Settings এ গিয়ে এই অ্যাপ/ব্রাউজারের Notifications চালু করুন: App info → Notifications → Allow। তারপর নিচের বোতামে চাপ দিন।'
      : 'ঠিকানা বারের তালা বা সেটিংস আইকনে চাপ দিন → Notifications → Allow। তারপর নিচের বোতামে চাপ দিন।';
    wrap.innerHTML =
      '<div class="kr-ntf-perm-card">' +
        '<div class="kr-ntf-perm-ico">' + ICONS.bell + '</div>' +
        '<h3>নোটিফিকেশন চালু করুন</h3>' +
        '<p>' + steps + ' অফার, ফ্ল্যাশ সেল আর অর্ডার আপডেট সরাসরি ফোনে পেতে নোটিফিকেশন চালু থাকা দরকার।</p>' +
        '<div class="kr-ntf-perm-btns">' +
          '<button type="button" class="kr-ntf-perm-no">পরে</button>' +
          '<button type="button" class="kr-ntf-perm-yes">আবার চেক করুন</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);
    requestAnimationFrame(function () { wrap.classList.add('show'); });
    function close(recheck) {
      wrap.classList.remove('show');
      setTimeout(function () {
        wrap.remove();
        if (recheck) checkNotifyNag(true);
      }, 260);
    }
    wrap.querySelector('.kr-ntf-perm-yes').onclick = function () { close(true); };
    wrap.querySelector('.kr-ntf-perm-no').onclick = function () { close(false); };
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(false); });
  }

  function showPrePermission() {
    return new Promise(function (resolve) {
      const wrap = document.createElement('div');
      wrap.className = 'kr-ntf-perm';
      wrap.innerHTML =
        '<div class="kr-ntf-perm-card">' +
          '<div class="kr-ntf-perm-ico">' + ICONS.bell + '</div>' +
          '<h3>Turn on notifications?</h3>' +
          '<p>অফার, ফ্ল্যাশ সেল আর আপনার অর্ডারের আপডেট সরাসরি ফোনে পাবেন। আমরা একদিনে একটির বেশি অপ্রয়োজনীয় নোটিফিকেশন পাঠাই না।</p>' +
          '<div class="kr-ntf-perm-btns">' +
            '<button type="button" class="kr-ntf-perm-no">Not now</button>' +
            '<button type="button" class="kr-ntf-perm-yes">Allow</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(wrap);
      requestAnimationFrame(function () { wrap.classList.add('show'); });

      function close(v) {
        wrap.classList.remove('show');
        setTimeout(function () { wrap.remove(); resolve(v); }, 260);
      }
      wrap.querySelector('.kr-ntf-perm-yes').onclick = function () { close(true); };
      wrap.querySelector('.kr-ntf-perm-no').onclick = function () { close(false); };
      wrap.addEventListener('click', function (e) { if (e.target === wrap) close(false); });
    });
  }

  /* Single 24h-gated entry point. userInitiated (menu/panel button) always
     works — the gate only limits automatic nagging. */
  async function checkNotifyNag(userInitiated) {
    const state = await detectNotifyState();
    if (state === 'on') { localStorage.setItem(LS.enabled, 'on'); return state; }
    localStorage.setItem(LS.enabled, 'off');
    if (state === 'unsupported') return state;
    if (!userInitiated && !canAskAgain()) return state;
    if (state === 'off') {
      await requestPermission();
    } else if (state === 'blocked') {
      showSettingsHelp(Notification.permission === 'denied' ? 'browser' : 'os');
    }
    return state;
  }

  /* =========================================================
     SUBSCRIBE
     ========================================================= */
  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const cfg = await api('/api/notify/config');
      if (!cfg.ok || !cfg.enabled) return false;

      const urlB64 = cfg.vapidPublicKey.replace(/-/g, '+').replace(/_/g, '/');
      const pad = urlB64.length % 4 ? new Array(5 - (urlB64.length % 4)).join('=') : '';
      const bin = atob(urlB64 + pad);
      const appKey = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) appKey[i] = bin.charCodeAt(i);

      const existing = await reg.pushManager.getSubscription();
      if (existing && localStorage.getItem(LS.endpoint) === existing.endpoint) {
        subscription = existing;
        await syncContact();
        /* Server marked this device inactive (expired endpoint) — make
           sure the server knows we are alive again. */
        return true;
      }
      /* Endpoint changed or subscription missing — stale keys can never be
         fixed by reusing them, so drop and re-subscribe cleanly. */
      if (existing) {
        try { await existing.unsubscribe(); } catch (e) {}
      }

      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appKey
      });
      localStorage.setItem(LS.endpoint, subscription.endpoint);
      await pushSubscription();
      return true;
    } catch (e) {
      console.warn('[Notify] subscribe failed:', e);
      return false;
    }
  }

  function readContact() {
    const out = { phone: '', district: '' };
    try {
      const raw = localStorage.getItem('kr_last_order');
      if (raw) {
        const o = JSON.parse(raw);
        const c = (o && o.customer) || o || {};
        const found = Object.keys(c).filter(function (k) { return /phone/i.test(k); })[0];
        if (found) out.phone = String(c[found] || '').slice(0, 20);
        if (c.district) out.district = String(c.district).slice(0, 80);
      }
    } catch (e) {}
    const field = document.getElementById('krPhone') || document.getElementById('fieldPhone');
    if (field && field.value) out.phone = String(field.value).slice(0, 20);
    return out;
  }

  async function pushSubscription() {
    if (!subscription) return;
    const keys = subscription.toJSON().keys || {};
    const contact = readContact();
    const body = {
      subscription: { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      userAgent: navigator.userAgent.slice(0, 300),
      platform: detectPlatform(),
      phone: contact.phone,
      district: contact.district
    };
    const r = await api('/api/notify/subscribe', body);
    if (r && r.ok && r.id) {
      setSid(r.id);
      loadInbox();
    }
  }

  async function syncContact() {
    if (!subscription) return;
    const keys = subscription.toJSON().keys || {};
    const contact = readContact();
    if (!contact.phone) return;
    await api('/api/notify/subscribe', {
      subscription: { endpoint: subscription.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      userAgent: navigator.userAgent.slice(0, 300),
      platform: detectPlatform(),
      phone: contact.phone,
      district: contact.district
    });
  }

  function detectPlatform() {
    const ua = navigator.userAgent;
    if (/wv|; wv\)/.test(ua) || window.KR_IS_NATIVE) return 'app';
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return 'app';
    if (/Android/i.test(ua)) return 'android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    return 'web';
  }

  /* =========================================================
     INBOX
     ========================================================= */
  async function loadInbox(silent) {
    if (!sid()) return;
    try {
      const r = await api('/api/notify/inbox?sid=' + encodeURIComponent(sid()));
      if (!r.ok) return;
      items = r.items || [];
      unread = r.unread || 0;
      updateBadges();
      try { localStorage.setItem(LS.unread, String(unread)); } catch (e) {}
      if (!silent && panel) renderPanel();
    } catch (e) {}
  }

  function updateBadges() {
    /* Dot indicators — menu (hamburger) button + the Notifications row
       inside the mobile menu. Pure #FF6044 dot, no number. */
    ensureHamburgerBadge();
    document.querySelectorAll('[data-kr-ntf-dot]').forEach(function (el) {
      el.style.display = unread > 0 ? 'flex' : 'none';
    });
    /* Numeric badges — floating bell (homepage) + header bell.
       9+ cap per spec — 10 or more shows "9+".
       NOTE: always set an explicit display value; assigning '' would fall
       back to the stylesheet (display:none) and the badge would never show. */
    const label = unread > 9 ? '9+' : String(unread);
    document.querySelectorAll('[data-kr-ntf-count]').forEach(function (el) {
      el.textContent = label;
      el.style.display = unread > 0 ? 'inline-flex' : 'none';
    });
    /* Home-screen icon badge (numbered red dot) — Badging API. */
    try {
      if (navigator.setAppBadge) {
        if (unread > 0) navigator.setAppBadge(Math.min(unread, 99)).catch(function () {});
        else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
      }
    } catch (e) {}
    /* Keep the count in localStorage so it survives reloads (no accounts). */
    try { localStorage.setItem(LS.unread, String(unread)); } catch (e) {}
  }

  function ensureHamburgerBadge() {
    const btn = document.getElementById('krHamburger');
    if (!btn || document.getElementById('krHamburgerBadge')) return;
    const badge = document.createElement('span');
    badge.id = 'krHamburgerBadge';
    badge.setAttribute('aria-hidden', 'true');
    badge.setAttribute('data-kr-ntf-dot', '');
    badge.style.cssText = [
      'position:absolute', 'top:2px', 'right:2px', 'width:9px', 'height:9px',
      'background:#FF6044', 'border-radius:50%', 'box-shadow:0 0 0 2px var(--bg-body,#F2EFE9)',
      'display:none', 'pointer-events:none', 'z-index:5'
    ].join(';');
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.appendChild(badge);
  }

  /* =========================================================
     PANEL
     ========================================================= */
  function createPanel() {
    if (panel) return panel;
    panel = document.createElement('div');
    panel.className = 'kr-ntf-panel';
    panel.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light');
    panel.innerHTML =
      '<div class="kr-ntf-panel-inner">' +
        '<header class="kr-ntf-head">' +
          '<h3><span>' + ICONS.inbox + '</span>Notifications</h3>' +
          '<div class="kr-ntf-head-btns">' +
            '<button type="button" class="kr-ntf-icon-btn" data-act="read-all" title="Mark all read">' + ICONS.markAll + '</button>' +
            '<button type="button" class="kr-ntf-icon-btn" data-act="close" title="Close">' + ICONS.close + '</button>' +
          '</div>' +
        '</header>' +
        '<div class="kr-ntf-body" id="krNtfBody"></div>' +
        '<footer class="kr-ntf-foot">' +
          '<button type="button" class="kr-ntf-text-btn" data-act="enable">' +
            '<span>' + ICONS.bell + '</span><span id="krNtfEnableLabel">Enable notifications</span>' +
          '</button>' +
        '</footer>' +
      '</div>';
    document.body.appendChild(panel);

    panel.addEventListener('click', onPanelClick);
    requestAnimationFrame(function () { panel.classList.add('show'); });
    refreshEnableLabel();
    return panel;
  }

  function refreshEnableLabel() {
    const el = document.getElementById('krNtfEnableLabel');
    if (!el) return;
    if (!('Notification' in window)) { el.textContent = 'Notifications not supported'; return; }
    if (Notification.permission === 'granted') el.textContent = 'Notifications are on';
    else if (Notification.permission === 'denied') el.textContent = 'Blocked in browser settings';
    else el.textContent = 'Enable notifications';
  }

  function openPanel() {
    const p = createPanel();
    p.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light');
    p.classList.add('show');
    document.body.classList.add('kr-ntf-open');
    renderPanel();
    loadInbox();
  }

  function closePanel() {
    if (!panel) return;
    panel.classList.remove('show');
    document.body.classList.remove('kr-ntf-open');
  }

  function onPanelClick(e) {
    /* Vote / Delete / Open are plain item buttons (no [data-act]) — they MUST
       be handled FIRST. The old order checked [data-act] first and its early
       return silently swallowed every tap on these buttons (only the header
       close button worked). */
    const vote = e.target.closest('[data-vote]');
    if (vote) {
      const item = vote.closest('[data-item]');
      if (item) doVote(item.dataset.item, vote.dataset.vote);
      return;
    }

    const del = e.target.closest('[data-del]');
    if (del) {
      const id = del.dataset.del;
      api('/api/notify/inbox/delete', { sid: sid(), id: id });
      items = items.filter(function (i) { return i.id !== id; });
      renderPanel();
      loadInbox(true);
      return;
    }

    const open = e.target.closest('[data-open]');
    if (open) {
      const id = open.dataset.open;
      const it = items.filter(function (i) { return i.id === id; })[0];
      if (!it) return;
      if (!it.is_read) {
        it.is_read = 1;
        unread = Math.max(0, unread - 1);
        updateBadges();
        api('/api/notify/read', { sid: sid(), id: id });
      }
      if (it.url && it.url !== '#') {
        const u = new URL(it.url, location.origin);
        u.searchParams.set('ntf', it.notification_id + ':' + it.created_at);
        location.href = u.pathname + u.search + u.hash;
      } else {
        renderPanel();
      }
      return;
    }

    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'close') { closePanel(); return; }
    if (act === 'read-all') {
      api('/api/notify/read', { sid: sid() });
      items.forEach(function (i) { i.is_read = 1; });
      unread = 0;
      updateBadges();
      renderPanel();
      return;
    }
    if (act === 'enable') { requestPermission(); setTimeout(refreshEnableLabel, 600); return; }
  }

  async function doVote(itemId, optionId) {
    const it = items.filter(function (i) { return i.id === itemId; })[0];
    if (!it) return;
    pollVoteCache[itemId] = optionId;
    const r = await api('/api/notify/vote', { sid: sid(), notificationId: it.notification_id, optionId: optionId });
    if (r && r.ok) { it._tally = r.tally; renderPanel(); }
  }

  /* ---------- rendering ---------- */
  function timeAgo(ms) {
    const s = Math.floor((Date.now() - Number(ms)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.floor(s / 60) + 'm ago';
    if (s < 86400) return Math.floor(s / 3600) + 'h ago';
    if (s < 604800) return Math.floor(s / 86400) + 'd ago';
    const d = new Date(Number(ms));
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  }

  function countdownLabel(endsAt) {
    const left = Number(endsAt) - Date.now();
    if (left <= 0) return 'Offer ended';
    const h = Math.floor(left / 3600000);
    const m = Math.floor((left % 3600000) / 60000);
    const s = Math.floor((left % 60000) / 1000);
    if (h > 0) return h + 'h ' + String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's left';
    return String(m).padStart(2, '0') + 'm ' + String(s).padStart(2, '0') + 's left';
  }

  function pollHTML(it) {
    let poll = null;
    try { poll = JSON.parse(it.poll_json || ''); } catch (e) { return ''; }
    if (!poll || !poll.options || !poll.options.length) return '';
    const tally = it._tally || {};
    const total = Object.keys(tally).reduce(function (n, k) { return n + (tally[k] || 0); }, 0);
    const chosen = pollVoteCache[it.id];
    return '<div class="kr-ntf-poll">' +
      (poll.question ? '<div class="kr-ntf-poll-q">' + esc(poll.question) + '</div>' : '') +
      poll.options.map(function (o) {
        const votes = tally[o.id] || 0;
        const pct = total ? Math.round((votes / total) * 100) : 0;
        const isMine = chosen === o.id;
        const showResult = total > 0;
        return '<button type="button" class="kr-ntf-poll-opt' + (isMine ? ' is-mine' : '') + '" data-vote="' + esc(o.id) + '"' + (chosen ? ' disabled' : '') + '>' +
          (showResult ? '<span class="kr-ntf-poll-bar" style="width:' + pct + '%"></span>' : '') +
          '<span class="kr-ntf-poll-label">' + esc(o.label) + '</span>' +
          (showResult ? '<span class="kr-ntf-poll-pct">' + pct + '%</span>' : '') +
          (isMine ? '<span class="kr-ntf-poll-chk">' + ICONS.check + '</span>' : '') +
        '</button>';
      }).join('') +
      (total ? '<div class="kr-ntf-poll-total">' + total + ' vote' + (total === 1 ? '' : 's') + '</div>' : '') +
    '</div>';
  }

  function itemHTML(it) {
    const timer = Number(it.timer_ends_at) > 0
      ? '<div class="kr-ntf-timer" data-timer="' + esc(it.id) + '" data-ends="' + Number(it.timer_ends_at) + '">' +
          '<span>' + ICONS.clock + '</span><span class="kr-ntf-timer-val">' + countdownLabel(it.timer_ends_at) + '</span>' +
        '</div>'
      : '';
    const img = it.image ? '<div class="kr-ntf-img" style="background-image:url(\'' + esc(it.image) + '\')"></div>' : '';
    return '<article class="kr-ntf-item' + (it.is_read ? '' : ' is-unread') + '" data-item="' + esc(it.id) + '">' +
      img +
      '<div class="kr-ntf-item-main">' +
        '<div class="kr-ntf-item-top">' +
          '<span class="kr-ntf-cat">' + esc(it.category || 'general') + '</span>' +
          '<span class="kr-ntf-when">' + esc(timeAgo(it.created_at)) + '</span>' +
        '</div>' +
        '<h4>' + esc(it.title) + '</h4>' +
        (it.body ? '<p>' + esc(it.body) + '</p>' : '') +
        timer +
        pollHTML(it) +
        '<div class="kr-ntf-item-actions">' +
          '<button type="button" class="kr-ntf-link" data-open="' + esc(it.id) + '">Open</button>' +
          '<button type="button" class="kr-ntf-icon-btn" data-del="' + esc(it.id) + '" title="Delete">' + ICONS.trash + '</button>' +
        '</div>' +
      '</div>' +
    '</article>';
  }

  function renderPanel() {
    const body = document.getElementById('krNtfBody');
    if (!body) return;
    if (!sid()) {
      body.innerHTML = '<div class="kr-ntf-empty">' + ICONS.bell +
        '<p>নোটিফিকেশন চালু করলে অফার ও অর্ডার আপডেট এখানে দেখতে পাবেন।</p>' +
        '<button type="button" class="kr-ntf-cta" data-act="enable">Enable notifications</button></div>';
      return;
    }
    if (!items.length) {
      body.innerHTML = '<div class="kr-ntf-empty">' + ICONS.inbox + '<p>No notifications yet.</p></div>';
      return;
    }
    body.innerHTML = items.map(itemHTML).join('');
  }

  function tickTimers() {
    if (!panel || !panel.classList.contains('show')) return;
    panel.querySelectorAll('[data-timer]').forEach(function (el) {
      const val = el.querySelector('.kr-ntf-timer-val');
      if (val) val.textContent = countdownLabel(el.dataset.ends);
    });
  }

  /* =========================================================
     CLICK TRACKING (from service worker)
     ========================================================= */
  function reportClick(run) {
    if (!sid() || !run) return;
    api('/api/notify/event', { sid: sid(), run: run, type: 'clicked' });
  }

  function handleUrlParams() {
    const params = new URLSearchParams(location.search);
    const ntf = params.get('ntf');
    if (ntf) reportClick(ntf);

    const vote = params.get('vote');
    if (vote) {
      // Deep-link from a notification action button.
      openPanel();
      setTimeout(function () {
        const target = items.filter(function (i) {
          try { return JSON.parse(i.poll_json || '').options.some(function (o) { return o.id === vote; }); }
          catch (e) { return false; }
        })[0];
        if (target) doVote(target.id, vote);
      }, 700);
    }
  }

  /* =========================================================
     UI HOOKS — mobile menu + header bell
     ========================================================= */
  function buildBellButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'kr-ntf-bell';
    btn.setAttribute('aria-label', 'Notifications');
    btn.innerHTML = ICONS.bell + '<span class="kr-ntf-badge" data-kr-ntf-count>0</span>';
    btn.addEventListener('click', openPanel);
    return btn;
  }

  function addToMobileMenu() {
    const menu = document.getElementById('kr-mobile-menu');
    if (!menu) return;
    const link = document.createElement('a');
    link.href = '#kr-notifications';
    link.setAttribute('role', 'menuitem');
    link.className = 'kr-ntf-menu-link';
    link.setAttribute('data-en', 'Notifications');
    link.setAttribute('data-bn', 'নোটিফিকেশন');
    link.innerHTML =
      '<span class="kr-ntf-menu-label" data-en="Notifications" data-bn="নোটিফিকেশন">Notifications</span>' +
      '<span class="kr-ntf-menu-dot" data-kr-ntf-dot></span>';
    link.addEventListener('click', function (e) {
      e.preventDefault();
      openPanel();
      const hamburger = document.getElementById('krHamburger');
      if (hamburger) hamburger.click();
    });
    menu.appendChild(link);
  }

  function addToHeader() {
    if (document.querySelector('.kr-ntf-bell')) return;
    const header = document.querySelector('header.site-header, .site-header, #siteHeader, header');
    if (!header) return;
    const host = header.querySelector('.header-actions, .site-header__actions, .kr-header-actions');
    (host || header).appendChild(buildBellButton());
  }

  function observeTheme() {
    const mo = new MutationObserver(function () {
      if (panel) panel.setAttribute('data-theme', document.documentElement.getAttribute('data-theme') || 'light');
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  function watchPhoneField() {
    let t;
    const bind = function () {
      const field = document.getElementById('krPhone') || document.getElementById('fieldPhone');
      if (!field || field.dataset.krNtfBound) return;
      field.dataset.krNtfBound = '1';
      field.addEventListener('change', function () {
        clearTimeout(t);
        t = setTimeout(syncContact, 800);
      });
    };
    bind();
    setInterval(bind, 3000);
  }

  function injectStyles() {
    if (document.getElementById('krNtfCss')) return;
    const s = document.createElement('style');
    s.id = 'krNtfCss';
    s.textContent = [
      '.kr-ntf-bell{position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid var(--border-subtle,#E0D9CF);border-radius:50%;cursor:pointer;color:var(--text-primary,#121313);}',
      '.kr-ntf-bell svg{width:19px;height:19px;}',
      '.kr-ntf-badge{position:absolute;top:-2px;right:-2px;min-width:17px;height:17px;padding:0 4px;box-sizing:border-box;background:#FF6044;color:#fff;border-radius:9px;font:700 10px/1 Outfit, sans-serif;align-items:center;justify-content:center;display:none;}',
      '.kr-ntf-menu-link{display:flex;align-items:center;gap:10px;}',
      '.kr-ntf-menu-label{flex:1;}',
      '.kr-ntf-menu-dot{width:9px;height:9px;border-radius:50%;background:#FF6044;display:none;flex-shrink:0;}',

      '.kr-ntf-panel{position:fixed;inset:0;z-index:9990;background:rgba(0,0,0,0.45);opacity:0;visibility:hidden;transition:opacity .25s ease,visibility .25s ease;}',
      '.kr-ntf-panel.show{opacity:1;visibility:visible;}',
      '.kr-ntf-panel-inner{position:absolute;top:0;right:0;height:100%;width:min(420px,100%);background:var(--bg-body,#F2EFE9);color:var(--text-primary,#121313);display:flex;flex-direction:column;transform:translateX(100%);transition:transform .3s cubic-bezier(.34,1.06,.64,1);box-shadow:-8px 0 32px rgba(0,0,0,.16);}',
      '.kr-ntf-panel.show .kr-ntf-panel-inner{transform:none;}',
      '.kr-ntf-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border-subtle,#E0D9CF);background:var(--bg-card,#fff);}',
      '.kr-ntf-head h3{display:flex;align-items:center;gap:8px;font-size:16px;font-weight:700;margin:0;}',
      '.kr-ntf-head h3 svg{width:18px;height:18px;color:#FF6044;}',
      '.kr-ntf-head-btns{display:flex;gap:4px;}',
      '.kr-ntf-icon-btn{width:34px;height:34px;display:flex;align-items:center;justify-content:center;background:transparent;border:none;border-radius:8px;cursor:pointer;color:var(--text-secondary,#3A3D3D);}',
      '.kr-ntf-icon-btn:hover{background:var(--bg-hover,#FFF6ED);}',
      '.kr-ntf-icon-btn svg{width:17px;height:17px;}',
      '.kr-ntf-body{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch;}',
      '.kr-ntf-foot{padding:10px 14px;border-top:1px solid var(--border-subtle,#E0D9CF);background:var(--bg-card,#fff);}',
      '.kr-ntf-text-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:9px;background:transparent;border:1px dashed var(--border-input,#C8C2B8);border-radius:10px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text-secondary,#3A3D3D);}',
      '.kr-ntf-text-btn svg{width:15px;height:15px;}',

      '.kr-ntf-item{background:var(--bg-card,#fff);border:1px solid var(--border-subtle,#E0D9CF);border-radius:14px;overflow:hidden;display:flex;flex-direction:column;}',
      '.kr-ntf-item.is-unread{border-left:3px solid #FF6044;}',
      '.kr-ntf-img{height:130px;background-size:cover;background-position:center;}',
      '.kr-ntf-item-main{padding:11px 13px;min-width:0;}',
      '.kr-ntf-item-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:5px;}',
      '.kr-ntf-cat{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;padding:2px 7px;border-radius:9999px;background:rgba(255,96,68,.12);color:#FF6044;}',
      '.kr-ntf-when{font-size:11px;color:var(--text-muted,#717777);}',
      '.kr-ntf-item h4{font-size:14px;font-weight:700;margin:0 0 4px;line-height:1.35;}',
      '.kr-ntf-item p{font-size:13px;line-height:1.55;color:var(--text-secondary,#3A3D3D);margin:0;}',
      '.kr-ntf-item-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:9px;}',
      '.kr-ntf-link{background:none;border:none;padding:0;font-size:13px;font-weight:700;color:#FF6044;cursor:pointer;}',

      '.kr-ntf-timer{display:inline-flex;align-items:center;gap:6px;margin-top:9px;padding:5px 10px;background:#121313;color:#F7E998;border-radius:8px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums;}',
      '.kr-ntf-timer svg{width:13px;height:13px;}',
      '.kr-ntf-timer-val{font-variant-numeric:tabular-nums;letter-spacing:.02em;}',
      '.kr-ntf-badge[data-kr-ntf-count]{font-variant-numeric:tabular-nums;}',
      'body.kr-ntf-open{overflow:hidden;}',

      '.kr-ntf-poll{margin-top:10px;display:flex;flex-direction:column;gap:6px;}',
      '.kr-ntf-poll-q{font-size:12px;font-weight:700;color:var(--text-secondary,#3A3D3D);}',
      '.kr-ntf-poll-opt{position:relative;display:flex;align-items:center;gap:8px;padding:8px 11px;border:1px solid var(--border-subtle,#E0D9CF);border-radius:9px;background:var(--bg-input,#F7F4EF);cursor:pointer;overflow:hidden;text-align:left;font-size:13px;color:var(--text-primary,#121313);}',
      '.kr-ntf-poll-opt:disabled{cursor:default;}',
      '.kr-ntf-poll-opt.is-mine{border-color:#FF6044;}',
      '.kr-ntf-poll-bar{position:absolute;left:0;top:0;bottom:0;background:rgba(255,96,68,.16);transition:width .5s ease;}',
      '.kr-ntf-poll-label{position:relative;flex:1;}',
      '.kr-ntf-poll-pct{position:relative;font-weight:700;font-size:12px;color:#FF6044;}',
      '.kr-ntf-poll-chk{position:relative;width:15px;height:15px;color:#FF6044;}',
      '.kr-ntf-poll-chk svg{width:15px;height:15px;}',
      '.kr-ntf-poll-total{font-size:11px;color:var(--text-muted,#717777);}',

      '.kr-ntf-empty{margin:auto;text-align:center;padding:32px 18px;color:var(--text-muted,#717777);}',
      '.kr-ntf-empty svg{width:38px;height:38px;opacity:.4;margin-bottom:10px;}',
      '.kr-ntf-empty p{font-size:13px;line-height:1.6;margin:0 0 14px;}',
      '.kr-ntf-cta{padding:10px 18px;background:#FF6044;color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;}',

      '.kr-ntf-perm{position:fixed;inset:0;z-index:9995;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .25s ease;padding:16px;}',
      '.kr-ntf-perm.show{opacity:1;}',
      '.kr-ntf-perm-card{width:min(420px,100%);background:var(--bg-card,#fff);color:var(--text-primary,#121313);border-radius:20px;padding:22px 20px;text-align:center;transform:translateY(24px);transition:transform .3s cubic-bezier(.34,1.06,.64,1);}',
      '.kr-ntf-perm.show .kr-ntf-perm-card{transform:none;}',
      '.kr-ntf-perm-ico{width:52px;height:52px;margin:0 auto 12px;border-radius:14px;background:rgba(255,96,68,.12);display:flex;align-items:center;justify-content:center;color:#FF6044;}',
      '.kr-ntf-perm-ico svg{width:26px;height:26px;}',
      '.kr-ntf-perm-card h3{font-size:17px;font-weight:800;margin:0 0 8px;}',
      '.kr-ntf-perm-card p{font-size:13px;line-height:1.65;color:var(--text-secondary,#3A3D3D);margin:0 0 18px;}',
      '.kr-ntf-perm-btns{display:flex;gap:10px;}',
      '.kr-ntf-perm-btns button{flex:1;padding:12px;border-radius:11px;font-size:14px;font-weight:700;cursor:pointer;border:none;}',
      '.kr-ntf-perm-no{background:var(--bg-input,#F7F4EF);color:var(--text-secondary,#3A3D3D);border:1px solid var(--border-subtle,#E0D9CF)!important;}',
      '.kr-ntf-perm-yes{background:#FF6044;color:#fff;}',

      '@media (min-width:769px){.kr-ntf-perm{align-items:center;}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* =========================================================
     INIT
     ========================================================= */
  async function init() {
    injectStyles();
    addToMobileMenu();
    addToHeader();
    observeTheme();
    watchPhoneField();
    updateBadges();
    timerHandle = setInterval(tickTimers, 1000);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.type === 'KR_NOTIFY_CLICK') {
          const run = (e.data.url || '').split('ntf=')[1];
          reportClick(decodeURIComponent((run || '').split('&')[0]));
        }
      });
    }

    handleUrlParams();

    /* Restore the cached unread count right away so the badge shows
       instantly on every visit (localStorage based — no accounts). */
    try {
      const cached = parseInt(localStorage.getItem(LS.unread) || '0', 10);
      if (cached > 0) { unread = cached; updateBadges(); }
    } catch (e) {}

    /* Notification health check — runs on every visit:
       ON  -> silent (just keep the subscription fresh)
       OFF -> ask again, but no more than once per 24 hours */
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        await subscribe();
      }
      setTimeout(function () { checkNotifyNag(false); }, 6000);
    }

    loadInbox();
    setInterval(function () { loadInbox(true); }, 120000);
    /* Accurate on/off state re-check every 6h while the page stays open. */
    setInterval(function () { checkNotifyNag(false); }, 6 * 60 * 60 * 1000);
  }

  window.KRNotify = {
    open: openPanel,
    close: closePanel,
    enable: requestPermission,
    refresh: function () { loadInbox(); },
    subscribe: subscribe,
    check: checkNotifyNag,
    state: detectNotifyState
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
