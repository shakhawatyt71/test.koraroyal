/* ================================================================
   KORA ROYAL — PWA Install Prompt v1.0
   Handles "Add to Home Screen" functionality
   Shows custom install banner for Android/iOS
   ================================================================ */

'use strict';

(function() {
  'use strict';
  
  // ===== CONFIGURATION =====
  const CONFIG = {
    showAfterVisits: 2,        // Show install prompt after N visits
    dismissDuration: 7,        // Days to remember dismissal
    checkInterval: 5000,       // Check interval in ms
    maxPrompts: 3,             // Maximum number of prompts
    storageKey: 'kr-pwa-install',
    visitKey: 'kr-pwa-visits'
  };
  
  // ===== STATE =====
  let deferredPrompt = null;
  let installBanner = null;
  let isInstallable = false;
  let hasBeenDismissed = false;
  
  // ===== DETECT PLATFORM =====
  function getPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isStandalone = window.matchMedia('(display-mode: standalone)').standalone || 
                         window.navigator.standalone === true;
    
    return {
      isIOS,
      isAndroid,
      isStandalone,
      isMobile: isIOS || isAndroid,
      isDesktop: !isIOS && !isAndroid
    };
  }
  
  // ===== CHECK IF SHOULD SHOW =====
  function shouldShowInstallPrompt() {
    const platform = getPlatform();
    
    // Already installed
    if (platform.isStandalone) {
      return false;
    }
    
    // Check if dismissed
    const dismissed = localStorage.getItem(CONFIG.storageKey);
    if (dismissed) {
      const dismissedDate = new Date(dismissed);
      const daysSinceDismiss = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < CONFIG.dismissDuration) {
        return false;
      }
    }
    
    // Check visit count
    let visits = parseInt(localStorage.getItem(CONFIG.visitKey) || '0');
    visits++;
    localStorage.setItem(CONFIG.visitKey, visits.toString());
    
    if (visits < CONFIG.showAfterVisits) {
      return false;
    }
    
    // Check prompt count
    const promptCount = parseInt(localStorage.getItem('kr-pwa-prompt-count') || '0');
    if (promptCount >= CONFIG.maxPrompts) {
      return false;
    }
    
    return true;
  }
  
  // ===== CREATE INSTALL BANNER =====
  function createInstallBanner() {
    const banner = document.createElement('div');
    banner.id = 'kr-pwa-install-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Install KORA ROYAL App');
    
    banner.innerHTML = `
      <style>
        #kr-pwa-install-banner {
          position: fixed;
          bottom: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 400px;
          background: linear-gradient(135deg, #FF6044 0%, #FF8066 100%);
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 20px 60px rgba(255, 96, 68, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset;
          z-index: 999999;
          transition: bottom 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        
        #kr-pwa-install-banner.show {
          bottom: 24px;
        }
        
        .kr-pwa-banner-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .kr-pwa-banner-icon {
          width: 56px;
          height: 56px;
          background: white;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.1);
        }
        
        .kr-pwa-banner-icon img {
          width: 40px;
          height: 40px;
          border-radius: 8px;
        }
        
        .kr-pwa-banner-text {
          flex: 1;
          color: white;
        }
        
        .kr-pwa-banner-title {
          font-family: 'Outfit', sans-serif;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        
        .kr-pwa-banner-desc {
          font-size: 13px;
          opacity: 0.9;
          line-height: 1.4;
        }
        
        .kr-pwa-banner-actions {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }
        
        .kr-pwa-install-btn {
          flex: 1;
          padding: 12px 20px;
          background: white;
          color: #FF6044;
          border: none;
          border-radius: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        
        .kr-pwa-install-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
        
        .kr-pwa-install-btn:active {
          transform: translateY(0);
        }
        
        .kr-pwa-dismiss-btn {
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          border-radius: 12px;
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .kr-pwa-dismiss-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .kr-pwa-close-btn {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          background: rgba(255, 255, 255, 0.2);
          border: none;
          border-radius: 50%;
          color: white;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        .kr-pwa-close-btn:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        /* iOS specific instructions */
        .kr-ios-instructions {
          display: none;
          margin-top: 12px;
          padding: 12px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          font-size: 13px;
          color: white;
        }
        
        .kr-ios-instructions.show {
          display: block;
        }
        
        .kr-ios-steps {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 8px;
        }
        
        .kr-ios-step {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .kr-ios-step-num {
          width: 24px;
          height: 24px;
          background: white;
          color: #FF6044;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 700;
          flex-shrink: 0;
        }
        
        @media (prefers-color-scheme: dark) {
          #kr-pwa-install-banner {
            background: linear-gradient(135deg, #ff7043 0%, #ff5722 100%);
          }
        }
      </style>
      
      <button class="kr-pwa-close-btn" id="krPwaClose" aria-label="Close">✕</button>
      
      <div class="kr-pwa-banner-content">
        <div class="kr-pwa-banner-icon">
          <img src="/icons/icon-192x192.png" alt="KORA ROYAL" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23FF6044%22/><text x=%2250%22 y=%2265%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2240%22 font-weight=%22bold%22>KR</text></svg>'">
        </div>
        <div class="kr-pwa-banner-text">
          <div class="kr-pwa-banner-title">Install KORA ROYAL</div>
          <div class="kr-pwa-banner-desc">Get the app for faster access & offline browsing</div>
        </div>
      </div>
      
      <div class="kr-pwa-banner-actions">
        <button class="kr-pwa-install-btn" id="krPwaInstallBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Install App
        </button>
        <button class="kr-pwa-dismiss-btn" id="krPwaDismiss">Later</button>
      </div>
      
      <div class="kr-ios-instructions" id="krIosInstructions">
        <strong>To install on iPhone/iPad:</strong>
        <div class="kr-ios-steps">
          <div class="kr-ios-step">
            <span class="kr-ios-step-num">1</span>
            <span>Tap the Share button <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg> in Safari</span>
          </div>
          <div class="kr-ios-step">
            <span class="kr-ios-step-num">2</span>
            <span>Scroll down and tap "Add to Home Screen"</span>
          </div>
          <div class="kr-ios-step">
            <span class="kr-ios-step-num">3</span>
            <span>Tap "Add" in the top right</span>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(banner);
    
    // Event listeners
    document.getElementById('krPwaClose').addEventListener('click', dismissBanner);
    document.getElementById('krPwaDismiss').addEventListener('click', dismissBanner);
    document.getElementById('krPwaInstallBtn').addEventListener('click', handleInstall);
    
    // Show iOS instructions if needed
    const platform = getPlatform();
    if (platform.isIOS) {
      document.getElementById('krPwaInstallBtn').textContent = 'How to Install';
      document.getElementById('krPwaInstallBtn').addEventListener('click', function() {
        document.getElementById('krIosInstructions').classList.toggle('show');
      });
    }
    
    return banner;
  }
  
  // ===== SHOW BANNER =====
  function showBanner() {
    if (!installBanner) {
      installBanner = createInstallBanner();
    }
    
    // Animate in
    requestAnimationFrame(() => {
      installBanner.classList.add('show');
    });
    
    // Update prompt count
    const promptCount = parseInt(localStorage.getItem('kr-pwa-prompt-count') || '0');
    localStorage.setItem('kr-pwa-prompt-count', (promptCount + 1).toString());
  }
  
  // ===== DISMISS BANNER =====
  function dismissBanner() {
    if (installBanner) {
      installBanner.classList.remove('show');
      
      setTimeout(() => {
        if (installBanner && installBanner.parentNode) {
          installBanner.parentNode.removeChild(installBanner);
          installBanner = null;
        }
      }, 500);
    }
    
    localStorage.setItem(CONFIG.storageKey, new Date().toISOString());
    hasBeenDismissed = true;
  }
  
  // ===== HANDLE INSTALL =====
  async function handleInstall() {
    if (!deferredPrompt) {
      // For iOS or browsers that don't support beforeinstallprompt
      const platform = getPlatform();
      if (platform.isIOS) {
        document.getElementById('krIosInstructions').classList.toggle('show');
      }
      return;
    }
    
    // Show the native install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log('[PWA] Install outcome:', outcome);
    
    if (outcome === 'accepted') {
      // Track installation
      trackInstall();
      
      // Remove banner
      if (installBanner) {
        installBanner.classList.remove('show');
        setTimeout(() => {
          if (installBanner && installBanner.parentNode) {
            installBanner.parentNode.removeChild(installBanner);
            installBanner = null;
          }
        }, 500);
      }
      
      // Show success message
      showInstallSuccess();
    }
    
    deferredPrompt = null;
  }
  
  // ===== TRACK INSTALL =====
  function trackInstall() {
    localStorage.setItem('kr-pwa-installed', 'true');
    localStorage.setItem('kr-pwa-install-date', new Date().toISOString());
    
    // Send analytics if available
    if (typeof gtag !== 'undefined') {
      gtag('event', 'pwa_install', {
        'event_category': 'engagement',
        'event_label': 'PWA Installed'
      });
    }
  }
  
  // ===== SHOW SUCCESS =====
  function showInstallSuccess() {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #23b26d;
      color: white;
      padding: 16px 24px;
      border-radius: 16px;
      font-family: 'Outfit', sans-serif;
      font-size: 14px;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(35, 178, 109, 0.4);
      z-index: 999999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;
    
    toast.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
      <span>App installed successfully!</span>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideDown 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  // ===== CHECK INSTALLATION STATUS =====
  function checkInstallationStatus() {
    const platform = getPlatform();
    
    // Already installed as PWA
    if (platform.isStandalone) {
      console.log('[PWA] Running as installed PWA');
      document.documentElement.classList.add('kr-pwa-installed');
      return;
    }
    
    // Check if previously installed
    const wasInstalled = localStorage.getItem('kr-pwa-installed');
    if (wasInstalled) {
      console.log('[PWA] Was previously installed');
      return;
    }
  }
  
  // ===== INITIALIZE =====
  function init() {
    console.log('[PWA] Initializing install prompt...');
    
    // Check current installation status
    checkInstallationStatus();
    
    // Listen for beforeinstallprompt (Android/Chrome)
    window.addEventListener('beforeinstallprompt', (e) => {
      console.log('[PWA] beforeinstallprompt fired');
      
      // Prevent the default mini-infobar
      e.preventDefault();
      
      // Stash the event for later use
      deferredPrompt = e;
      isInstallable = true;
      
      // Check if we should show the banner
      if (shouldShowInstallPrompt()) {
        // Wait a bit before showing
        setTimeout(showBanner, 3000);
      }
    });
    
    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed!');
      trackInstall();
      deferredPrompt = null;
      isInstallable = false;
    });
    
    // For iOS - show banner if not in standalone mode
    const platform = getPlatform();
    if (platform.isIOS && !platform.isStandalone) {
      if (shouldShowInstallPrompt()) {
        setTimeout(showBanner, 5000);
      }
    }
    
    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from {
          transform: translate(-50%, 100%);
          opacity: 0;
        }
        to {
          transform: translate(-50%, 0);
          opacity: 1;
        }
      }
      
      @keyframes slideDown {
        from {
          transform: translate(-50%, 0);
          opacity: 1;
        }
        to {
          transform: translate(-50%, 100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }
  
  // ===== START =====
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  
  // Export for manual use
  window.KRPwaInstall = {
    show: showBanner,
    dismiss: dismissBanner,
    getStatus: () => ({
      isInstallable,
      hasBeenDismissed,
      platform: getPlatform()
    })
  };
})();
