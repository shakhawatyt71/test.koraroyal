/* ================================================================
   KORA ROYAL — Silent Diagnostics Collector (v1.1)
   js/diag.js

   Collects browser errors / console warnings / failed requests quietly
   and ships them to the admin panel (client_logs table).
   The visitor NEVER sees anything about this — no UI, no popups, no
   visible console noise. Only the admin panel shows the data.

   v1.1: every log row carries a per-visit SESSION id, so the admin
   report popup can show the user's FULL trail (site entry -> report).
   ================================================================ */

'use strict';

(function () {
  'use strict';

  var API = 'https://kora-api.shakhawatyt77.workers.dev';
  var STORE_KEY = 'kr_diag_uid';
  var QUEUE_KEY = 'kr_diag_queue';

  /* ---- stable anonymous device id (localStorage based) ---- */
  function getUid() {
    try {
      var u = localStorage.getItem(STORE_KEY);
      if (u) return u;
      u = 'U' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(STORE_KEY, u);
      return u;
    } catch (e) {
      return 'U-anon';
    }
  }
  var UID = getUid();

  /* ---- per-visit session id (one visit = one tab session) ---- */
  var SESSION = (function () {
    try {
      var s = sessionStorage.getItem('kr_diag_sess');
      if (s) return s;
      s = 'S' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      sessionStorage.setItem('kr_diag_sess', s);
      return s;
    } catch (e) {
      return 'S-anon';
    }
  })();
  var SESSION_START = Date.now();

  /* ---- bounded queue in localStorage (survives reloads/crashes) ---- */
  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-60))); } catch (e) {}
  }
  function pushLog(kind, msg, stack, extra) {
    var q = loadQueue();
    q.push({
      t: kind,
      m: String(msg || '').slice(0, 1500),
      s: String(stack || '').slice(0, 3000),
      x: extra ? String(extra).slice(0, 800) : '',
      ts: Date.now(),
      sess: SESSION
    });
    saveQueue(q);
    scheduleFlush();
  }

  /* ---- ship to server, silently ---- */
  var flushTimer = null, flushing = false;
  function scheduleFlush() {
    if (flushTimer) return;
    flushTimer = setTimeout(function () { flushTimer = null; flush(); }, 8000);
  }
  function flush() {
    if (flushing) return;
    var q = loadQueue();
    if (!q.length) return;
    flushing = true;
    var batch = q.slice(0, 40);
    var body = JSON.stringify({ uid: UID, session: SESSION, page: location.href, ua: navigator.userAgent, logs: batch });
    var done = function () {
      flushing = false;
      var rest = loadQueue().filter(function (e) { return batch.indexOf(e) === -1; });
      saveQueue(rest);
      if (rest.length) scheduleFlush();
    };
    try {
      fetch(API + '/api/client-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).then(done).catch(done);
    } catch (e) {
      /* keepalive beacon fallback */
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon(API + '/api/client-log', new Blob([body], { type: 'application/json' }));
        }
      } catch (e2) {}
      done();
    }
  }

  /* ---- capture window errors (message + exact file:line:col + stack) ---- */
  window.addEventListener('error', function (e) {
    try {
      pushLog(
        'error',
        (e.message || 'Script error') + ' @' + (e.filename || '') + ':' + (e.lineno || 0) + ':' + (e.colno || 0),
        (e.error && e.error.stack) || '',
        (e.filename || '') + ':' + (e.lineno || 0) + ':' + (e.colno || 0)
      );
    } catch (err) {}
  }, true);

  /* ---- capture unhandled promise rejections ---- */
  window.addEventListener('unhandledrejection', function (e) {
    try {
      var r = e.reason;
      var msg = (r && r.message) ? r.message : String(r || 'unknown rejection');
      pushLog('rejection', msg, (r && r.stack) || '');
    } catch (err) {}
  });

  /* ---- capture fetch failures (network/API errors) ---- */
  var realFetch = window.fetch;
  if (realFetch) {
    window.fetch = function () {
      var args = arguments;
      return realFetch.apply(window, args).then(function (res) {
        try {
          if (!res || res.status >= 400) {
            var u = (args[0] && args[0].url) || args[0] || '';
            if (String(u).indexOf('/api/client-log') === -1) {
              pushLog('http', 'HTTP ' + (res ? res.status : '?') + ' ' + String(u).slice(0, 300));
            }
          }
        } catch (e) {}
        return res;
      }).catch(function (err) {
        try {
          var u = (args[0] && args[0].url) || args[0] || '';
          if (String(u).indexOf('/api/client-log') === -1) {
            pushLog('fetch', String(err && err.message || err) + ' ' + String(u).slice(0, 300));
          }
        } catch (e) {}
        throw err;
      });
    };
  }

  /* ---- capture console.error / console.warn (quietly) ---- */
  ['error', 'warn'].forEach(function (level) {
    var orig = console[level];
    if (!orig) return;
    console[level] = function () {
      try {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) parts.push(String(arguments[i]));
        var joined = parts.join(' ');
        if (joined.indexOf('kr_diag') === -1) {
          pushLog('console-' + level, joined.slice(0, 1500));
        }
      } catch (e) {}
      return orig.apply(console, arguments);
    };
  });

  /* ---- breadcrumb: page loads (the start of every session trail) ---- */
  pushLog('nav', location.href.slice(0, 300));

  /* ---- breadcrumb: what the user clicked before reporting ---- */
  document.addEventListener('click', function (e) {
    try {
      var t = e.target;
      var el = t && t.closest ? t.closest('a,button,[role="button"],input[type="submit"]') : null;
      if (!el) return;
      var label = (el.id ? '#' + el.id : el.tagName.toLowerCase()) +
        (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') +
        ' "' + String(el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 30) + '"';
      pushLog('click', label);
    } catch (err) {}
  }, true);

  /* ---- flush before leaving ---- */
  window.addEventListener('pagehide', function () {
    try {
      var q = loadQueue();
      if (!q.length) return;
      var body = JSON.stringify({ uid: UID, session: SESSION, page: location.href, ua: navigator.userAgent, logs: q.slice(0, 40) });
      if (navigator.sendBeacon) {
        navigator.sendBeacon(API + '/api/client-log', new Blob([body], { type: 'application/json' }));
      }
    } catch (e) {}
  });

  /* ---- snapshot for bug reports (KRDiag.snapshot()) ---- */
  function snapshot() {
    var out = {
      uid: UID,
      session: SESSION,
      startedAt: SESSION_START,
      href: location.href.slice(0, 400),
      ua: navigator.userAgent,
      screen: (window.screen ? screen.width + 'x' + screen.height : ''),
      viewport: window.innerWidth + 'x' + window.innerHeight,
      lang: navigator.language,
      tz: (function () { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ''; } })(),
      online: navigator.onLine,
      net: (navigator.connection && navigator.connection.effectiveType) || '',
      theme: document.documentElement.getAttribute('data-theme') || '',
      /* This visit only — site entry up to right now. */
      logs: loadQueue().filter(function (e) { return e.sess === SESSION; }).slice(-40)
    };
    try { out.mem = performance && performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + 'MB' : ''; } catch (e) {}
    try { out.storage = (function () {
      var keys = [];
      for (var i = 0; i < localStorage.length && keys.length < 40; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('kr_diag') === -1) keys.push(k);
      }
      return keys;
    })(); } catch (e) { out.storage = []; }
    return out;
  }

  window.KRDiag = {
    uid: UID,
    session: SESSION,
    startedAt: SESSION_START,
    log: pushLog,
    flush: flush,
    snapshot: snapshot
  };
})();
