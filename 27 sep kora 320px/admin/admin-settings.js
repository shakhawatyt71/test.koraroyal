'use strict';
/* KORA ROYAL — admin/admin-settings.js (v2.1)
   Settings page: health, Telegram test + bot webhook setup, request windows,
   admin preferences. Pathao courier configuration moved to its own section
   (pathao.html / admin-pathao.js). Talks only to the Worker. */
(function(){
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('settings');
  krAdminInitMobileNav();

  const $ = id => document.getElementById(id);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const mb = $('krMobileMenuBtn');
  if (mb) mb.innerHTML = _SVG.menu;

  async function health(){
    const start = Date.now();
    try {
      const r = await krAdminFetch('/api/admin/stats');
      $('setWorker').innerHTML = `<span style="color:#16A34A">Online · ${Date.now()-start}ms</span>`;
      $('setD1').textContent = `${r.totalOrders||0} D1 orders`;
    } catch(e) {
      $('setWorker').innerHTML = '<span style="color:#DC2626">Offline/Error</span>';
      $('setD1').textContent = e.message;
    }
  }

  /* ── Load everything ── */
  async function load(){
    health();
    try {
      const r = await krAdminFetch('/api/admin/operations-settings');
      const s = r.settings || {};
      $('setReturnDays').value = s.return_request_days || 7;
      $('setRefundDays').value = s.refund_request_days || 7;
      $('setExchangeDays').value = s.exchange_request_days || 7;
    } catch(err) {
      console.error('[Settings Load]', err);
    }
    $('setDark').checked = (localStorage.getItem('kr_admin_theme') || 'light') === 'dark';
    $('setSound').checked = localStorage.getItem('kr_sound') === '1';
    $('setRefresh').checked = localStorage.getItem('kr_autorefresh') === '1';
    loadTelegramState();
  }

  /* ── Telegram state (from diagnostics, no probe) ── */
  async function loadTelegramState() {
    try {
      const d = await krAdminFetch('/api/admin/diagnostics');
      if (!d.ok) throw new Error(d.error || 'Diagnostics failed');
      const t = d.telegram || {}, sec = d.secrets || {};
      $('setTelegramState').innerHTML = `${sec.TELEGRAM_TOKEN ? '✅' : '❌'} <code>TELEGRAM_TOKEN</code> &nbsp; ${sec.TELEGRAM_CHAT ? '✅' : '❌'} <code>TELEGRAM_CHAT</code> &nbsp; ${sec.TELEGRAM_WEBHOOK_SECRET ? '✅' : '⚪'} <code>TELEGRAM_WEBHOOK_SECRET</code> (optional)<br>${t.ok ? (t.webhookUrl === t.expectedUrl ? '✅ Bot webhook → this Worker' : '⚠️ Bot webhook is <code>' + esc(t.webhookUrl || 'not set') + '</code> — expected <code>' + esc(t.expectedUrl) + '</code>') : '❌ ' + esc(t.error || 'Bot not reachable')}${t.pendingUpdates ? ` · ${t.pendingUpdates} pending updates` : ''}`;
    } catch (e) {
      $('setTelegramState').innerHTML = `<span style="color:#DC2626">${esc(e.message)}</span>`;
    }
  }

  /* ── Wiring ── */
  $('setPing').onclick = health;

  $('setTelegramSend').onclick = async function(){
    this.disabled = true;
    try {
      const r = await krAdminFetch('/api/admin/telegram-test', {
        method: 'POST',
        body: JSON.stringify({ message: $('setTelegramText').value })
      });
      $('setTelegramResult').textContent = r.ok ? '✓ Sent' : '✕ Failed' + (r.error ? ' — ' + r.error : '');
      krToast(r.ok ? 'Telegram sent' : (r.error || 'Telegram failed'), r.ok ? 'success' : 'error');
    } finally {
      this.disabled = false;
    }
  };

  $('setTelegramSetup').onclick = async function() {
    this.disabled = true; this.textContent = 'Registering…';
    try {
      const r = await krAdminFetch('/api/admin/telegram/setup', { method: 'POST', body: '{}' });
      if (!r.ok) throw new Error(r.error || r.description || 'Telegram setWebhook failed');
      krToast('Telegram webhook registered: ' + (r.webhook?.url || ''), 'success');
      loadTelegramState();
    } catch (e) { krToast(e.message, 'error'); }
    finally { this.disabled = false; this.textContent = 'Register / repair Telegram webhook'; }
  };

  $('setRequestSave').onclick = async function(){
    const r = await krAdminFetch('/api/admin/operations-settings', {
      method: 'POST',
      body: JSON.stringify({
        returnDays: Number($('setReturnDays').value),
        refundDays: Number($('setRefundDays').value),
        exchangeDays: Number($('setExchangeDays').value)
      })
    });
    krToast(r.ok ? 'Request windows saved' : r.error, r.ok ? 'success' : 'error');
  };

  $('setDark').onchange = function(){
    const t = this.checked ? 'dark' : 'light';
    localStorage.setItem('kr_admin_theme', t);
    document.documentElement.dataset.theme = t;
    krAdminRenderNav('settings');
  };
  $('setSound').onchange = function(){ localStorage.setItem('kr_sound', this.checked ? '1' : '0'); };
  $('setRefresh').onchange = function(){ localStorage.setItem('kr_autorefresh', this.checked ? '1' : '0'); };

  load();
})();
