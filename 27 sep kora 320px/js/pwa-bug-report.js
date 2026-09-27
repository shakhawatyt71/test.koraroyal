/* ================================================================
   KORA ROYAL — Bug Report System v2.0 (FIXED)
   
   Changes from v1:
   - Removed floating button (now in mobile menu)
   - Theme sync with website (data-theme)
   - All emojis replaced with Lucide icons
   - Added phone number field (optional)
   - Added platform selection (Website/App)
   - Reports stored in Cloudflare Worker backend
   ================================================================ */

'use strict';

(function() {
  'use strict';

  // ===== CONFIGURATION =====
  const CONFIG = {
    // Bug reports must open a chat with SUPPORT, not with the reporter.
    // 01967002782 -> international format 8801967002782
    whatsappNumber: '8801967002782',
    maxScreenshotSize: 5 * 1024 * 1024,
    storageKey: 'kr-bug-reports',
    maxReports: 50,
    categories: [
      { id: 'display', label: 'Display Issue', icon: 'image' },
      { id: 'function', label: 'Not Working', icon: 'alert-triangle' },
      { id: 'slow', label: 'Slow / Loading', icon: 'loader' },
      { id: 'crash', label: 'App Crashed', icon: 'zap-off' },
      { id: 'order', label: 'Order Problem', icon: 'package-x' },
      { id: 'payment', label: 'Payment Issue', icon: 'credit-card' },
      { id: 'other', label: 'Other', icon: 'more-horizontal' }
    ]
  };

  // ===== STATE =====
  let isOpen = false;
  let modal = null;

  // ===== DETECT THEME =====
  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  // ===== DETECT PLATFORM =====
  function getDeviceInfo() {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edg')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';

    return {
      browser,
      os,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      viewportSize: `${window.innerWidth}x${window.innerHeight}`,
      networkType: (navigator.connection || {}).effectiveType || 'unknown',
      online: navigator.onLine
    };
  }

  // ===== CREATE MODAL =====
  function createModal() {
    modal = document.createElement('div');
    modal.id = 'kr-bug-report-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Report an Issue');

    modal.innerHTML = `
      <style>
        #kr-bug-report-modal {
          position: fixed;
          inset: 0;
          z-index: 999999;
          display: none;
          align-items: flex-end;
          justify-content: center;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        #kr-bug-report-modal.show {
          display: flex;
          opacity: 1;
        }

        .kr-bug-modal-content {
          width: 100%;
          max-width: 500px;
          max-height: 90vh;
          border-radius: 24px 24px 0 0;
          overflow: hidden;
          transform: translateY(100%);
          transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          display: flex;
          flex-direction: column;
        }

        #kr-bug-report-modal.show .kr-bug-modal-content {
          transform: translateY(0);
        }

        /* Theme sync */
        .kr-bug-modal-content {
          background: var(--bg-card, #FFFFFF);
          color: var(--text-primary, #121313);
        }

        [data-theme="dark"] .kr-bug-modal-content {
          background: var(--bg-card, #1A1C1C);
          color: var(--text-primary, #F2EFE9);
        }

        .kr-bug-modal-header {
          padding: 20px 24px;
          background: var(--brand-coral, #FF6044);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-shrink: 0;
        }

        .kr-bug-modal-title {
          font-family: 'Outfit', sans-serif;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .kr-bug-modal-title svg {
          width: 20px;
          height: 20px;
        }

        .kr-bug-modal-close {
          width: 32px;
          height: 32px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .kr-bug-modal-close:hover {
          background: rgba(255, 255, 255, 0.35);
        }

        .kr-bug-modal-close svg {
          width: 16px;
          height: 16px;
        }

        .kr-bug-modal-body {
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        }

        .kr-bug-form-group {
          margin-bottom: 20px;
        }

        .kr-bug-label {
          display: block;
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 700;
          color: var(--text-secondary, #3A3D3D);
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        [data-theme="dark"] .kr-bug-label {
          color: var(--text-secondary, #C8C2B8);
        }

        .kr-bug-categories {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .kr-bug-category {
          padding: 12px;
          background: var(--bg-body, #F2EFE9);
          border: 2px solid transparent;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        [data-theme="dark"] .kr-bug-category {
          background: var(--bg-hover, #232525);
        }

        .kr-bug-category:hover,
        .kr-bug-category.selected {
          border-color: var(--brand-coral, #FF6044);
          background: rgba(255, 96, 68, 0.08);
        }

        .kr-bug-category-icon {
          width: 20px;
          height: 20px;
          color: var(--text-muted, #717777);
          flex-shrink: 0;
        }

        .kr-bug-category.selected .kr-bug-category-icon {
          color: var(--brand-coral, #FF6044);
        }

        .kr-bug-category-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #121313);
        }

        [data-theme="dark"] .kr-bug-category-label {
          color: var(--text-primary, #F2EFE9);
        }

        .kr-bug-input,
        .kr-bug-textarea {
          width: 100%;
          padding: 12px 16px;
          background: var(--bg-body, #F2EFE9);
          border: 2px solid var(--border-subtle, #E0D9CF);
          border-radius: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: var(--text-primary, #121313);
          outline: none;
          transition: all 0.2s;
        }

        [data-theme="dark"] .kr-bug-input,
        [data-theme="dark"] .kr-bug-textarea {
          background: var(--bg-hover, #232525);
          border-color: var(--border-subtle, #292B2B);
          color: var(--text-primary, #F2EFE9);
        }

        .kr-bug-input:focus,
        .kr-bug-textarea:focus {
          border-color: var(--brand-coral, #FF6044);
          box-shadow: 0 0 0 3px rgba(255, 96, 68, 0.1);
        }

        .kr-bug-textarea {
          min-height: 100px;
          resize: vertical;
        }

        /* Platform radio buttons */
        .kr-bug-platform-group {
          display: flex;
          gap: 10px;
        }

        .kr-bug-platform-option {
          flex: 1;
          position: relative;
        }

        .kr-bug-platform-option input[type="radio"] {
          position: absolute;
          opacity: 0;
          width: 0;
          height: 0;
        }

        .kr-bug-platform-label {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          background: var(--bg-body, #F2EFE9);
          border: 2px solid var(--border-subtle, #E0D9CF);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-secondary, #3A3D3D);
        }

        [data-theme="dark"] .kr-bug-platform-label {
          background: var(--bg-hover, #232525);
          border-color: var(--border-subtle, #292B2B);
          color: var(--text-secondary, #C8C2B8);
        }

        .kr-bug-platform-label svg {
          width: 18px;
          height: 18px;
        }

        .kr-bug-platform-option input:checked + .kr-bug-platform-label {
          border-color: var(--brand-coral, #FF6044);
          background: rgba(255, 96, 68, 0.08);
          color: var(--brand-coral, #FF6044);
        }

        .kr-bug-submit-btn {
          width: 100%;
          padding: 16px;
          background: var(--brand-coral, #FF6044);
          color: white;
          border: none;
          border-radius: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
        }

        .kr-bug-submit-btn:hover {
          background: #E8502E;
          transform: translateY(-1px);
        }

        .kr-bug-submit-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .kr-bug-submit-btn svg {
          width: 18px;
          height: 18px;
        }

        .kr-bug-success {
          display: none;
          text-align: center;
          padding: 40px 24px;
        }

        .kr-bug-success.show {
          display: block;
        }

        .kr-bug-success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          background: rgba(35, 178, 109, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .kr-bug-success-icon svg {
          width: 32px;
          height: 32px;
          color: var(--brand-coral, #FF6044);
        }

        .kr-bug-success-title {
          font-family: 'Outfit', sans-serif;
          font-size: 22px;
          font-weight: 800;
          margin-bottom: 8px;
        }

        .kr-bug-success-text {
          font-size: 14px;
          color: var(--text-muted, #717777);
          line-height: 1.6;
        }

        @keyframes krBugSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      </style>

      <div class="kr-bug-modal-content">
        <div class="kr-bug-modal-header">
          <div class="kr-bug-modal-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Report an Issue
          </div>
          <button class="kr-bug-modal-close" id="krBugModalClose" aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div class="kr-bug-modal-body" id="krBugModalBody">
          <!-- Category Selection -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label">What's the issue?</label>
            <div class="kr-bug-categories" id="krBugCategories"></div>
          </div>

          <!-- Platform Selection -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label">Where did you face this?</label>
            <div class="kr-bug-platform-group">
              <div class="kr-bug-platform-option">
                <input type="radio" name="krBugPlatform" id="krBugPlatformWeb" value="website" checked />
                <label class="kr-bug-platform-label" for="krBugPlatformWeb">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  Website
                </label>
              </div>
              <div class="kr-bug-platform-option">
                <input type="radio" name="krBugPlatform" id="krBugPlatformApp" value="app" />
                <label class="kr-bug-platform-label" for="krBugPlatformApp">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                  App
                </label>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label" for="krBugDescription">Describe the problem</label>
            <textarea class="kr-bug-textarea" id="krBugDescription" placeholder="What happened? What did you expect?" maxlength="1000"></textarea>
          </div>

          <!-- Name -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label" for="krBugName">
              Name <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span>
            </label>
            <input type="text" class="kr-bug-input" id="krBugName" placeholder="Your name" />
          </div>

          <!-- Phone -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label" for="krBugPhone">
              Phone <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span>
            </label>
            <input type="tel" class="kr-bug-input" id="krBugPhone" placeholder="01XXXXXXXXX" inputmode="numeric" />
          </div>

          <!-- Email -->
          <div class="kr-bug-form-group">
            <label class="kr-bug-label" for="krBugEmail">
              Email <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional, for follow-up)</span>
            </label>
            <input type="email" class="kr-bug-input" id="krBugEmail" placeholder="your@email.com" />
          </div>

          <!-- Submit -->
          <button class="kr-bug-submit-btn" id="krBugSubmitBtn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Send Report
          </button>
        </div>

        <!-- Success -->
        <div class="kr-bug-success" id="krBugSuccess">
          <div class="kr-bug-success-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
          <h3 class="kr-bug-success-title">Thank You!</h3>
          <p class="kr-bug-success-text">Your report has been submitted. We will look into it as soon as possible.</p>
          <button class="kr-bug-submit-btn" id="krBugSuccessClose" style="margin-top:24px;">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Generate category buttons with Lucide icons
    const categoriesContainer = document.getElementById('krBugCategories');
    CONFIG.categories.forEach(cat => {
      const btn = document.createElement('div');
      btn.className = 'kr-bug-category';
      btn.dataset.category = cat.id;
      btn.innerHTML = `
        <i data-lucide="${cat.icon}" class="kr-bug-category-icon"></i>
        <span class="kr-bug-category-label">${cat.label}</span>
      `;
      categoriesContainer.appendChild(btn);
    });

    // Initialize Lucide icons inside modal
    if (typeof lucide !== 'undefined') {
      lucide.createIcons({ nodes: [modal] });
    }

    // Event listeners
    document.getElementById('krBugModalClose').addEventListener('click', closeModal);
    document.getElementById('krBugSuccessClose').addEventListener('click', closeModal);

    // Category selection
    modal.querySelectorAll('.kr-bug-category').forEach(el => {
      el.addEventListener('click', () => {
        modal.querySelectorAll('.kr-bug-category').forEach(c => c.classList.remove('selected'));
        el.classList.add('selected');
      });
    });

    // Submit
    document.getElementById('krBugSubmitBtn').addEventListener('click', handleSubmit);
  }

  // ===== HANDLE SUBMIT =====
  async function handleSubmit() {
    const category = modal.querySelector('.kr-bug-category.selected')?.dataset.category;
    const platform = modal.querySelector('input[name="krBugPlatform"]:checked')?.value;
    const description = document.getElementById('krBugDescription').value.trim();
    const name = document.getElementById('krBugName').value.trim();
    const phone = document.getElementById('krBugPhone').value.trim();
    const email = document.getElementById('krBugEmail').value.trim();

    if (!category) {
      alert('Please select a category');
      return;
    }
    if (!description) {
      alert('Please describe the problem');
      return;
    }

    const btn = document.getElementById('krBugSubmitBtn');
    btn.disabled = true;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:krBugSpin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>
      Sending...
    `;

    const report = {
      id: 'BUG-' + Date.now(),
      timestamp: new Date().toISOString(),
      category: category,
      platform: platform,
      description: description,
      name: name,
      phone: phone,
      email: email,
      device: getDeviceInfo(),
      url: window.location.href,
      theme: getCurrentTheme()
    };

    // Send to backend.
    // NOTE: the API base is hardcoded (same worker as js/notify.js). The old
    // code looked for a global `KRApi` that never existed, so the fetch was
    // silently skipped and reports never reached the admin panel.
    let backendSaved = false;
    try {
      const apiBase = (typeof KRApi !== 'undefined' && KRApi.base) ? KRApi.base : 'https://kora-api.shakhawatyt77.workers.dev';
      // Silent diagnostics snapshot — admin panel only. Not shown to the user,
      // not included in the WhatsApp message.
      if (typeof KRDiag !== 'undefined' && KRDiag.snapshot) {
        report.diag = KRDiag.snapshot();
        report.uid = KRDiag.uid;
        /* Carry the ids inside device_info too, so the admin report popup can
           pull this user's full session trail even from older rows. */
        report.device._uid = KRDiag.uid;
        report.device.uid = KRDiag.uid;
        report.device._session = KRDiag.session || (report.diag && report.diag.session) || '';
      }
      const resp = await fetch(apiBase + '/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report)
      });
      backendSaved = resp.ok;
    } catch (e) {
      console.warn('[BugReport] Backend save failed:', e);
    }

    // Save locally as backup
    try {
      let reports = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
      if (reports.length >= CONFIG.maxReports) reports = reports.slice(-CONFIG.maxReports + 1);
      reports.push({ ...report, backendSaved });
      localStorage.setItem(CONFIG.storageKey, JSON.stringify(reports));
    } catch (e) {}

    // Send via WhatsApp
    sendViaWhatsApp(report);

    // Show success
    document.getElementById('krBugModalBody').style.display = 'none';
    document.getElementById('krBugSuccess').classList.add('show');

    btn.disabled = false;
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
      Send Report
    `;
  }

  // ===== SEND VIA WHATSAPP =====
  function sendViaWhatsApp(report) {
    const catLabel = CONFIG.categories.find(c => c.id === report.category)?.label || report.category;
    let msg = `*KORA ROYAL Bug Report*\n\n`;
    msg += `Category: ${catLabel}\n`;
    msg += `Platform: ${report.platform}\n`;
    msg += `Description: ${report.description}\n`;
    if (report.name) msg += `Name: ${report.name}\n`;
    if (report.phone) msg += `Phone: ${report.phone}\n`;
    if (report.email) msg += `Email: ${report.email}\n`;
    msg += `\nDevice: ${report.device.browser} / ${report.device.os}\n`;
    msg += `Screen: ${report.device.screenSize}\n`;
    msg += `URL: ${report.url}\n`;
    msg += `Theme: ${report.theme}\n`;
    msg += `Report ID: ${report.id}`;

    try {
      window.open(`https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (e) {}
  }

  // ===== OPEN / CLOSE =====
  function openModal() {
    if (!modal) createModal();

    // Sync theme
    modal.setAttribute('data-theme', getCurrentTheme());

    // Reset form
    modal.querySelectorAll('.kr-bug-category').forEach(c => c.classList.remove('selected'));
    document.getElementById('krBugDescription').value = '';
    document.getElementById('krBugName').value = '';
    document.getElementById('krBugPhone').value = '';
    document.getElementById('krBugEmail').value = '';
    document.getElementById('krBugPlatformWeb').checked = true;

    document.getElementById('krBugModalBody').style.display = 'block';
    document.getElementById('krBugSuccess').classList.remove('show');

    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
    isOpen = true;
  }

  function closeModal() {
    if (modal) {
      modal.classList.remove('show');
      document.body.style.overflow = '';
      isOpen = false;
      setTimeout(() => {
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
          modal = null;
        }
      }, 400);
    }
  }

  // ===== INTEGRATE INTO MOBILE MENU =====
  function addToMobileMenu() {
    const mobileMenu = document.getElementById('kr-mobile-menu');
    if (!mobileMenu) return;

    const reportLink = document.createElement('a');
    reportLink.href = '#';
    reportLink.setAttribute('role', 'menuitem');
    reportLink.setAttribute('data-en', 'Report Issue');
    reportLink.setAttribute('data-bn', 'সমস্যা জানান');
    reportLink.innerHTML = '<span data-en="Report Issue" data-bn="সমস্যা জানান">Report Issue</span>';
    reportLink.addEventListener('click', function(e) {
      e.preventDefault();
      openModal();
      // Close mobile menu
      const hamburger = document.getElementById('krHamburger');
      if (hamburger) hamburger.click();
    });

    mobileMenu.appendChild(reportLink);
  }

  // ===== THEME OBSERVER =====
  function observeThemeChanges() {
    const observer = new MutationObserver(() => {
      if (modal && isOpen) {
        modal.setAttribute('data-theme', getCurrentTheme());
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  // ===== INIT =====
  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        addToMobileMenu();
        observeThemeChanges();
      });
    } else {
      addToMobileMenu();
      observeThemeChanges();
    }
  }

  init();

  // Export
  window.KRBugReport = {
    open: openModal,
    close: closeModal,
    getReports: () => JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]'),
    clearReports: () => localStorage.removeItem(CONFIG.storageKey)
  };
})();
