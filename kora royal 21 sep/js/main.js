/**
 * ================================================================
 * KORA ROYAL — main.js v7 (HERO BANNER SLIDER INTEGRATED)
 * UI Logic Only (IIFE pattern)
 * Depends on: integrations.js (must load first)
 *
 * v7 CHANGES:
 *  - Old initGallery/selectHeroProduct/initHeroPopup REMOVED
 *  - New initHeroBanner() — product-aware slider with full tracking
 *  - All session/pixel/cart logic preserved
 *  - Slide change → SessionTracker.recordProductView
 *  - Popup hover (2s) → trackViewItemOnce (Pixel)
 *  - Order Now → handleSelectFromHero (full flow)
 *  - Collections → view_item_list event + scroll
 * ================================================================
 */
(function () {
'use strict';

/* পুরনো অর্ডার ডেটা ২৪ ঘন্টা পর localStorage থেকে অটো-মুছে যাবে */
(function cleanupOldOrderData() {
  try {
    const raw = localStorage.getItem('kr_last_order');
    if (!raw) return;
    const data = JSON.parse(raw);
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (!data._savedAt || Date.now() - data._savedAt > ONE_DAY) {
      localStorage.removeItem('kr_last_order');
    }
  } catch (e) {
    localStorage.removeItem('kr_last_order');
  }
})();

/* ================================================================
   STATE
   ================================================================ */
const state = {
  theme: 'light', lang: 'en',
  couponCode: '', couponApplied: false, discountPct: 0,
  isSubmitting: false,
  carouselDragging: false, carouselStartX: 0, carouselScrollLeft: 0,
  paymentMethod: 'COD',
  currentHeroPid: 1,
  beginCheckoutFired: false,
  islandDismissCount: 0,
  islandPauseUntil: 0,
  islandPauseMs: 45000,
  islandVisible: false,
  islandDragStartX: 0,
  islandDragStartY: 0,
  islandDragging: false,
  islandCurrentIdx: 0,
  islandRotateTimer: null
};

let checkoutInstances = [];
function initCheckoutInstances() {
  checkoutInstances = Object.keys(KR.PRODUCTS).map(pid => ({
    instanceId: `base_${pid}`, pid: Number(pid), selections: {}, variantId: null,
    size: '', color: '', qty: 0, unitPrice: Number(KR.PRODUCTS[pid]?.price || 0)
  }));
}

/* ================================================================
   HELPERS
   ================================================================ */
function getLang()  { return document.documentElement.getAttribute('data-lang') || 'en'; }
function getTheme() { return document.documentElement.getAttribute('data-theme') || 'light'; }
function fmtPrice(n){ return '৳' + Number(n).toLocaleString('en-BD'); }
function productDiscount(product){const price=Number(product?.price||0),compare=Number(product?.comparePrice||0);if(!(compare>price&&price>=0))return null;return {price,compare,saved:compare-price,percent:Math.round((compare-price)/compare*100)};}
function productPriceHTML(product,compact=false){const d=productDiscount(product);return `<div class="kr-price-display${compact?' is-compact':''}"><strong>${fmtPrice(product.price)}</strong>${d?`<del>${fmtPrice(d.compare)}</del><span class="kr-discount-pill">${d.percent}% OFF</span>`:''}</div>${d&&!compact?`<div class="kr-price-saving">${getLang()==='bn'?`আপনি সাশ্রয় করছেন ${fmtPrice(d.saved)}`:`You save ${fmtPrice(d.saved)}`}</div>`:''}`;}
function getProductName(p)  { return getLang() === 'bn' ? p.name_bn : p.name_en; }
function getColorName(p, colorId) {
  const c = (p.colors || []).find(x => x.id === colorId);
  if (!c) return colorId;
  return getLang() === 'bn' ? c.name_bn : c.name_en;
}
function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>\"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
}
function productOptions(product) { return Array.isArray(product?.options) ? product.options : []; }
function optionValue(option, code) { return (option?.values || []).find(v => String(v.code) === String(code)); }
function selectionDisplay(product, inst, language = getLang()) {
  return productOptions(product).map(option => {
    const selected = inst.selections?.[option.code];
    if (!selected) return null;
    const value = optionValue(option, selected);
    const text = value ? (language === 'bn' ? (value.value_bn || value.value_en) : value.value_en) : selected;
    const label = language === 'bn' ? (option.label_bn || option.label_en) : option.label_en;
    return { code:option.code, label, value:text, valueCode:value?.code || '', text:value ? '' : String(selected) };
  }).filter(Boolean);
}
function resolveInstanceVariant(inst) {
  const product = KR.PRODUCTS[inst.pid];
  if (!product) return null;
  const variantOptions = productOptions(product).filter(o => o.createsVariant);
  const complete = variantOptions.every(o => inst.selections?.[o.code]);
  let variant = null;
  if (complete && variantOptions.length) {
    variant = (product.variants || []).find(v => v.active !== false && variantOptions.every(o => {
      const vv = v.optionValues?.[o.code];
      return String(vv?.code ?? vv ?? '') === String(inst.selections[o.code]);
    })) || null;
  } else if (!variantOptions.length) {
    const active = (product.variants || []).filter(v => v.active !== false);
    if (active.length === 1) variant = active[0];
  }
  inst.variantId = variant?.id || null;
  inst.unitPrice = Number(variant?.priceOverride ?? product.price ?? 0);
  inst.variantUnavailable = !!variant && variant.salesStatus === 'out_of_stock';
  inst.size = inst.selections?.size || '';
  inst.color = inst.selections?.color || '';
  return variant;
}
function instanceUnitPrice(inst) {
  resolveInstanceVariant(inst);
  return Number(inst.unitPrice || KR.PRODUCTS[inst.pid]?.price || 0);
}
function serializeOrderItem(inst) {
  const product = KR.PRODUCTS[inst.pid];
  resolveInstanceVariant(inst);
  return {
    productId:Number(inst.pid), variantId:inst.variantId || null, quantity:Number(inst.qty),
    selectedOptions:selectionDisplay(product,inst,'en').map(x => ({code:x.code,valueCode:x.valueCode,text:x.text}))
  };
}





/* ================================================================
   REFERENCE CHECKOUT UI HELPERS
   ================================================================ */

function initReferenceCheckoutUI() {
  const couponCard = document.querySelector('.kr-ref-coupon-card');
  const couponToggle = document.getElementById('krCouponToggle');
  
  if (couponCard && couponToggle) {
    // ডিফল্টভাবে কোলাপ্সড অবস্থায় শুরু
    couponCard.classList.add('is-collapsed');
    couponToggle.setAttribute('aria-expanded', 'false');
    
    couponToggle.addEventListener('click', () => {
      const isCollapsed = couponCard.classList.toggle('is-collapsed');
      couponToggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
    });
  }
  
  const note = document.getElementById('krNote');
  const count = document.getElementById('krNoteCount');
  
  if (note && count) {
    const updateCount = () => {
      count.textContent = String(note.value.length);
    };
    
    note.addEventListener('input', updateCount);
    updateCount();
  }
  
  const thana = document.getElementById('krThana');
  
  if (thana) {
    thana.addEventListener('input', () => {
      if (window.SessionTracker) {
        window.SessionTracker.recordFormField('thana', thana.value.trim());
      }
      
      if (typeof refreshWALink === 'function') {
        refreshWALink();
      }
    });
  }
}

/* ================================================================
   LEAD CAPTURE FORM LISTENERS
   ================================================================ */
function initLeadCapture() {
  if (!window.SessionTracker) return;

  const fields = [
    { id: 'krName', key: 'name' },
    { id: 'krPhone', key: 'phone' },
    { id: 'krEmail', key: 'email' },
    { id: 'krAddress', key: 'address' }
  ];

  fields.forEach(({ id, key }) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('blur', () => {
      const val = el.value.trim();
      if (val) {
        window.SessionTracker.recordFormField(key, val);
        console.log(`[LeadCapture] Saved ${key}:`, val);
      }
    });

    el.addEventListener('input', () => {
      window.SessionTracker.recordFormField(key, el.value.trim());
    });
  });

  [0, 500, 1500, 3000].forEach(delay => {
    setTimeout(() => {
      fields.forEach(({ id, key }) => {
        const el = document.getElementById(id);
        if (!el || !el.value) return;
        const val = el.value.trim();
        if (val) {
          console.log(`[LeadCapture] Autofill detected ${key}:`, val);
          window.SessionTracker.recordFormField(key, val);
        }
      });
    }, delay);
  });
}

/* ================================================================
   1. THEME
   ================================================================ */
function initTheme() {
  const saved = localStorage.getItem('kr_theme') || 'light';
  setTheme(saved, false);
}
function setTheme(t, save) {
  state.theme = t;
  document.documentElement.setAttribute('data-theme', t);
  if (save) localStorage.setItem('kr_theme', t);
  const iconLight = document.querySelector('#krThemeToggle .icon-light');
  const iconDark  = document.querySelector('#krThemeToggle .icon-dark');
  if (iconLight) iconLight.style.display = t === 'light' ? 'block' : 'none';
  if (iconDark)  iconDark.style.display  = t === 'dark'  ? 'block' : 'none';
  swapLogos(t);
}
function swapLogos() {
  const ll = document.getElementById('krLogoLight');
  const ld = document.getElementById('krLogoDark');
  const lf = document.getElementById('krFooterLogo');
  if (ll) { ll.classList.add('logo-fade'); ll.src = KR.LOGOS.light; setTimeout(() => ll.classList.remove('logo-fade'), 300); }
  if (ld) { ld.classList.add('logo-fade'); ld.src = KR.LOGOS.dark;  setTimeout(() => ld.classList.remove('logo-fade'), 300); }
  if (lf) lf.src = KR.LOGOS.footer;
}

/* ================================================================
   2. LANGUAGE
   ================================================================ */
function initLang() {
  const saved = localStorage.getItem('kr_lang') || 'en';
  setLang(saved, false);
}
function setLang(lang, save) {
  state.lang = lang;
  document.documentElement.setAttribute('data-lang', lang);
  if (save) localStorage.setItem('kr_lang', lang);
  const btn = document.getElementById('krLangToggle');
  if (btn) btn.textContent = lang === 'bn' ? 'ENG' : 'বাং';
  document.querySelectorAll('[data-en]').forEach(el => {
    const val = el.getAttribute('data-' + lang);
    if (val) el.textContent = val;
  });
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    const val = el.getAttribute('data-placeholder-' + lang);
    if (val) el.placeholder = val;
  });
  buildCarousel();
  buildProductCards();
  buildCheckoutProducts();
  updateSummary();
  refreshWALink();

  /* Rebuild hero with new language */
  if (document.getElementById('krHeroBanner')) {
    const prevIdx = heroState.current;
    buildHeroBanner();
    heroState.current = prevIdx;
    /* Re-mark active slide in new DOM */
    const banner = document.getElementById('krHeroBanner');
    if (banner) {
      banner.querySelectorAll('.kr-hero-slide').forEach((s, i) => s.classList.toggle('is-active', i === prevIdx));
      banner.querySelectorAll('.kr-hero-text-group').forEach((s, i) => s.classList.toggle('is-active', i === prevIdx));
      banner.querySelectorAll('.kr-hero-dot').forEach((s, i) => s.classList.toggle('is-active', i === prevIdx));
    }
    attachHeroListeners();
    startHeroAuto();
  }
  if (window.KRProductDetails?.currentProductId) window.KRProductDetails.render(window.KRProductDetails.currentProductId);
}

/* ================================================================
   3. ANNOUNCEMENT BAR
   ================================================================ */
function updateKrFixedHeader() {
  const bar = document.getElementById('kr-announcement');
  const navbar = document.getElementById('kr-navbar');
  const mobileMenu = document.getElementById('kr-mobile-menu');

  const announcementHeight = bar && !bar.hidden ? Math.ceil(bar.getBoundingClientRect().height) : 0;
  const navbarHeight = navbar ? Math.ceil(navbar.getBoundingClientRect().height) : 0;
  const totalHeight = announcementHeight + navbarHeight;

  document.documentElement.style.setProperty('--kr-announcement-height', `${announcementHeight}px`);
  document.documentElement.style.setProperty('--kr-navbar-height', `${navbarHeight}px`);
  document.documentElement.style.setProperty('--kr-header-total-height', `${totalHeight}px`);

  document.body.classList.toggle('kr-has-fixed-header', !!navbar);

  if (mobileMenu) {
    mobileMenu.style.top = `${totalHeight}px`;
    mobileMenu.style.maxHeight = `calc(100vh - ${totalHeight}px)`;
  }
}

function initAnnouncement() {
  const bar      = document.getElementById('kr-announcement');
  const track    = document.getElementById('krAnnounceTrack');
  const original = document.getElementById('krAnnounceOriginal');
  const clone    = document.getElementById('krAnnounceClone');
  const close    = document.getElementById('krAnnounceClose');
  if (!bar || !track || !original || !clone) return;

  try { localStorage.removeItem('kr_announce_closed'); } catch (e) {}

  if (!clone.dataset.cloned) {
    clone.innerHTML = original.innerHTML;
    clone.dataset.cloned = '1';
  }

  if (close && !close.dataset.bound) {
    close.dataset.bound = '1';
    close.addEventListener('click', () => {
      bar.hidden = true;
      updateKrFixedHeader();
    });
  }

  const startAnimation = () => {
    requestAnimationFrame(() => {
      track.classList.add('is-ready');
      updateKrFixedHeader();
    });
  };

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startAnimation);
  } else {
    startAnimation();
  }

  requestAnimationFrame(updateKrFixedHeader);

  if (!window.__krFixedHeaderEventsBound) {
    window.__krFixedHeaderEventsBound = '1';
    window.addEventListener('load', updateKrFixedHeader);
    window.addEventListener('resize', updateKrFixedHeader, { passive: true });
  }
}

/* ================================================================
   4. NAVBAR
   ================================================================ */

function initNavbar() {
  const navbar = document.getElementById('kr-navbar');
  const hamburger = document.getElementById('krHamburger');
  const mobileMenu = document.getElementById('kr-mobile-menu');
  const themeBtn = document.getElementById('krThemeToggle');
  const langBtn = document.getElementById('krLangToggle');

  const updateNavbarScrollState = () => {
    if (!navbar) return;
    navbar.classList.toggle('is-scrolled', window.scrollY > 20);
  };

  const closeMobileMenu = () => {
    if (!hamburger || !mobileMenu) return;
    mobileMenu.classList.remove('is-open');
    hamburger.classList.remove('is-open');
    hamburger.setAttribute('aria-expanded', 'false');
  };

  updateNavbarScrollState();
  requestAnimationFrame(updateKrFixedHeader);

  if (navbar) {
    document.body.classList.add('kr-has-fixed-header');

    navbar.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        img.addEventListener('load', updateKrFixedHeader, { once: true });
      }
    });
  }

  window.addEventListener(
    'scroll',
    () => {
      updateNavbarScrollState();
    },
    { passive: true }
  );

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const open = !mobileMenu.classList.contains('is-open');

      mobileMenu.classList.toggle('is-open', open);
      hamburger.classList.toggle('is-open', open);
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    mobileMenu.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', closeMobileMenu);
    });

    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!mobileMenu.contains(target) && !hamburger.contains(target)) {
        closeMobileMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMobileMenu();
      }
    });
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      setTheme(getTheme() === 'light' ? 'dark' : 'light', true);
      requestAnimationFrame(updateKrFixedHeader);
    });
  }

  if (langBtn) {
    langBtn.addEventListener('click', () => {
      setLang(getLang() === 'en' ? 'bn' : 'en', true);
      requestAnimationFrame(updateKrFixedHeader);
    });
  }
}




/* ================================================================
   5. DYNAMIC ISLAND  (MODIFIED)
   ================================================================ */
let islandTimer  = null;
let islandPinned = false;

function showIsland(type, title, body, duration) {
  const island  = document.getElementById('kr-island');
  const iconEl  = document.getElementById('krIslandIcon');
  const titleEl = document.getElementById('krIslandTitle');
  const bodyEl  = document.getElementById('krIslandBody');
  if (!island) return;
  if (Date.now() < state.islandPauseUntil) return;

  const icons = {
    success: '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    error:   '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    offer:   '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
    info:    '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  iconEl.className    = `kr-island-icon kr-island-icon--${type}`;
  iconEl.innerHTML    = icons[type] || icons.info;
  titleEl.textContent = title;
  bodyEl.textContent  = body;

  requestAnimationFrame(() => {
    const contentHeight = island.querySelector('.kr-island-content').scrollHeight;
    const singleLineH   = 36;
    iconEl.style.alignSelf = contentHeight > singleLineH ? 'flex-start' : 'center';
    iconEl.style.marginTop = contentHeight > singleLineH ? '2px' : '0';
  });

  island.style.transform = '';
  island.classList.add('is-visible');
  state.islandVisible = true;

  if (islandTimer) clearTimeout(islandTimer);

  /* duration = -1 → pinned mode, auto-hide বন্ধ */
  if (duration === -1) {
    islandPinned = true;
    return;
  }

  islandPinned = false;
  islandTimer  = setTimeout(() => {
    island.classList.remove('is-visible');
    state.islandVisible = false;
  }, duration || 3500);
}

/* ── Island hide করো ────────────────────────────────────────── */
function hideIsland() {
  const island = document.getElementById('kr-island');
  if (!island) return;
  if (islandTimer) clearTimeout(islandTimer);
  islandPinned        = false;
  state.islandVisible = false;
  island.classList.remove('is-visible');
}

const islandMsgs = [
  { type:'offer',   en:['10% Off Today!','Use code KORA10 at checkout'],        bn:['আজ ১০% ছাড়!','চেকআউটে KORA10 ব্যবহার করুন'] },
  { type:'info',    en:['Free Delivery','On orders above ৳2999'],                bn:['ফ্রি ডেলিভারি','৳২৯৯৯-এর বেশি অর্ডারে'] },
  { type:'success', en:['491+ Happy Customers','Join the KORA ROYAL family'],    bn:['৪৯১+ সন্তুষ্ট গ্রাহক','করা রয়্যাল পরিবারে যোগ দিন'] },
  { type:'offer',   en:['New Coupon: APNALOK20','20% off on your order'],        bn:['নতুন কুপন: APNALOK20','আপনার অর্ডারে ২০% ছাড়'] },
  { type:'info',    en:['COD Available','Cash on Delivery across Bangladesh'],   bn:['COD পাওয়া যাচ্ছে','সারা বাংলাদেশে ক্যাশ অন ডেলিভারি'] }
];

function initIsland() {
  setupIslandGestures();
  setTimeout(rotateIsland, 3000);
}

function rotateIsland() {
  if (state.islandRotateTimer) clearTimeout(state.islandRotateTimer);

  /* pinned থাকলে rotate আসবে না */
  if (islandPinned) {
    state.islandRotateTimer = setTimeout(rotateIsland, 2000);
    return;
  }

  const now   = Date.now();
  const pause = state.islandPauseUntil - now;
  if (pause > 0) {
    state.islandRotateTimer = setTimeout(rotateIsland, pause + 1000);
    return;
  }

  const m    = islandMsgs[state.islandCurrentIdx % islandMsgs.length];
  const lang = getLang();
  showIsland(
    m.type,
    lang === 'bn' ? m.bn[0] : m.en[0],
    lang === 'bn' ? m.bn[1] : m.en[1],
    3000
  );
  state.islandCurrentIdx++;
  state.islandRotateTimer = setTimeout(rotateIsland, 3000 + state.islandPauseMs);
}

function setupIslandGestures() {
  const island = document.getElementById('kr-island');
  if (!island) return;

  island.addEventListener('pointerdown', e => {
    state.islandDragging   = true;
    state.islandDragStartX = e.clientX;
    state.islandDragStartY = e.clientY;
    island.setPointerCapture(e.pointerId);
  });

  island.addEventListener('pointermove', e => {
    if (!state.islandDragging) return;
    const dx = e.clientX - state.islandDragStartX;
    const dy = e.clientY - state.islandDragStartY;
    island.style.transform = `translateX(calc(-50% + ${dx}px)) translateY(${dy < 0 ? dy : 0}px)`;
  });

  island.addEventListener('pointerup', e => {
    if (!state.islandDragging) return;
    state.islandDragging = false;
    const dx   = e.clientX - state.islandDragStartX;
    const dy   = e.clientY - state.islandDragStartY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 60) {
      /* swipe করে সরালে pinned ও উঠে যাবে */
      if (islandPinned) {
        islandPinned = false;
        /* slow watcher কে জানাও */
        window._slowWatchDismissed = true;
      }

      island.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
      island.style.opacity    = '0';
      island.style.transform  = `translateX(calc(-50% + ${dx * 3}px)) translateY(${dy * 3}px)`;

      setTimeout(() => {
        island.classList.remove('is-visible');
        island.style.transform  = '';
        island.style.opacity    = '';
        island.style.transition = '';
        state.islandVisible     = false;
      }, 300);

      state.islandDismissCount++;
      if (state.islandDismissCount >= 2) {
        state.islandPauseUntil = Date.now() + 10000;
        state.islandDismissCount = 0;
      } else {
        state.islandPauseUntil = Date.now() + 3000;
      }

    } else {
      island.style.transition = 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)';
      island.style.transform  = '';
      setTimeout(() => { island.style.transition = ''; }, 300);
    }
  });

  island.addEventListener('pointercancel', () => {
    state.islandDragging    = false;
    island.style.transform  = '';
    island.style.transition = '';
  });
}


/* ================================================================
   5b. ADVANCED SLOW CONNECTION WATCHER
   ================================================================

   কখন নোটিফিকেশন আসবে:
   → ≥ 2 signal "স্লো" বললে

   কখন থাকবে:
   → যতক্ষণ পেজ stable না হয় (imgs 50%+ লোড + doc ready)
   → যতক্ষণ নেট ঠিক না হয়

   কখন সরবে:
   → পেজ stable হলে নিজেই সরে যাবে
   → ইউজার swipe করলে সরে যাবে (আর আসবে না)
   ================================================================ */

function initSlowConnectionWatch() {

  /* ── State ─────────────────────────────────────────────────── */
  let notificationSent = false;
  let loadMonitorId    = null;
  let netMonitorId     = null;

  window._slowWatchDismissed = false; /* gesture handler এটা true করবে */

  const isBn = getLang() === 'bn';

  /* ── Notification text ──────────────────────────────────────── */
  const TITLE = isBn
    ? '📶 সংযোগ একটু ধীর মনে হচ্ছে'
    : '📶 Your connection seems slow';

  const BODY = isBn
    ? 'পেজটি লোড হতে একটু বেশি সময় নিচ্ছে। এটি আপনার ইন্টারনেট সংযোগের কারণে হতে পারে — আমাদের সার্ভারে সবকিছু ঠিকঠাক আছে। একটু অপেক্ষা করুন অথবা কানেকশনটি একবার চেক করে দেখুন।'
    : 'The page is taking a little longer to load — this may be due to your internet connection. Everything is fine on our end. Please wait a moment or check your connection.';

  /* ══════════════════════════════════════════════════════════════
     SIGNAL SYSTEM
     ══════════════════════════════════════════════════════════════ */
  const signals = {
    connectionAPI  : null,   // Navigator Connection API (most reliable)
    resourceTiming : null,   // Page resource timing analysis
    imageObserver  : null,   // Viewport-only image load behaviour
  };

  function evaluateSignals(key, value) {
    if (notificationSent) return;
    signals[key] = value;

    const slowCount  = Object.values(signals).filter(v => v === true).length;
    const knownCount = Object.values(signals).filter(v => v !== null).length;

    console.debug(`[SlowWatch] [${knownCount} known / ${slowCount} slow]`, { ...signals });

    /* Signal 2 removed → now 3 possible signals (connectionAPI, resourceTiming, imageObserver).
       All 3 must agree before notifying, to avoid false positives.
       If Connection API is unavailable (not all browsers support it), 2 out of 2 remaining
       signals must agree. */
const maxPossible = Object.keys(signals).length;
const threshold = maxPossible >= 3 ? 3 : 2;
if (slowCount >= threshold) triggerNotification();
  }

  /* ── Notification চালু করো ──────────────────────────────────── */
  function triggerNotification() {
    if (notificationSent) return;
    notificationSent = true;

    console.info('[SlowWatch] Sending notification');
    showIsland('info', TITLE, BODY, -1); /* -1 = pinned */

    startLoadMonitor();
    startNetMonitor();
  }

  /* ══════════════════════════════════════════════════════════════
     LOAD MONITOR
     পেজ stable হলে notification সরিয়ে দাও
     ══════════════════════════════════════════════════════════════ */
  function isPageStable() {
    /* Condition 1: document ready */
    const docReady = document.readyState === 'complete';

    /* Condition 2: images 50%+ loaded */
    const imgs      = Array.from(document.querySelectorAll('img'));
    const total     = imgs.length;
    const loaded    = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
    const imgRatio  = total === 0 ? 1 : loaded / total;

    return docReady && imgRatio >= 0.5;
  }

  function startLoadMonitor() {
    let ticks = 0;

    loadMonitorId = setInterval(() => {

      /* ইউজার dismiss করেছে → সব বন্ধ */
      if (window._slowWatchDismissed) {
        stopMonitors();
        return;
      }

      ticks++;
      const stable = isPageStable();

      const imgs   = Array.from(document.querySelectorAll('img'));
      const total  = imgs.length;
      const loaded = imgs.filter(i => i.complete && i.naturalWidth > 0).length;
      console.debug(`[SlowWatch] Load tick #${ticks}: ${loaded}/${total} imgs, doc=${document.readyState}`);

      if (stable) {
        console.info('[SlowWatch] Page stable → hiding notification');
        stopMonitors();
        /* একটু graceful delay দিয়ে সরাও */
        setTimeout(() => {
          if (window._slowWatchDismissed) return;
          hideIsland();
          /* rotate আবার শুরু */
          setTimeout(rotateIsland, 2000);
        }, 800);
      }

      /* 5 মিনিট পরেও stable না হলে force stop */
      if (ticks >= 300) {
        stopMonitors();
        hideIsland();
        setTimeout(rotateIsland, 2000);
      }

    }, 1000);
  }

  /* ══════════════════════════════════════════════════════════════
     NET MONITOR
     নেট ঠিক হয়ে গেলেও notification সরিয়ে দাও
     ══════════════════════════════════════════════════════════════ */
  function startNetMonitor() {
    /* প্রতি ৮ সেকেন্ডে একবার connection check */
    netMonitorId = setInterval(async () => {
      if (window._slowWatchDismissed) { stopMonitors(); return; }
      if (!notificationSent) { stopMonitors(); return; }

      const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

      /* Navigator API দিয়ে চেক */
      if (conn) {
        const nowSlow =
          conn.effectiveType === 'slow-2g' ||
          conn.effectiveType === '2g'      ||
          conn.downlink < 0.2              ||
          conn.rtt > 800;

        if (!nowSlow) {
          /* নেট ভালো হয়ে গেছে, কিন্তু পেজ stable কিনা দেখো */
          if (isPageStable()) {
            console.info('[SlowWatch] Net recovered + page stable → hiding');
            stopMonitors();
            setTimeout(() => {
              if (window._slowWatchDismissed) return;
              hideIsland();
              setTimeout(rotateIsland, 2000);
            }, 800);
          }
        }
        return; /* API available থাকলে fetch test দরকার নেই */
      }

      /* Navigator API নেই → fetch দিয়ে চেক */
      try {
        const t0   = performance.now();
        const blob = await fetch(`/favicon.ico?_nm=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(4000),
        }).then(r => r.blob());

        const kbps = ((blob.size * 8) / ((performance.now() - t0) / 1000)) / 1000;

        if (kbps >= 200 && isPageStable()) {
          console.info(`[SlowWatch] Net recovered (${kbps.toFixed(0)}kbps) + stable → hiding`);
          stopMonitors();
          setTimeout(() => {
            if (window._slowWatchDismissed) return;
            hideIsland();
            setTimeout(rotateIsland, 2000);
          }, 800);
        }
      } catch (_) { /* timeout বা error → এখনো স্লো */ }

    }, 8000);
  }

  function stopMonitors() {
    if (loadMonitorId) { clearInterval(loadMonitorId); loadMonitorId = null; }
    if (netMonitorId)  { clearInterval(netMonitorId);  netMonitorId  = null; }
  }

  /* ══════════════════════════════════════════════════════════════
     SIGNAL 1 — Navigator Connection API
     ══════════════════════════════════════════════════════════════ */
  function checkConnectionAPI() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return;

    function analyze() {
      const isSlow =
        conn.effectiveType === 'slow-2g' ||
        conn.effectiveType === '2g'      ||
        conn.downlink < 0.2              ||
        conn.rtt > 800;

      console.debug(`[SlowWatch] S1: type=${conn.effectiveType} dl=${conn.downlink} rtt=${conn.rtt} → ${isSlow}`);
      evaluateSignals('connectionAPI', isSlow);
    }

    analyze();
    conn.addEventListener('change', () => { if (!notificationSent) analyze(); });
  }

  /* ══════════════════════════════════════════════════════════════
     SIGNAL 2 — Download Speed Test
     ══════════════════════════════════════════════════════════════ */
  function runDownloadTest() {
    const controller = new AbortController();
    const t0         = performance.now();

    const tid = setTimeout(() => {
      controller.abort();
      console.debug('[SlowWatch] S2: timeout → slow');
      evaluateSignals('downloadTest', true);
    }, 5000);

    fetch(`/favicon.ico?_sl=${Date.now()}`, { cache: 'no-store', signal: controller.signal })
      .then(r => r.blob())
      .then(blob => {
        clearTimeout(tid);
        const kbps   = ((blob.size * 8) / ((performance.now() - t0) / 1000)) / 1000;
        const isSlow = kbps < 200;
        console.debug(`[SlowWatch] S2: ${kbps.toFixed(0)}kbps → ${isSlow}`);
        evaluateSignals('downloadTest', isSlow);
      })
      .catch(err => {
        clearTimeout(tid);
        if (err.name !== 'AbortError') console.debug('[SlowWatch] S2: fetch error');
      });
  }

  /* ══════════════════════════════════════════════════════════════
     SIGNAL 3 — Resource Timing
     ══════════════════════════════════════════════════════════════ */
  function checkResourceTiming() {
    if (!performance?.getEntriesByType) return;

    setTimeout(() => {
      if (notificationSent) return;

      const entries = performance.getEntriesByType('resource')
        .filter(e => e.transferSize > 500 && e.duration > 0);

      if (entries.length < 2) return;

      /* Filter to medium-sized resources only (> 10KB).
         Small files (< 10KB) are dominated by latency, not bandwidth,
         and will appear "slow" even on fast connections. */
const mediumEntries = entries.filter(e => e.transferSize > 10000);
if (mediumEntries.length < 2) return; /* not enough data */

const avg = mediumEntries
  .map(e => ((e.transferSize * 8) / (e.duration / 1000)) / 1000)
  .filter(s => s > 0 && s < 50000)
  .reduce((a, b, _, arr) => a + b / arr.length, 0);

/* 50kbps threshold — ≤ 50kbps on medium-sized files is genuinely slow */
const isSlow = avg < 50;



      console.debug(`[SlowWatch] S3: avg=${avg.toFixed(0)}kbps → ${isSlow}`);
      evaluateSignals('resourceTiming', isSlow);
    }, 2000);
  }

  /* ══════════════════════════════════════════════════════════════
     SIGNAL 4 — Image Load Observer
     ══════════════════════════════════════════════════════════════ */
  function watchImages() {
    /* Only watch images currently in (or near) the viewport.
       Lazy-loaded images below the fold are intentionally not loaded yet —
       counting them as "slow" would be a false positive on every page load. */
const viewportH = window.innerHeight;
const pending = Array.from(document.querySelectorAll('img'))
  .filter(img => {
    if (img.complete) return false; /* already loaded */
    const rect = img.getBoundingClientRect();
    return rect.top < viewportH + 300; /* in viewport or just below */
  });

if (pending.length === 0) {
  evaluateSignals('imageObserver', false);
  return;
}

    const SLOW_MS = 5000;
    const t0      = performance.now();
    let slow      = 0;
    let done      = 0;

    function settle(type) {
      done++;
      if (type === 'error' || performance.now() - t0 > SLOW_MS) slow++;
      if (done >= pending.length) {
        const isSlow = slow / pending.length >= 0.5;
        console.debug(`[SlowWatch] S4: ${slow}/${pending.length} slow → ${isSlow}`);
        evaluateSignals('imageObserver', isSlow);
      }
    }

    pending.forEach(img => {
      img.addEventListener('load',  () => settle('load'),  { once: true });
      img.addEventListener('error', () => settle('error'), { once: true });
    });

    /* Safety: 10s পরেও pending থাকলে */
    setTimeout(() => {
      if (notificationSent) return;
      const still = pending.filter(i => !i.complete).length;
      if (still > 0) evaluateSignals('imageObserver', true);
    }, 10000);
  }

  /* ══════════════════════════════════════════════════════════════
     START
     ══════════════════════════════════════════════════════════════ */
  function start() {
    console.debug('[SlowWatch] Starting...');
    checkConnectionAPI();
    /* Signal 2 (favicon download test) removed — favicon files are too
       small (< 500B) to measure bandwidth; latency always dominates and
       makes even fast connections appear as < 50kbps, causing 100% false positives. */
    checkResourceTiming();
    watchImages();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
}

    
/* ================================================================
   6. PRODUCT CARDS
   ================================================================ */
function buildProductCards() {
  const grid = document.getElementById('krProductCardsGrid');
  if (typeof window._krHideSkeleton === 'function') window._krHideSkeleton();
  if (!grid) return;

  const lang = getLang();
  const products = Object.values(KR.PRODUCTS)
    .filter(p => p.status !== 'archived' && p.status !== 'draft')
    .sort((a,b) => (a.priority||100)-(b.priority||100) || a.id-b.id);
  const settings = window.KRProducts?.state?.settings || {};
  const maxPerRow = Math.max(1, Math.min(10, Number(settings.showcaseMaxPerRow || 10)));
  const manual = settings.showcaseLayoutMode === 'manual' && products.some(p => p.showcaseRow);
  let rows = [];

  if (manual) {
    const grouped = new Map();
    products.forEach(p => {
      const row = Number(p.showcaseRow || 1);
      if (!grouped.has(row)) grouped.set(row, []);
      grouped.get(row).push(p);
    });
    rows = [...grouped.entries()].sort((a,b)=>a[0]-b[0]).map(([,items]) =>
      items.sort((a,b)=>(a.showcasePosition||999)-(b.showcasePosition||999)||(a.priority||100)-(b.priority||100))
    );
  } else {
    const rowCount = Math.max(1, Math.ceil(products.length / maxPerRow));
    const base = Math.floor(products.length / rowCount);
    const extra = products.length % rowCount;
    let cursor = 0;
    for (let r=0; r<rowCount; r++) {
      const count = base + (r < extra ? 1 : 0);
      rows.push(products.slice(cursor, cursor + count)); cursor += count;
    }
  }

  const cardHTML = p => {
    const name = lang === 'bn' ? p.name_bn : p.name_en;
    const sub = lang === 'bn' ? p.sub_bn : p.sub_en;
    const stats = p.stats || {};
    const out = p.salesStatus === 'out_of_stock';
    const limited = p.salesStatus === 'limited';
    const liked = window.KRProducts?.isLiked(p.id);
    const badgeText = out ? (lang==='bn'?'স্টক শেষ':'Out of Stock') : limited ? (lang==='bn'?'সীমিত স্টক':'Limited') : (p.category || (lang==='bn'?'এক্সক্লুসিভ':'Exclusive'));
    return `
    <article class="kr-product-card${out?' is-out-of-stock':''}" data-pid="${p.id}" role="button" tabindex="0" aria-label="${name}">
      <div class="kr-product-card-img">
        <span class="kr-img-skel-wrap"><span class="skeleton kr-img-skel"></span>
          <img src="${p.imageUrl}" alt="${name}" loading="lazy" onload="this.previousElementSibling.classList.add('is-gone')" onerror="krImgRetry(this)" />
        </span>
        <div class="kr-product-card-badge${out?' kr-product-card-badge--out':limited?' kr-product-card-badge--limited':''}">${badgeText}</div>
        <button type="button" class="kr-product-card-like${liked?' is-liked':''}" data-product-like="${p.id}" aria-label="Like ${name}" aria-pressed="${liked?'true':'false'}">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="${liked?'currentColor':'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8z"/></svg>
        </button>
        <button type="button" class="kr-product-card-select kr-product-order-btn" data-product-order="${p.id}" ${out?'disabled':''}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/></svg>
          <span>${out ? (lang==='bn'?'শীঘ্রই আবার আসছে':'Restocking Soon') : (lang==='bn'?'এখনই অর্ডার করুন':'Order Now')}</span>
        </button>
      </div>
      <div class="kr-product-card-body">
        <div class="kr-product-card-name">${name}</div>
        <div class="kr-product-card-sub">${sub}</div>
        <div class="kr-product-card-footer">${productPriceHTML(p,true)}</div>
        <div class="kr-product-card-stats" data-stat-product="${p.id}">
          <span class="kr-product-card-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6a5.5 5.5 0 0 0 1-8.8z"/></svg><b data-stat="likes">${stats.likes||0}</b></span>
          <span class="kr-product-card-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg><b data-stat="views">${stats.views||0}</b></span>
          <span class="kr-product-card-stat"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h2l2 12h11l2-8H6"/><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/></svg><b data-stat="carts">${stats.carts||0}</b></span>
          <span class="kr-product-card-stat">${window.KRUIIcon?.('sold')||''}<b data-stat="sold">${stats.sold||0}</b></span>
        </div>
      </div>
    </article>`;
  };

  grid.classList.add('kr-product-showcase-rows');
  grid.innerHTML = rows.map((items,rowIndex) => `
    <section class="kr-product-showcase-row" data-product-row="${rowIndex+1}">
      <button type="button" class="kr-product-row-arrow kr-product-row-arrow--prev" data-row-scroll="prev" aria-label="Previous products">‹</button>
      <div class="kr-product-showcase-track">${items.map(cardHTML).join('')}</div>
      <button type="button" class="kr-product-row-arrow kr-product-row-arrow--next" data-row-scroll="next" aria-label="Next products">›</button>
      <div class="kr-product-row-nav">${items.map((_,i)=>`<button type="button" class="kr-product-row-dot${i===0?' is-active':''}" data-row-dot="${i}" aria-label="Product ${i+1}"></button>`).join('')}</div>
    </section>`).join('');
  const oldDots = document.getElementById('krProductDots'); if (oldDots) oldDots.style.display='none';

  grid.querySelectorAll('.kr-product-card').forEach(card => {
    const pid = Number(card.dataset.pid);
    const open = () => window.KRProductDetails?.open(pid, card);
    card.addEventListener('click', e => { if (!e.target.closest('button,a')) open(); });
    card.addEventListener('keydown', e => { if ((e.key==='Enter'||e.key===' ') && !e.target.closest('button,a')) { e.preventDefault(); open(); } });
  });
  grid.querySelectorAll('[data-product-order]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation(); if (btn.disabled) return; handleSelectFromHero(Number(btn.dataset.productOrder), 'showcase_order');
  }));
  grid.querySelectorAll('[data-product-like]').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation(); window.KRProductDetails?.toggleLike(Number(btn.dataset.productLike), btn);
  }));

  grid.querySelectorAll('.kr-product-showcase-row').forEach(row => {
    const track=row.querySelector('.kr-product-showcase-track'), cards=[...row.querySelectorAll('.kr-product-card')], dots=[...row.querySelectorAll('.kr-product-row-dot')];
    const update=()=>{
      const left=track.getBoundingClientRect().left;
      let active=0,best=Infinity; cards.forEach((c,i)=>{const d=Math.abs(c.getBoundingClientRect().left-left);if(d<best){best=d;active=i;}});
      dots.forEach((d,i)=>d.classList.toggle('is-active',i===active));
      row.querySelector('[data-row-scroll="prev"]').disabled=track.scrollLeft<=2;
      row.querySelector('[data-row-scroll="next"]').disabled=track.scrollLeft+track.clientWidth>=track.scrollWidth-2;
    };
    row.querySelectorAll('[data-row-scroll]').forEach(btn=>btn.addEventListener('click',()=>track.scrollBy({left:(btn.dataset.rowScroll==='next'?1:-1)*Math.max(220,track.clientWidth*.8),behavior:'smooth'})));
    dots.forEach((dot,i)=>dot.addEventListener('click',()=>cards[i]?.scrollIntoView({behavior:'smooth',block:'nearest',inline:'start'})));
    let tid;track.addEventListener('scroll',()=>{clearTimeout(tid);tid=setTimeout(update,60);},{passive:true}); update();
  });
  initProductDetailsHint();
}
function initProductDetailsHint(){
  const section=document.getElementById('kr-products');if(!section||sessionStorage.getItem('kr_product_details_hint_seen')==='1'||section.querySelector('.kr-product-details-hint'))return;
  const hint=document.createElement('div');hint.className='kr-product-details-hint';hint.setAttribute('role','status');hint.innerHTML=`<span>${getLang()==='bn'?'প্রোডাক্ট কার্ডে ট্যাপ করলে সম্পূর্ণ বিস্তারিত দেখতে পারবেন':'Tap any product card to view full details'}</span><button type="button" aria-label="Dismiss" data-track-id="showcase_hint_dismiss">×</button>`;section.querySelector('.container')?.appendChild(hint);
  let timer;const show=()=>{if(sessionStorage.getItem('kr_product_details_hint_seen')==='1')return;sessionStorage.setItem('kr_product_details_hint_seen','1');hint.classList.add('is-visible');window.krTrackUI?.('showcase_hint_impression',{ui_location:'product_showcase'});timer=setTimeout(()=>hint.classList.remove('is-visible'),3000)};
  hint.querySelector('button').addEventListener('click',()=>{clearTimeout(timer);hint.classList.remove('is-visible')});
  const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.2)){observer.disconnect();setTimeout(show,350)}},{threshold:[.2]});observer.observe(section);
}
/* ================================================================
   7. HERO BANNER — independent content, never generated from products
   ================================================================ */
const HERO_CONFIG={AUTO_SLIDE_INTERVAL:5000,RESUME_AFTER_PAUSE:10000,SWIPE_THRESHOLD:50};
let HERO_SLIDES=[];
const heroState={current:0,autoTimer:null,resumeTimer:null,isPaused:false,dragStartX:0,dragging:false,dragMoved:false};
function syncHeroSlides(){
  HERO_SLIDES=(window.KRProducts?.state?.heroSlides||[]).filter(x=>x.status!=='archived'&&x.imageUrl).sort((a,b)=>(a.priority||100)-(b.priority||100)||a.id-b.id);
  if(heroState.current>=HERO_SLIDES.length)heroState.current=0;
}
function heroLineHTML(slide,language){
  const lines=language==='bn'?slide.lines_bn:slide.lines_en;
  return [0,1,2].map(i=>{const text=String(lines?.[i]||'');if(!text)return'';return `<span class="kr-hero-line kr-hero-line--${i===1?'accent':'light'}">${escapeHTML(text)}</span>`;}).join('');
}
function buildHeroBanner(){
  syncHeroSlides();const banner=document.getElementById('krHeroBanner');if(!banner)return;const language=getLang();
  if(!HERO_SLIDES.length){banner.innerHTML=`<div style="min-height:220px;display:flex;align-items:center;justify-content:center;color:var(--text-muted)">${language==='bn'?'নতুন কালেকশন শীঘ্রই আসছে':'New collection coming soon'}</div>`;return;}
  banner.innerHTML=`<div class="kr-hero-slides">${HERO_SLIDES.map((x,i)=>`<div class="kr-hero-slide${i===0?' is-active':''}" data-slide="${i}" role="group" aria-roledescription="slide" aria-label="${i+1} of ${HERO_SLIDES.length}"><div class="kr-hero-skeleton"></div><img class="kr-hero-img" src="${escapeHTML(x.imageUrl)}" alt="${escapeHTML(x.internalName||`Hero ${i+1}`)}" loading="${i===0?'eager':'lazy'}" decoding="async"></div>`).join('')}</div><div class="kr-hero-overlay-gradient" aria-hidden="true"></div><div class="kr-hero-overlay-content"><div class="kr-hero-texts">${HERO_SLIDES.map((x,i)=>`<div class="kr-hero-text-group${i===0?' is-active':''}" data-text="${i}"><h1 class="kr-hero-headline">${heroLineHTML(x,language)}</h1></div>`).join('')}</div><div class="kr-hero-actions"><button type="button" class="kr-hero-btn kr-hero-btn--primary" id="krHeroOrderBtn" data-track-id="hero_order"><i data-lucide="shopping-bag"></i><span>${language==='bn'?'অর্ডার করুন':'Order Now'}</span></button><button type="button" class="kr-hero-btn kr-hero-btn--ghost" id="krHeroCollectionsBtn" data-track-id="hero_collections"><span>${language==='bn'?'কালেকশন':'Collections'}</span><i data-lucide="arrow-right"></i></button></div></div><button type="button" class="kr-hero-arrow kr-hero-arrow--prev" id="krHeroPrev" data-track-id="hero_prev" aria-label="Previous slide"><i data-lucide="chevron-left"></i></button><button type="button" class="kr-hero-arrow kr-hero-arrow--next" id="krHeroNext" data-track-id="hero_next" aria-label="Next slide"><i data-lucide="chevron-right"></i></button><div class="kr-hero-dots" id="krHeroDots" role="tablist">${HERO_SLIDES.map((_,i)=>`<button type="button" class="kr-hero-dot${i===0?' is-active':''}" data-dot="${i}" data-track-id="hero_dot" aria-label="Go to slide ${i+1}"></button>`).join('')}</div>`;
  window.lucide?.createIcons?.();
}
function goToHeroSlide(index){
  if(!HERO_SLIDES.length)return;const next=((index%HERO_SLIDES.length)+HERO_SLIDES.length)%HERO_SLIDES.length,banner=document.getElementById('krHeroBanner');if(!banner)return;
  banner.querySelectorAll('.kr-hero-slide').forEach((x,i)=>x.classList.toggle('is-active',i===next));banner.querySelectorAll('.kr-hero-text-group').forEach((x,i)=>x.classList.toggle('is-active',i===next));banner.querySelectorAll('.kr-hero-dot').forEach((x,i)=>x.classList.toggle('is-active',i===next));heroState.current=next;
  window.krTrackUI?.('hero_slide_impression',{ui_location:'hero',slide_id:HERO_SLIDES[next]?.id,slide_index:next});
}
function nextHeroSlide(){goToHeroSlide(heroState.current+1)}function prevHeroSlide(){goToHeroSlide(heroState.current-1)}
function stopHeroAuto(){if(heroState.autoTimer){clearInterval(heroState.autoTimer);heroState.autoTimer=null}}
function startHeroAuto(){stopHeroAuto();if(heroState.isPaused||HERO_SLIDES.length<2||document.hidden)return;heroState.autoTimer=setInterval(nextHeroSlide,HERO_CONFIG.AUTO_SLIDE_INTERVAL)}
function pauseHeroAndResume(){heroState.isPaused=true;stopHeroAuto();clearTimeout(heroState.resumeTimer);heroState.resumeTimer=setTimeout(()=>{heroState.isPaused=false;startHeroAuto()},HERO_CONFIG.RESUME_AFTER_PAUSE)}
function attachHeroListeners(){
  const banner=document.getElementById('krHeroBanner');if(!banner||!HERO_SLIDES.length)return;banner.querySelectorAll('.kr-hero-img').forEach(img=>{const done=()=>{img.classList.add('is-loaded');img.closest('.kr-hero-slide')?.classList.add('is-image-loaded')};if(img.complete&&img.naturalWidth)done();else{img.addEventListener('load',done,{once:true});img.addEventListener('error',()=>krImgRetry(img),{once:true})}});
  document.getElementById('krHeroNext')?.addEventListener('click',e=>{e.stopPropagation();nextHeroSlide();pauseHeroAndResume()});document.getElementById('krHeroPrev')?.addEventListener('click',e=>{e.stopPropagation();prevHeroSlide();pauseHeroAndResume()});banner.querySelectorAll('.kr-hero-dot').forEach(d=>d.addEventListener('click',e=>{e.stopPropagation();goToHeroSlide(Number(d.dataset.dot));pauseHeroAndResume()}));
  document.getElementById('krHeroOrderBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('kr-order-form')?.scrollIntoView({behavior:'smooth',block:'start'})});document.getElementById('krHeroCollectionsBtn')?.addEventListener('click',e=>{e.stopPropagation();document.getElementById('kr-products')?.scrollIntoView({behavior:'smooth',block:'start'})});
  banner.addEventListener('mouseenter',()=>{heroState.isPaused=true;stopHeroAuto()});banner.addEventListener('mouseleave',pauseHeroAndResume);
  const begin=x=>{heroState.dragStartX=x;heroState.dragging=true;heroState.dragMoved=false;banner.classList.add('is-touching')},move=x=>{if(heroState.dragging&&Math.abs(x-heroState.dragStartX)>5)heroState.dragMoved=true},end=x=>{if(!heroState.dragging)return;heroState.dragging=false;banner.classList.remove('is-touching');const d=x-heroState.dragStartX;if(Math.abs(d)>=HERO_CONFIG.SWIPE_THRESHOLD){d<0?nextHeroSlide():prevHeroSlide();pauseHeroAndResume()}};
  banner.addEventListener('touchstart',e=>begin(e.touches[0].clientX),{passive:true});banner.addEventListener('touchmove',e=>move(e.touches[0].clientX),{passive:true});banner.addEventListener('touchend',e=>end(e.changedTouches[0].clientX));banner.addEventListener('mousedown',e=>{if(e.button===0)begin(e.clientX)});window.addEventListener('mousemove',e=>move(e.clientX));window.addEventListener('mouseup',e=>end(e.clientX));
  banner.tabIndex=0;banner.addEventListener('keydown',e=>{if(e.key==='ArrowRight'){nextHeroSlide();pauseHeroAndResume()}if(e.key==='ArrowLeft'){prevHeroSlide();pauseHeroAndResume()}});
}
function initHeroBanner(){buildHeroBanner();attachHeroListeners();startHeroAuto();document.addEventListener('visibilitychange',()=>document.hidden?stopHeroAuto():startHeroAuto())}

/* ================================================================
   handleSelectFromHero — shared by hero, product cards, carousel
   ================================================================ */
function handleSelectFromHero(pid, source = 'product_select') {
  const product = KR.PRODUCTS[pid];
  if (!product) return;
  if (product.salesStatus === 'out_of_stock') {
    showIsland('info', getLang()==='bn'?'স্টক শেষ':'Out of Stock', getLang()==='bn'?'পণ্যটি শীঘ্রই আবার আসবে। WhatsApp-এ জানতে পারেন।':'This product is restocking soon. You can ask on WhatsApp.', 4500);
    return;
  }
  window.KRProducts?.recordCart(pid, source, 'order_entry');
  const inst = checkoutInstances.find(i => i.pid === pid && i.instanceId === `base_${pid}`);
  if (!inst) return;
  if (inst.qty === 0) inst.qty = 1; else inst.qty = Math.min(10, inst.qty + 1);
  resolveInstanceVariant(inst);

  if (window.SessionTracker) {
    window.SessionTracker.recordCartAction({
      pid: product.id,
      name: product.name_en,
      size: selectionDisplay(product, inst, 'en').map(x => x.value).join(' / '),
      color: '',
      qty: inst.qty,
      price: instanceUnitPrice(inst)
    });
  }
  if (window.LeadMessenger) {
    window.LeadMessenger.startCartAbandonmentTimer(20);
  }

  const selectionLabel = selectionDisplay(product, inst, 'en').map(x => x.value).join(' / ');
  if (inst.variantId || !productOptions(product).some(o => o.createsVariant)) {
    trackAddToCartThrottled(product, inst.qty, selectionLabel || 'Default', '');
  }
  buildCheckoutProducts();
  updateSummary();
  refreshWALink();
  document.getElementById('kr-order-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
  showIsland('success',
    getLang() === 'bn' ? 'পণ্য যোগ করা হয়েছে' : 'Added to Order',
    getLang() === 'bn' ? getProductName(product) + ' বেছে নেওয়া হয়েছে' : getProductName(product) + ' selected'
  );
}


window.krSelectProduct = handleSelectFromHero;



/* ============================================================
   PRODUCT GRID — Scroll Dots + Magnetic Snap
   ============================================================ */
(function initProductScrollDots() {
  'use strict';

  var grid = document.getElementById('krProductCardsGrid');
  var dotsWrap = document.getElementById('krProductDots');
  if (!grid || !dotsWrap) return;

  // Wait for JS to populate real cards (replacing skeletons)
  var observer = new MutationObserver(function () {
    var cards = grid.querySelectorAll('.kr-product-card:not(.kr-product-card--skeleton)');
    if (cards.length > 0) {
      observer.disconnect();
      setupDots(cards);
    }
  });
  observer.observe(grid, { childList: true, subtree: true });

  // Also try immediately (cards might already be loaded)
  var existingCards = grid.querySelectorAll('.kr-product-card:not(.kr-product-card--skeleton)');
  if (existingCards.length > 0) {
    observer.disconnect();
    setupDots(existingCards);
  }

  function setupDots(cards) {
    var totalCards = cards.length;

    // Build dots dynamically based on actual card count
    dotsWrap.innerHTML = '';
    for (var i = 0; i < totalCards; i++) {
      var dot = document.createElement('button');
      dot.className = 'kr-product-dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('data-dot', i);
      dot.setAttribute('aria-label', 'Product ' + (i + 1));
      dotsWrap.appendChild(dot);
    }

    var dots = dotsWrap.querySelectorAll('.kr-product-dot');

    // --- Dot click → scroll to that card ---
    dotsWrap.addEventListener('click', function (e) {
      var dotBtn = e.target.closest('.kr-product-dot');
      if (!dotBtn) return;
      var idx = parseInt(dotBtn.getAttribute('data-dot'), 10);
      if (isNaN(idx) || !cards[idx]) return;

      cards[idx].scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'start'
      });
    });

    // --- Scroll → update active dots ---
    var scrollTimeout;
    grid.addEventListener('scroll', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateActiveDots, 60);
    }, { passive: true });

    function updateActiveDots() {
      if (!grid || !dots.length) return;

      var gridRect = grid.getBoundingClientRect();
      var gridLeft = gridRect.left;
      var gridRight = gridRect.right;

      // Find which cards are currently visible
      for (var i = 0; i < cards.length; i++) {
        var cardRect = cards[i].getBoundingClientRect();
        // Card is "visible" if at least 50% of it is within the grid viewport
        var cardCenter = cardRect.left + cardRect.width / 2;
        var isVisible = cardCenter >= gridLeft && cardCenter <= gridRight;

        if (dots[i]) {
          if (isVisible) {
            dots[i].classList.add('is-active');
          } else {
            dots[i].classList.remove('is-active');
          }
        }
      }
    }

    // Initial state
    updateActiveDots();

    // Re-check on resize
    window.addEventListener('resize', function () {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(updateActiveDots, 100);
    }, { passive: true });
  }
})();



/* ================================================================
   8. CAROUSEL
   ================================================================ */

/*
  =========================
  CAROUSEL SPEED SETTINGS
  =========================

  1) AUTO_DURATION = true হলে item count অনুযায়ী speed auto set হবে
  2) SECONDS_PER_ITEM বাড়ালে carousel ধীরে চলবে
  3) SECONDS_PER_ITEM কমালে carousel দ্রুত চলবে
  4) AUTO_DURATION = false করলে LOOP_DURATION_SECONDS ব্যবহার হবে

  উদাহরণ:
  105 ছবি × 3.5s = 367.5s ≈ 6 মিনিট 7 সেকেন্ড
*/
/* ================================================================
   8. CAROUSEL
   ================================================================ */

/*
  =========================
  CAROUSEL SETTINGS
  =========================

  AUTO_DURATION = true হলে item count অনুযায়ী loop duration auto set হবে
  INTERACTION_PAUSE_MS = user interaction শেষ হওয়ার পরে এই সময় auto-scroll বন্ধ থাকবে
  DRAG/TOUCH multiplier = drag sensitivity
  INERTIA_* = swipe / flick physics
*/
const KR_CAROUSEL_SETTINGS = {
  AUTO_DURATION: true,
  LOOP_DURATION_SECONDS: 200,
  SECONDS_PER_ITEM: 2,
  MIN_DURATION: 60,
  MAX_DURATION: 120,

  INTERACTION_PAUSE_MS: 2500,

  DRAG_MULTIPLIER: 1,
  TOUCH_MULTIPLIER: 1,

  DRAG_THRESHOLD: 6,
  MAX_INERTIA_SPEED: 2800, // px/sec
  INERTIA_FRICTION: 0.92,  // lower = faster slow-down
  AUTO_BLEND: 0.06         // auto speed-এ কত smooth এ ফিরবে
};

function getCarouselDuration(itemCount) {
  if (!KR_CAROUSEL_SETTINGS.AUTO_DURATION) {
    return KR_CAROUSEL_SETTINGS.LOOP_DURATION_SECONDS;
  }

  return Math.max(
    KR_CAROUSEL_SETTINGS.MIN_DURATION,
    Math.min(
      KR_CAROUSEL_SETTINGS.MAX_DURATION,
      itemCount * KR_CAROUSEL_SETTINGS.SECONDS_PER_ITEM
    )
  );
}

let KR_CAROUSEL_ITEMS=[];
function getCarouselItems(){return [...Object.values(KR.PRODUCTS).map(p=>({imageUrl:p.imageUrl,name:getProductName(p),price:p.price,stats:p.stats||{},pid:p.id})),...KR.GALLERY_IMAGES.map(item=>typeof item==='string'?{imageUrl:item,name:getLang()==='bn'?'করা রয়্যাল কালেকশন':'KORA ROYAL Collection',price:null,stats:null,pid:null}:{imageUrl:item.url,name:getLang()==='bn'?(item.name_bn||item.name_en||'করা রয়্যাল কালেকশন'):(item.name_en||'KORA ROYAL Collection'),price:null,stats:null,pid:null})].filter(x=>x.imageUrl)}
function carouselCardContent(item,eager=false){return `<span class="kr-img-skel-wrap"><span class="skeleton kr-img-skel"></span><img class="kr-carousel-card-img" src="${escapeHTML(item.imageUrl)}" alt="${escapeHTML(item.name)}" loading="${eager?'eager':'lazy'}" decoding="async" fetchpriority="${eager?'high':'low'}" onload="this.previousElementSibling.classList.add('is-gone')" onerror="krImgRetry(this)"></span><div class="kr-carousel-card-info"><div class="kr-carousel-card-name">${escapeHTML(item.name)}</div><div class="kr-carousel-card-meta">${item.stats?`<span>❤ ${item.stats.likes||0} · 👁 ${item.stats.views||0} · ${item.stats.sold||0} ${getLang()==='bn'?'বিক্রি':'sold'}</span>`:'<span></span>'}${item.price?`<span class="kr-carousel-card-price">${fmtPrice(item.price)}</span>`:''}</div></div>`}
function updateCarouselCard(card,item,itemIndex,eager=false){card.dataset.itemIndex=String(itemIndex);card.dataset.pid=item.pid||'';card.innerHTML=carouselCardContent(item,eager)}
function renderInitialCarouselPool(track,items,head=0){track.innerHTML='';if(!items.length)return;const pool=Math.min(28,Math.max(12,Math.min(items.length+8,24)));const frag=document.createDocumentFragment();for(let i=0;i<pool;i++){const idx=(head+i)%items.length,card=document.createElement('article');card.className='kr-carousel-card';updateCarouselCard(card,items[idx],idx,i<7);frag.appendChild(card)}track.appendChild(frag)}
function applyCarouselSpeed(itemCount){const track=document.getElementById('krCarouselTrack');if(!track)return;const duration=getCarouselDuration(itemCount||0);track.style.animation='none';track.dataset.carouselDuration=String(duration);window.__krCarouselEngine?.setDuration(duration)}
function buildCarousel(){const track=document.getElementById('krCarouselTrack');if(!track)return;KR_CAROUSEL_ITEMS=getCarouselItems();if(window.__krCarouselEngine)window.__krCarouselEngine.setItems(KR_CAROUSEL_ITEMS);else renderInitialCarouselPool(track,KR_CAROUSEL_ITEMS);applyCarouselSpeed(KR_CAROUSEL_ITEMS.length)}
class KRCarouselEngine{
 constructor(viewport,track){this.viewport=viewport;this.track=track;this.items=[];this.head=0;this.poolSize=0;this.step=0;this.offset=0;this.velocity=0;this.autoSpeed=0;this.duration=getCarouselDuration(0);this.needsInitialOffset=false;this.dragging=false;this.didDrag=false;this.preventClick=false;this.pointerId=null;this.startPointerX=0;this.startOffset=0;this.lastPointerX=0;this.lastPointerT=0;this.pausedUntil=0;this.lastFrame=0;this.raf=0;this.visible=false;this.tick=this.tick.bind(this);this.refresh=this.refresh.bind(this);this.bind();this.setItems(KR_CAROUSEL_ITEMS)}
 bind(){this.viewport.addEventListener('dragstart',e=>e.preventDefault());this.viewport.addEventListener('click',e=>{if(this.preventClick){e.preventDefault();e.stopPropagation();this.preventClick=false;return}const card=e.target.closest('.kr-carousel-card'),pid=Number(card?.dataset.pid);if(pid)window.KRProductDetails?.open(pid,card)},true);this.viewport.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')this.pause()});this.viewport.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;this.pointerId=e.pointerId;this.dragging=true;this.didDrag=false;this.startPointerX=e.clientX;this.startOffset=this.offset;this.lastPointerX=e.clientX;this.lastPointerT=performance.now();this.velocity=0;this.pause();this.viewport.classList.add('is-dragging');this.viewport.setPointerCapture?.(e.pointerId)});this.viewport.addEventListener('pointermove',e=>{if(!this.dragging||e.pointerId!==this.pointerId)return;const now=performance.now(),dx=e.clientX-this.startPointerX;this.offset=this.startOffset-dx;const dt=now-this.lastPointerT;if(dt>0){const v=-(e.clientX-this.lastPointerX)/dt*1000;this.velocity=this.velocity*.72+v*.28}if(Math.abs(dx)>KR_CAROUSEL_SETTINGS.DRAG_THRESHOLD)this.didDrag=true;this.lastPointerX=e.clientX;this.lastPointerT=now;this.render()},{passive:true});const end=e=>{if(!this.dragging||e.pointerId!==this.pointerId)return;this.dragging=false;this.pointerId=null;this.velocity=Math.max(-KR_CAROUSEL_SETTINGS.MAX_INERTIA_SPEED,Math.min(KR_CAROUSEL_SETTINGS.MAX_INERTIA_SPEED,this.velocity));this.preventClick=this.didDrag;this.viewport.classList.remove('is-dragging');this.recycle();this.render();this.pause()};this.viewport.addEventListener('pointerup',end);this.viewport.addEventListener('pointercancel',end);this.viewport.addEventListener('wheel',e=>{const d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(!d)return;this.velocity=0;this.offset+=d;this.recycle();this.render();this.pause()},{passive:true});this.resizeObserver=new ResizeObserver(()=>this.refresh());this.resizeObserver.observe(this.viewport);this.intersectionObserver=new IntersectionObserver(es=>{const yes=es.some(x=>x.isIntersecting&&x.intersectionRatio>.02);if(yes!==this.visible){this.visible=yes;this.viewport.classList.toggle('is-engine-running',yes);yes?this.start():this.stop()}},{threshold:[0,.02]});this.intersectionObserver.observe(this.viewport);document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();else if(this.visible)this.start()})}
 setItems(items){this.track.classList.add('is-preparing');this.items=items||[];this.head=this.items.length?this.items.length-1:0;this.offset=0;this.velocity=0;this.needsInitialOffset=!!this.items.length;renderInitialCarouselPool(this.track,this.items,this.head);this.poolSize=this.track.children.length;this.duration=getCarouselDuration(this.items.length);requestAnimationFrame(this.refresh)}
 setDuration(v){this.duration=Number(v)||0;this.updateSpeed()}
 refresh(){const old=this.step,first=this.track.firstElementChild;if(!first){this.step=0;this.track.classList.remove('is-preparing');return}const style=getComputedStyle(this.track),gap=parseFloat(style.columnGap||style.gap)||0;this.step=first.getBoundingClientRect().width+gap;if(this.needsInitialOffset&&this.step){this.offset=this.step;this.needsInitialOffset=false}else if(old>0&&this.step>0)this.offset=this.offset/old*this.step;this.updateSpeed();this.recycle();this.render();this.track.classList.remove('is-preparing')}
 updateSpeed(){this.autoSpeed=this.step&&this.items.length&&this.duration?this.step*this.items.length/this.duration:0}
 pause(){this.pausedUntil=performance.now()+KR_CAROUSEL_SETTINGS.INTERACTION_PAUSE_MS}
 recycle(){if(!this.step||!this.items.length||this.dragging)return;while(this.offset>=this.step){this.offset-=this.step;this.head=(this.head+1)%this.items.length;const card=this.track.firstElementChild;this.track.appendChild(card);const idx=(this.head+this.poolSize-1)%this.items.length;updateCarouselCard(card,this.items[idx],idx,false)}while(this.offset<0){this.head=(this.head-1+this.items.length)%this.items.length;const card=this.track.lastElementChild;this.track.insertBefore(card,this.track.firstElementChild);updateCarouselCard(card,this.items[this.head],this.head,false);this.offset+=this.step}}
 render(){const dpr=Math.max(1,window.devicePixelRatio||1),px=Math.round(this.offset*dpr)/dpr;this.track.style.transform=`translate3d(${-px}px,0,0)`}
 start(){if(this.raf||!this.visible)return;this.lastFrame=0;this.raf=requestAnimationFrame(this.tick)}stop(){if(this.raf)cancelAnimationFrame(this.raf);this.raf=0;this.lastFrame=0}
 tick(ts){this.raf=0;if(!this.visible||document.hidden)return;if(!this.lastFrame)this.lastFrame=ts;const dt=Math.min(.034,(ts-this.lastFrame)/1000||.016);this.lastFrame=ts;if(!this.dragging&&this.step){if(ts<this.pausedUntil){const f=Math.pow(KR_CAROUSEL_SETTINGS.INERTIA_FRICTION,dt*60);this.velocity*=f;if(Math.abs(this.velocity)<3)this.velocity=0}else{const blend=1-Math.pow(1-KR_CAROUSEL_SETTINGS.AUTO_BLEND,dt*60);this.velocity+=(this.autoSpeed-this.velocity)*blend}this.offset+=this.velocity*dt;this.recycle();this.render()}this.raf=requestAnimationFrame(this.tick)}
}
function initCarouselDrag(){const viewport=document.getElementById('krCarouselViewport'),track=document.getElementById('krCarouselTrack');if(!viewport||!track)return;if(window.__krCarouselEngine){window.__krCarouselEngine.setItems(KR_CAROUSEL_ITEMS);return}viewport.dataset.carouselDragInit='1';window.__krCarouselEngine=new KRCarouselEngine(viewport,track)}

/* ================================================================
   9. DISTRICT DROPDOWN
   ================================================================ */
function initDistrict() {
  const trigger  = document.getElementById('krDistrictTrigger');
  const dropdown = document.getElementById('krDistrictDropdown');
  const list     = document.getElementById('krDistrictList');
  const search   = document.getElementById('krDistrictSearch');
  const hidden   = document.getElementById('krDistrictVal');
  const display  = document.getElementById('krDistrictDisplay');
  if (!trigger || !dropdown || !list) return;

  const searchInp = search ? (search.tagName === 'INPUT' ? search : search.querySelector('input')) : null;
  function buildList(filter) {
    list.innerHTML = KR.DISTRICTS
      .filter(d => !filter || d.toLowerCase().includes(filter.toLowerCase()))
      .map(d => `<div class="kr-district-option" data-val="${d}" role="option">${d}</div>`)
      .join('');
    list.querySelectorAll('.kr-district-option').forEach(opt => {
      opt.addEventListener('mousedown', (e) => { e.preventDefault(); });
      opt.addEventListener('click', () => {
        const val = opt.getAttribute('data-val');
        hidden.value      = val;
        display.textContent = val;
        
        
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
document.dispatchEvent(new CustomEvent('kr:district-change', { detail: { district: val } }));


        display.style.color = 'var(--text-primary)';
        dropdown.classList.remove('is-open');
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');
        list.querySelectorAll('.kr-district-option').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');
        if (searchInp) { searchInp.value = ''; buildList(''); }
        updateSummary(); refreshWALink();
        const field = document.getElementById('fieldDistrict');
        if (field) field.classList.remove('is-error');

        if (window.SessionTracker) {
          window.SessionTracker.recordFormField('district', val);
        }
      });
    });
  }
  buildList('');
  trigger.addEventListener('click', () => {
    const open = dropdown.classList.toggle('is-open');
    trigger.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open && searchInp) setTimeout(() => searchInp.focus(), 50);
  });
  if (searchInp) searchInp.addEventListener('input', () => buildList(searchInp.value));
  document.addEventListener('click', e => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('is-open'); trigger.classList.remove('is-open'); trigger.setAttribute('aria-expanded', 'false');
    }
  });
}











/* ================================================================
   THANA / UPAZILA DROPDOWN
   ================================================================ */

function initThanaDropdown() {
  const trigger = document.getElementById('krThanaTrigger');
  const dropdown = document.getElementById('krThanaDropdown');
  const list = document.getElementById('krThanaList');
  const search = document.getElementById('krThanaSearch');
  const hidden = document.getElementById('krThana');
  const display = document.getElementById('krThanaDisplay');

  if (!trigger || !dropdown || !list || !hidden || !display) return;

  const searchInp = search ? (search.tagName === 'INPUT' ? search : search.querySelector('input')) : null;

  function getCurrentDistrict() {
    return (document.getElementById('krDistrictVal') || {}).value || '';
  }

  function getThanaList() {
    const district = getCurrentDistrict();

    if (KR.THANAS_BY_DISTRICT && KR.THANAS_BY_DISTRICT[district]) {
      return KR.THANAS_BY_DISTRICT[district];
    }

    return [];
  }

      function resetThana() {
    hidden.value = '';
    display.textContent = display.getAttribute('data-en') || 'Select Thana (Optional)';
    display.style.color = 'var(--text-muted)';
    if (searchInp) searchInp.value = '';
    buildList('');
  }

  function buildList(filter) {
    const thanas = getThanaList();

    if (!thanas.length) {
      list.innerHTML = `
  <div class="kr-thana-option is-empty">
    Select district first
  </div>
`;
      return;
    }

    list.innerHTML = thanas
      .filter(t => !filter || t.toLowerCase().includes(filter.toLowerCase()))
      .map(t => `<div class="kr-thana-option" data-val="${t}" role="option">${t}</div>`)
      .join('');

    list.querySelectorAll('.kr-thana-option').forEach(opt => {
      opt.addEventListener('mousedown', e => e.preventDefault());

      opt.addEventListener('click', () => {
        const val = opt.getAttribute('data-val');

        hidden.value = val;
        display.textContent = val;
        display.style.color = 'var(--text-primary)';

        dropdown.classList.remove('is-open');
        trigger.classList.remove('is-open');
        trigger.setAttribute('aria-expanded', 'false');

        list.querySelectorAll('.kr-thana-option').forEach(o => o.classList.remove('is-selected'));
        opt.classList.add('is-selected');

        if (searchInp) {
          searchInp.value = '';
          buildList('');
        }

        if (window.SessionTracker) {
          window.SessionTracker.recordFormField('thana', val);
        }

        if (typeof refreshWALink === 'function') {
          refreshWALink();
        }
      });
    });
  }

  buildList('');

  trigger.addEventListener('click', () => {
    const open = dropdown.classList.toggle('is-open');

    trigger.classList.toggle('is-open', open);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      buildList('');
      if (searchInp) setTimeout(() => searchInp.focus(), 50);
    }
  });

  if (searchInp) {
    searchInp.addEventListener('input', () => buildList(searchInp.value));
  }

  document.addEventListener('click', e => {
    if (!trigger.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('is-open');
      trigger.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  });

  document.addEventListener('kr:district-change', resetThana);
}






/* ================================================================
   10. CHECKOUT PRODUCT ROWS
   ================================================================ */
function buildCheckoutProducts() {
  const container = document.getElementById('krCoList');
  if (!container) return;
  container.innerHTML = '';
  const byPid = {};
  checkoutInstances.forEach(inst => { (byPid[inst.pid] ||= []).push(inst); resolveInstanceVariant(inst); });
  const lang = getLang();
  const T = {
    qty:lang==='bn'?'পরিমাণ':'Qty', add:lang==='bn'?'যোগ করুন':'Add', sizeChart:lang==='bn'?'সাইজ চার্ট':'Size chart',
    duplicate:lang==='bn'?'এই পণ্য আবার যোগ করুন':'Add another variant', variant:lang==='bn'?'ভ্যারিয়েন্ট ':'Variant ',
    required:'*', unavailable:lang==='bn'?'এই ভ্যারিয়েন্টটি এখন পাওয়া যাচ্ছে না':'This variant is currently unavailable',
    selectAll:lang==='bn'?'সব অপশন নির্বাচন করুন':'Select all required options'
  };

  const optionControl = (product,inst,option) => {
    const label = lang==='bn'?(option.label_bn||option.label_en):option.label_en;
    const selected = inst.selections?.[option.code] || '';
    const disabled = product.salesStatus==='out_of_stock';
    let control='';
    if(option.displayType==='text') {
      control=`<input type="text" class="kr-input kr-option-text" data-instance="${inst.instanceId}" data-option-code="${escapeHTML(option.code)}" value="${escapeHTML(selected)}" placeholder="${escapeHTML(label)}" ${disabled?'disabled':''} maxlength="300">`;
    } else if(option.displayType==='dropdown') {
      control=`<select class="kr-input kr-option-select" data-instance="${inst.instanceId}" data-option-code="${escapeHTML(option.code)}" ${disabled?'disabled':''}><option value="">${lang==='bn'?'বেছে নিন':'Select'} ${escapeHTML(label)}</option>${(option.values||[]).map(v=>`<option value="${escapeHTML(v.code)}" ${String(selected)===String(v.code)?'selected':''}>${escapeHTML(lang==='bn'?(v.value_bn||v.value_en):v.value_en)}</option>`).join('')}</select>`;
    } else {
      control=`<div class="kr-co-field-options kr-option-values kr-option-values--${escapeHTML(option.displayType||'buttons')}">${(option.values||[]).map(v=>{
        const valueName=lang==='bn'?(v.value_bn||v.value_en):v.value_en,isSelected=String(selected)===String(v.code),swatch=option.displayType==='swatches';
        return `<button type="button" class="kr-option-btn${swatch?' kr-option-btn--swatch':''}${isSelected?' is-selected':''}" data-instance="${inst.instanceId}" data-option-code="${escapeHTML(option.code)}" data-option-value="${escapeHTML(v.code)}" aria-pressed="${isSelected}" title="${escapeHTML(valueName)}" ${disabled?'disabled':''}>${swatch?`<span class="kr-option-swatch" style="--swatch:${escapeHTML(v.colorHex||'#d1d5db')}"></span><span>${escapeHTML(valueName)}</span>`:escapeHTML(valueName)}</button>`;
      }).join('')}</div>`;
    }
    return `<div class="kr-co-field kr-generic-option" data-option-field="${escapeHTML(option.code)}"><span class="kr-co-field-label">${escapeHTML(label)}${option.required?` <em>${T.required}</em>`:''}</span>${control}</div>`;
  };

  Object.keys(byPid).forEach(pid => {
    const product=KR.PRODUCTS[pid];if(!product)return;
    byPid[pid].forEach((inst,idx)=>{
      const isBase=inst.instanceId===`base_${pid}`,isActive=inst.qty>0,isExpanded=isActive,blocked=product.salesStatus==='out_of_stock';
      const baseName=getProductName(product),displayName=isBase?baseName:`${baseName} — ${T.variant}${idx+1}`,subText=lang==='bn'?(product.sub_bn||''):(product.sub_en||'');
      const variant=resolveInstanceVariant(inst),options=productOptions(product),variantRequired=options.some(o=>o.createsVariant),allRequired=options.filter(o=>o.required).every(o=>inst.selections?.[o.code]);
      const variantState=blocked?`<div class="kr-variant-state is-out">${lang==='bn'?'স্টক শেষ — শীঘ্রই আবার আসছে':'Out of stock — restocking soon'}</div>`:inst.variantUnavailable?`<div class="kr-variant-state is-out">${T.unavailable}</div>`:variant?`<div class="kr-variant-state is-ready">${escapeHTML(variant.sku)} · ${lang==='bn'?'নির্বাচিত':'Selected'}</div>`:variantRequired&&allRequired?`<div class="kr-variant-state is-out">${T.unavailable}</div>`:options.length?`<div class="kr-variant-state">${T.selectAll}</div>`:'';
      const remove=!isBase?`<button type="button" class="kr-co-instance-remove" data-instance="${inst.instanceId}" aria-label="Remove variant"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`:'';
      const duplicate=isBase&&!blocked?`<button type="button" class="kr-duplicate-btn" data-pid="${pid}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>${T.duplicate}</span></button>`:'';
      const price=instanceUnitPrice(inst),el=document.createElement('div');
      el.className=`kr-co-row${isActive?' is-active':''}${isExpanded?' is-expanded':''}${blocked?' is-product-blocked':''}`;el.dataset.instance=inst.instanceId;
      el.innerHTML=`<div class="kr-co-row-header" data-toggle="1"><span class="kr-img-skel-wrap"><span class="skeleton kr-img-skel"></span><img class="kr-co-thumb" src="${escapeHTML(product.imageUrl)}" alt="${escapeHTML(baseName)}" loading="lazy" onload="this.previousElementSibling.classList.add('is-gone')" onerror="krImgRetry(this)"></span><div class="kr-co-info"><div class="kr-co-name">${escapeHTML(displayName)}</div>${subText?`<div class="kr-co-sub">${escapeHTML(subText)}</div>`:''}<div class="kr-co-price" id="price_${inst.instanceId}">${fmtPrice(price)}</div></div><div class="kr-co-header-actions"><span class="kr-co-qty-badge" id="qtyBadge_${inst.instanceId}">${inst.qty}</span><button type="button" class="kr-co-add-pill" data-action="expand" data-instance="${inst.instanceId}" ${blocked?'disabled':''}>+ ${T.add}</button>${remove}<button type="button" class="kr-co-chevron" data-action="toggle" data-instance="${inst.instanceId}" aria-label="Toggle details"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="6 9 12 15 18 9"/></svg></button></div></div><div class="kr-co-controls"><div class="kr-co-divider"></div>${options.map(o=>optionControl(product,inst,o)).join('')}${variantState}<div class="kr-co-qty-row"><div class="kr-co-qty-left"><span class="kr-co-field-label" style="min-width:auto">${T.qty}</span><div class="kr-qty-wrap"><button type="button" class="kr-qty-btn kr-qty-minus" data-instance="${inst.instanceId}" ${blocked?'disabled':''}>−</button><div class="kr-qty-val" id="qtyVal_${inst.instanceId}">${inst.qty}</div><button type="button" class="kr-qty-btn kr-qty-plus" data-instance="${inst.instanceId}" ${blocked?'disabled':''}>+</button></div>${product.sizeChartTemplateId||product.sizeChart?.headers?.length||product.sizeChart?.cells?.length?`<button type="button" class="kr-co-sizechart-btn" data-pid="${pid}">${T.sizeChart}</button>`:''}</div><div class="kr-co-subtotal${inst.qty>0?'':' is-empty'}" id="subtotal_${inst.instanceId}">${inst.qty>0?fmtPrice(price*inst.qty):'—'}</div></div>${duplicate}</div>`;
      container.appendChild(el);
    });
  });
}

function setInstanceOption(inst,code,value,action='option') {
  const product=KR.PRODUCTS[inst.pid];if(!product||product.salesStatus==='out_of_stock')return;
  inst.selections ||= {};if(value)inst.selections[code]=value;else delete inst.selections[code];
  inst.size=inst.selections.size||'';inst.color=inst.selections.color||'';if(inst.qty===0)inst.qty=1;
  resolveInstanceVariant(inst);window.KRProducts?.recordCart(inst.pid,action,`${code}:${value}`);rebuildInstance(inst.instanceId);updateSummary();refreshWALink();
  const label=selectionDisplay(product,inst,'en').map(x=>x.value).join(' / ');if(label)trackAddToCartThrottled(product,inst.qty,label,'');
}

function handleCheckoutClick(e) {
  const remove=e.target.closest('.kr-co-instance-remove');if(remove){e.stopPropagation();checkoutInstances=checkoutInstances.filter(i=>i.instanceId!==remove.dataset.instance);buildCheckoutProducts();updateSummary();refreshWALink();return;}
  const chart=e.target.closest('.kr-co-sizechart-btn');if(chart){e.stopPropagation();openSizeChart(Number(chart.dataset.pid));return;}
  const dup=e.target.closest('.kr-duplicate-btn');if(dup){e.stopPropagation();duplicateInstance(Number(dup.dataset.pid));return;}
  const option=e.target.closest('.kr-option-btn');if(option){e.stopPropagation();const inst=checkoutInstances.find(i=>i.instanceId===option.dataset.instance);if(inst)setInstanceOption(inst,option.dataset.optionCode,option.dataset.optionValue,'option_click');return;}
  const plus=e.target.closest('.kr-qty-plus');if(plus){e.stopPropagation();const inst=checkoutInstances.find(i=>i.instanceId===plus.dataset.instance);if(!inst)return;const p=KR.PRODUCTS[inst.pid];if(p?.salesStatus==='out_of_stock')return;if(inst.qty>=10){showIsland('info',getLang()==='bn'?'সর্বোচ্চ পরিমাণ':'Maximum Quantity',getLang()==='bn'?'বেশি পরিমাণ লাগলে WhatsApp করুন অথবা পণ্য ডুপ্লিকেট করুন।':'For more, contact WhatsApp or duplicate the product.',4500);return;}inst.qty++;window.KRProducts?.recordCart(inst.pid,'quantity',String(inst.qty));rebuildInstance(inst.instanceId);updateSummary();refreshWALink();return;}
  const minus=e.target.closest('.kr-qty-minus');if(minus){e.stopPropagation();const inst=checkoutInstances.find(i=>i.instanceId===minus.dataset.instance);if(inst&&inst.qty>0){inst.qty--;window.KRProducts?.recordCart(inst.pid,'quantity',String(inst.qty));rebuildInstance(inst.instanceId);updateSummary();refreshWALink();}return;}
  const trigger=e.target.closest('[data-action="expand"],[data-action="toggle"],[data-toggle="1"]');if(trigger){const row=trigger.closest('.kr-co-row');if(!row)return;if(trigger.dataset.action==='expand'){row.classList.add('is-expanded');const inst=checkoutInstances.find(i=>i.instanceId===row.dataset.instance);if(inst&&inst.qty===0&&KR.PRODUCTS[inst.pid]?.salesStatus!=='out_of_stock'){inst.qty=1;window.KRProducts?.recordCart(inst.pid,'checkout_expand','add');rebuildInstance(inst.instanceId);updateSummary();refreshWALink();}}else row.classList.toggle('is-expanded');}
}
function handleCheckoutChange(e){
  const select=e.target.closest('.kr-option-select,.kr-option-text');if(!select)return;const inst=checkoutInstances.find(i=>i.instanceId===select.dataset.instance);if(inst)setInstanceOption(inst,select.dataset.optionCode,select.value,select.classList.contains('kr-option-text')?'option_text':'option_select');
}

function rebuildInstance(instanceId) {
  const inst=checkoutInstances.find(i=>i.instanceId===instanceId),product=inst&&KR.PRODUCTS[inst.pid];if(!inst||!product)return;const variant=resolveInstanceVariant(inst),price=instanceUnitPrice(inst);
  const qty=document.getElementById(`qtyVal_${instanceId}`),badge=document.getElementById(`qtyBadge_${instanceId}`),subtotal=document.getElementById(`subtotal_${instanceId}`),priceEl=document.getElementById(`price_${instanceId}`),row=document.querySelector(`.kr-co-row[data-instance="${instanceId}"]`);
  if(qty)qty.textContent=inst.qty;if(badge)badge.textContent=inst.qty;if(priceEl)priceEl.textContent=fmtPrice(price);if(subtotal){subtotal.textContent=inst.qty>0?fmtPrice(price*inst.qty):'—';subtotal.classList.toggle('is-empty',inst.qty===0);}
  if(row){row.classList.toggle('is-active',inst.qty>0);if(inst.qty>0)row.classList.add('is-expanded');row.querySelectorAll('.kr-option-btn').forEach(btn=>{const yes=String(inst.selections?.[btn.dataset.optionCode]||'')===String(btn.dataset.optionValue);btn.classList.toggle('is-selected',yes);btn.setAttribute('aria-pressed',yes?'true':'false');});row.querySelectorAll('.kr-option-select,.kr-option-text').forEach(el=>{if(document.activeElement!==el)el.value=inst.selections?.[el.dataset.optionCode]||'';});const stateEl=row.querySelector('.kr-variant-state');if(stateEl){const defs=productOptions(product).filter(o=>o.createsVariant),complete=defs.every(o=>inst.selections?.[o.code]);stateEl.className=`kr-variant-state${inst.variantUnavailable||complete&&!variant?' is-out':variant?' is-ready':''}`;stateEl.textContent=inst.variantUnavailable||complete&&!variant?(getLang()==='bn'?'এই ভ্যারিয়েন্টটি এখন পাওয়া যাচ্ছে না':'This variant is currently unavailable'):variant?`${variant.sku} · ${getLang()==='bn'?'নির্বাচিত':'Selected'}`:(getLang()==='bn'?'সব অপশন নির্বাচন করুন':'Select all required options');}}
}

function duplicateInstance(pid) {
  const product=KR.PRODUCTS[pid];if(!product||product.salesStatus==='out_of_stock')return;window.KRProducts?.recordCart(pid,'variant_duplicate',String(Date.now()));const instanceId=`dup_${pid}_${Date.now()}`;checkoutInstances.push({instanceId,pid,selections:{},variantId:null,size:'',color:'',qty:1,unitPrice:Number(product.price||0)});buildCheckoutProducts();updateSummary();refreshWALink();setTimeout(()=>document.querySelector(`.kr-co-row[data-instance="${instanceId}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}),100);showIsland('info',getLang()==='bn'?'ডুপ্লিকেট যোগ হয়েছে':'Variant Added',getLang()==='bn'?'নতুন অপশন নির্বাচন করুন':'Select options for the new variant');
}

/* ================================================================
   11. ORDER SUMMARY
   ================================================================ */
function updateSummary() {
  const district=(document.getElementById('krDistrictVal')||{}).value||'',couponCode=state.couponApplied?state.couponCode:'',payment=state.paymentMethod;let advance=0;if(payment==='bKash')advance=Number((document.getElementById('krBkashAdvance')||{}).value)||0;if(payment==='Nagad')advance=Number((document.getElementById('krNagadAdvance')||{}).value)||0;
  const totals=calcTotals(checkoutInstances,district,couponCode,advance),active=checkoutInstances.filter(i=>i.qty>0),itemsEl=document.getElementById('krSummaryItems'),totalsEl=document.getElementById('krSummaryTotals');if(!itemsEl)return;
  if(!active.length){itemsEl.innerHTML=`<div class="kr-summary-empty"><span>${getLang()==='bn'?'এখনো কোনো পণ্য বেছে নেননি':'No items selected yet'}</span></div>`;if(totalsEl)totalsEl.style.display='none';return;}
  itemsEl.innerHTML=active.map(inst=>{const p=KR.PRODUCTS[inst.pid],meta=selectionDisplay(p,inst).map(x=>`${x.label}: ${x.value}`).join(' · '),price=instanceUnitPrice(inst);return `<div class="kr-summary-item"><img class="kr-summary-item-img" src="${escapeHTML(p.imageUrl)}" alt="${escapeHTML(getProductName(p))}"><div class="kr-summary-item-info"><div class="kr-summary-item-name">${escapeHTML(getProductName(p))}</div><div class="kr-summary-item-meta">${escapeHTML(meta||'—')} · x${inst.qty}</div></div><div class="kr-summary-item-price">${fmtPrice(price*inst.qty)}</div></div>`;}).join('');
  if(totalsEl){totalsEl.style.display='flex';const el=id=>document.getElementById(id);if(el('krSumSubtotal'))el('krSumSubtotal').textContent=fmtPrice(totals.subtotal);if(el('krSumDelivery'))el('krSumDelivery').textContent=totals.delivery===0?(getLang()==='bn'?'ফ্রি':'Free'):fmtPrice(totals.delivery);if(el('krSumTotal'))el('krSumTotal').textContent=fmtPrice(totals.totalPayable);const dr=el('krSumDiscountRow');if(dr){dr.style.display=totals.discountAmt>0?'flex':'none';if(el('krSumDiscount'))el('krSumDiscount').textContent='-'+fmtPrice(totals.discountAmt);if(el('krSumDiscountLabel'))el('krSumDiscountLabel').textContent=getLang()==='bn'?`ছাড় (${couponCode})`:`Discount (${couponCode})`;}const ar=el('krSumAdvanceRow');if(ar){ar.style.display=advance>0?'flex':'none';if(el('krSumAdvance'))el('krSumAdvance').textContent='-'+fmtPrice(advance);}const cr=el('krSumCodRow');if(cr){cr.style.display=payment!=='COD'&&advance>0?'flex':'none';if(el('krSumCod'))el('krSumCod').textContent=fmtPrice(totals.codRemaining);}}
}

function refreshWALink() {
  const district=(document.getElementById('krDistrictVal')||{}).value||'',payment=state.paymentMethod;let advance=0,trxId='';if(payment==='bKash'){advance=Number((document.getElementById('krBkashAdvance')||{}).value)||0;trxId=(document.getElementById('krBkashTrx')||{}).value||'';}if(payment==='Nagad'){advance=Number((document.getElementById('krNagadAdvance')||{}).value)||0;trxId=(document.getElementById('krNagadTrx')||{}).value||'';}const totals=calcTotals(checkoutInstances,district,state.couponApplied?state.couponCode:'',advance),customer={name:(document.getElementById('krName')||{}).value||'',phone:(document.getElementById('krPhone')||{}).value||'',email:(document.getElementById('krEmail')||{}).value||'',district,thana:(document.getElementById('krThana')||{}).value||'',address:(document.getElementById('krAddress')||{}).value||'',note:(document.getElementById('krNote')||{}).value||''};updateWALink('KR-WA-PENDING',checkoutInstances.filter(i=>i.qty>0),customer,{method:payment,advance,trxId},state.couponApplied?state.couponCode:'',totals);
}
/* ================================================================
   12. PAYMENT
   ================================================================ */
function initPayment() {
  const radios      = document.querySelectorAll('input[name="krPayment"]');
  const bkashPanel  = document.getElementById('krBkashPanel');
  const nagadPanel  = document.getElementById('krNagadPanel');
  if (!radios.length) return;
  function updatePanel(val) {
    state.paymentMethod = val;
    if (bkashPanel) bkashPanel.classList.toggle('is-open', val === 'bKash');
    if (nagadPanel) nagadPanel.classList.toggle('is-open', val === 'Nagad');
    updateSummary(); refreshWALink();
  }
  radios.forEach(r => r.addEventListener('change', () => {
    if (r.checked) {
      updatePanel(r.value);
      const district = (document.getElementById('krDistrictVal') || {}).value || '';
      const totals   = calcTotals(checkoutInstances, district, '', 0);
      pushAddPaymentInfo(totals.totalPayable, r.value);
    }
  }));
  ['krBkashAdvance', 'krNagadAdvance'].forEach(id => { const el = document.getElementById(id); if (el) el.addEventListener('input', () => { updateSummary(); refreshWALink(); }); });
}

/* ================================================================
   13. COUPON
   ================================================================ */
function initCoupon() {
  const btn      = document.getElementById('krCouponApply');
  const input    = document.getElementById('krCoupon');
  const feedback = document.getElementById('krCouponFeedback');
  if (!btn || !input) return;
  async function apply() {
    const code = input.value.trim().toUpperCase();
    if (!code) { if (feedback) { feedback.textContent = getLang() === 'bn' ? 'কুপন কোড দিন' : 'Please enter a coupon code'; feedback.className = 'kr-coupon-feedback is-error'; } return; }
    const district = (document.getElementById('krDistrictVal') || {}).value || '';
    const phone    = (document.getElementById('krPhone') || {}).value || '';
    const items    = checkoutInstances.filter(i => i.qty > 0).map(i => ({ productId: i.pid, variantId: i.variantId || null, quantity: i.qty, unitPrice: instanceUnitPrice(i) }));
    if (!items.length) {
      if (feedback) { feedback.textContent = getLang() === 'bn' ? 'আগে পণ্য বেছে নিন' : 'Select products first'; feedback.className = 'kr-coupon-feedback is-error'; }
      return;
    }
    btn.disabled = true;
    if (feedback) { feedback.textContent = getLang() === 'bn' ? 'যাচাই করা হচ্ছে…' : 'Checking…'; feedback.className = 'kr-coupon-feedback'; }
    try {
      /* সার্ভার-সাইড ভ্যালিডেশন (validity/limit/min-shopping/cap/BOGO/ফ্রি ডেলিভারি) */
      const res = await fetch(`${KR_API.WORKER_URL}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, phone, district, items })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || (getLang() === 'bn' ? 'অবৈধ কুপন কোড' : 'Invalid coupon code'));
      window.KR_COUPON_QUOTE = j;
      state.couponCode = j.code; state.couponApplied = true; state.discountPct = j.type === 'percent' ? Number(j.value) || 0 : 0;
      const benefit = j.freeDelivery
        ? (getLang() === 'bn' ? 'ফ্রি ডেলিভারি' : 'Free delivery')
        : (j.type === 'bogo'
          ? (getLang() === 'bn' ? 'BOGO — ফ্রি পণ্য' : 'BOGO — free item(s)')
          : (getLang() === 'bn' ? `৳${Number(j.discountAmt).toLocaleString()} ছাড়` : `৳${Number(j.discountAmt).toLocaleString()} off`));
      if (feedback) { feedback.textContent = getLang() === 'bn' ? `কুপন প্রযোজ্য! ${benefit}` : `Coupon applied! ${benefit}`; feedback.className = 'kr-coupon-feedback is-success'; }
      updateSummary(); refreshWALink();
      showIsland('offer', getLang() === 'bn' ? 'কুপন সফল!' : 'Coupon Applied!', getLang() === 'bn' ? `${benefit} পেয়েছেন` : `${benefit} added`);
    } catch (err) {
      window.KR_COUPON_QUOTE = null;
      state.couponApplied = false; state.couponCode = ''; state.discountPct = 0;
      if (feedback) { feedback.textContent = err.message; feedback.className = 'kr-coupon-feedback is-error'; }
      updateSummary();
      showIsland('error', getLang() === 'bn' ? 'কুপন প্রযোজ্য নয়' : 'Coupon Not Valid', err.message);
    } finally {
      btn.disabled = false;
    }
  }
  btn.addEventListener('click', apply);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); apply(); } });
}

/* ================================================================
   14. VALIDATION
   ================================================================ */
function clearError(fieldId) {
  const f = document.getElementById(fieldId); if (f) f.classList.remove('is-error');
  const t = document.getElementById('krDistrictTrigger'); if (fieldId === 'fieldDistrict' && t) t.classList.remove('is-error');
}
function setError(fieldId, scrollTo) {
  const f = document.getElementById(fieldId);
  if (f) {
    f.classList.add('is-error');
    const inp = f.querySelector('.kr-input, .kr-textarea');
    if (inp) { inp.classList.add('is-error'); inp.style.animation = 'none'; setTimeout(() => { inp.style.animation = ''; }, 10); }
    if (fieldId === 'fieldDistrict') { const t = document.getElementById('krDistrictTrigger'); if (t) t.classList.add('is-error'); }
    if (scrollTo) f.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function validate() {
  const lang         = getLang();
  const activeInsts  = checkoutInstances.filter(i => i.qty > 0);
  if (activeInsts.length === 0) {
    showIsland('error', lang === 'bn' ? 'পণ্য বেছে নিন' : 'Select a Product', lang === 'bn' ? 'অন্তত একটি পণ্য বেছে নিন' : 'Please select at least one product');
    document.getElementById('krCoList').scrollIntoView({ behavior: 'smooth', block: 'center' });
    shakeConfirmBtn(); return false;
  }
  for (const inst of activeInsts) {
    const p = KR.PRODUCTS[inst.pid];
    if (!p || p.salesStatus === 'out_of_stock') {
      showIsland('error', lang==='bn'?'পণ্যটি স্টক শেষ':'Product Out of Stock', lang==='bn'?'এই পণ্যটি এখন অর্ডার করা যাবে না।':'This product cannot be ordered right now.');
      document.querySelector(`[data-instance="${inst.instanceId}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}); shakeConfirmBtn(); return false;
    }
    const missing = productOptions(p).filter(o => o.required && !inst.selections?.[o.code]);
    if (missing.length) {
      const label = lang==='bn'?(missing[0].label_bn||missing[0].label_en):missing[0].label_en;
      showIsland('error', lang==='bn'?'অপশন বেছে নিন':'Option Required', lang==='bn'?`${getProductName(p)}-এর ${label} বেছে নিন`:`Select ${label} for ${p.name_en}`);
      document.querySelector(`[data-instance="${inst.instanceId}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}); shakeConfirmBtn(); return false;
    }
    const hasVariantOptions = productOptions(p).some(o => o.createsVariant);
    resolveInstanceVariant(inst);
    if ((hasVariantOptions && !inst.variantId) || inst.variantUnavailable) {
      showIsland('error', lang==='bn'?'ভ্যারিয়েন্ট পাওয়া যাচ্ছে না':'Variant Unavailable', lang==='bn'?`${getProductName(p)}-এর অন্য অপশন বেছে নিন`:`Choose another option combination for ${p.name_en}`);
      document.querySelector(`[data-instance="${inst.instanceId}"]`)?.scrollIntoView({behavior:'smooth',block:'center'}); shakeConfirmBtn(); return false;
    }
  }
  const name = document.getElementById('krName');
  if (!name || !name.value.trim()) { setError('fieldName', true); showIsland('error', lang === 'bn' ? 'নাম দিন' : 'Name Required', lang === 'bn' ? 'আপনার পুরো নাম লিখুন' : 'Please enter your full name'); shakeConfirmBtn(); return false; }
  clearError('fieldName');
  const phone = document.getElementById('krPhone');
  if (!phone || !isValidBDPhone(phone.value)) { setError('fieldPhone', true); showIsland('error', lang === 'bn' ? 'সঠিক নম্বর দিন' : 'Valid Phone Required', lang === 'bn' ? '01XXXXXXXXX ফরম্যাটে নম্বর দিন' : 'Enter a valid BD phone number'); shakeConfirmBtn(); return false; }
  clearError('fieldPhone');
  const district = document.getElementById('krDistrictVal');
  if (!district || !district.value.trim()) { setError('fieldDistrict', true); showIsland('error', lang === 'bn' ? 'জেলা বেছে নিন' : 'District Required', lang === 'bn' ? 'আপনার জেলা বেছে নিন' : 'Please select your district'); shakeConfirmBtn(); return false; }
  clearError('fieldDistrict');
  const address = document.getElementById('krAddress');
  if (!address || address.value.trim().length < 10) { setError('fieldAddress', true); showIsland('error', lang === 'bn' ? 'ঠিকানা দিন' : 'Address Required', lang === 'bn' ? 'কমপক্ষে ১০ অক্ষরের ঠিকানা দিন' : 'Enter at least 10 characters'); shakeConfirmBtn(); return false; }
  clearError('fieldAddress');
  if (state.paymentMethod === 'bKash') { const t = document.getElementById('krBkashTrx'); if (!t || !t.value.trim()) { setError('fieldBkashTrx', true); showIsland('error', lang === 'bn' ? 'ট্রানজেকশন আইডি দিন' : 'Transaction ID Required', ''); shakeConfirmBtn(); return false; } clearError('fieldBkashTrx'); }
  if (state.paymentMethod === 'Nagad') { const t = document.getElementById('krNagadTrx');  if (!t || !t.value.trim()) { setError('fieldNagadTrx', true); showIsland('error', lang === 'bn' ? 'ট্রানজেকশন আইডি দিন' : 'Transaction ID Required', ''); shakeConfirmBtn(); return false; } clearError('fieldNagadTrx'); }
  
  const agreeTerms = document.getElementById('krAgreeTerms');
if (agreeTerms && !agreeTerms.checked) {
  showIsland(
    'error',
    lang === 'bn' ? 'শর্তাবলীতে সম্মতি দিন' : 'Agreement Required',
    lang === 'bn' ? 'অর্ডার করতে শর্তাবলীতে সম্মতি দিন' : 'Please agree to the terms before placing order'
  );
  shakeConfirmBtn();
  return false;
}

  return true;
}

function shakeConfirmBtn() {
  ['kr-confirm-btn', 'krFixedConfirm'].forEach(id => {
    const btn = document.getElementById(id); if (!btn) return;
    btn.classList.add('is-shaking'); setTimeout(() => btn.classList.remove('is-shaking'), 500);
  });
}

/* ================================================================
   15. ORDER FORM SUBMIT
   ================================================================ */
function initOrderForm() {
  const confirmBtn = document.getElementById('kr-confirm-btn');
  if (!confirmBtn) return;

  confirmBtn.addEventListener('click', async () => {
    if (state.isSubmitting) return;
    if (!validate()) return;
    state.isSubmitting = true;
    confirmBtn.classList.add('is-loading');
    confirmBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg><span>${getLang() === 'bn' ? 'প্রক্রিয়াকরণ হচ্ছে...' : 'Processing...'}</span>`;

    const orderId    = genOrderId();
    const district   = document.getElementById('krDistrictVal').value;
    const couponCode = state.couponApplied ? state.couponCode : '';
    const payment    = state.paymentMethod;
    let advance = 0, trxId = '';
    if (payment === 'bKash') { advance = parseFloat(document.getElementById('krBkashAdvance').value) || 0; trxId = document.getElementById('krBkashTrx').value.trim(); }
    if (payment === 'Nagad') { advance = parseFloat(document.getElementById('krNagadAdvance').value) || 0; trxId = document.getElementById('krNagadTrx').value.trim(); }
    const totals   = calcTotals(checkoutInstances, district, couponCode, advance);
    const customer = { name: document.getElementById('krName').value.trim(), phone: normalizePhone(document.getElementById('krPhone').value), email: document.getElementById('krEmail').value.trim(), district, thana:(document.getElementById('krThana')||{}).value||'', address: document.getElementById('krAddress').value.trim(), note: document.getElementById('krNote').value.trim() };
    const paymentObj = { method: payment, advance, trxId };
    const activeInstances = checkoutInstances.filter(i => i.qty > 0);
    const orderData = { orderId, idempotencyKey:orderId, customer, payment:paymentObj, couponCode, items:activeInstances.map(serializeOrderItem) };

    let sheetsOk = false, telegramOk = false, cancelDeadline = Date.now() + 5 * 60 * 1000, savedOrder = null;
    try {
      const result = await sendOrderToWorker(orderData);
      sheetsOk = result.sheets;
      telegramOk = result.telegram;
      if (result.cancelDeadline) cancelDeadline = result.cancelDeadline;
      savedOrder = result.order || null;
    } catch (err) {
      console.error('[main.js] Order send error:', err.message);
      state.isSubmitting = false;
      confirmBtn.classList.remove('is-loading');
      confirmBtn.innerHTML = `<i data-lucide="check-circle" style="width:17px;height:17px;"></i><span>${getLang() === 'bn' ? 'অর্ডার নিশ্চিত করুন' : 'Confirm Order'}</span>`;
      if (window.lucide) window.lucide.createIcons();
      if (window.KROrderProcessingAnimation) window.KROrderProcessingAnimation.hide();
      showIsland('error', getLang() === 'bn' ? 'অর্ডার সেভ হয়নি' : 'Order Not Saved', getLang() === 'bn' ? 'ইন্টারনেট চেক করে আবার চেষ্টা করুন। কোনো অর্ডার তৈরি হয়নি।' : 'Please check your connection and try again. No order was created.', 6000);
      return;
    }

    const localReceipt = savedOrder || {
      ...orderData, status:'pending', createdAt:Date.now(), cancelDeadline,
      totals, items:activeInstances.map(inst => { const p=KR.PRODUCTS[inst.pid]; return {productId:inst.pid,variantId:inst.variantId,productName:p?.name_en||'',productNameBn:p?.name_bn||'',imageUrl:p?.imageUrl||'',options:selectionDisplay(p,inst,'en').map(x=>({code:x.code,label_en:x.label,value_en:x.value,value_bn:x.value})),unitPrice:instanceUnitPrice(inst),quantity:inst.qty,lineTotal:instanceUnitPrice(inst)*inst.qty}; })
    };
    localStorage.setItem('kr_last_order', JSON.stringify({ ...localReceipt, _savedAt:Date.now() }));

    if (!sheetsOk && !telegramOk) {
      showIsland('info', getLang() === 'bn' ? 'অর্ডার সেভ হয়েছে' : 'Order Saved', getLang() === 'bn' ? 'সমস্যা হলে WhatsApp করুন' : 'Contact WhatsApp if any issue', 4000);
      await new Promise(resolve => setTimeout(resolve, 4000));
    }

    window.location.href = `success.html?id=${encodeURIComponent(orderId)}`;
  });

  /* WA Order Button */
  const waBtn = document.getElementById('waOrderBtn');
  if (waBtn) {
    waBtn.addEventListener('click', async e => {
      e.preventDefault();
      if (!validate()) return;
      const district   = document.getElementById('krDistrictVal').value;
      const couponCode = state.couponApplied ? state.couponCode : '';
      const payment    = state.paymentMethod;
      let advance = 0, trxId = '';
      if (payment === 'bKash') { advance = parseFloat(document.getElementById('krBkashAdvance').value) || 0; trxId = document.getElementById('krBkashTrx').value.trim(); }
      if (payment === 'Nagad') { advance = parseFloat(document.getElementById('krNagadAdvance').value) || 0; trxId = document.getElementById('krNagadTrx').value.trim(); }
      const totals     = calcTotals(checkoutInstances, district, couponCode, advance);
      const customer   = { name: document.getElementById('krName').value.trim(), phone: normalizePhone(document.getElementById('krPhone').value), email: document.getElementById('krEmail').value.trim(), district, thana:(document.getElementById('krThana')||{}).value||'', address: document.getElementById('krAddress').value.trim(), note: document.getElementById('krNote').value.trim() };
      const paymentObj = { method: payment, advance, trxId };
      const now        = new Date();
      const waOrderId  = `KR-${String(now.getDate()).padStart(2,'0')}${String(now.getMonth()+1).padStart(2,'0')}${now.getFullYear()}-${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}WA`;
      const activeInsts = checkoutInstances.filter(i => i.qty > 0);

      /* WhatsApp inquiry/order is not stored as a confirmed website order.
         Admin records actual WhatsApp sales manually from Inventory. */
      const msg = buildOrderMessage(waOrderId, activeInsts, customer, paymentObj, couponCode, totals);
      const num = KR.WHATSAPP.replace(/[^0-9]/g, '');

      window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener');

      pushWhatsappOrder(totals.totalPayable, activeInsts.reduce((s, i) => s + i.qty, 0));
      showIsland('success', getLang() === 'bn' ? 'হোয়াটসঅ্যাপ খুলছে' : 'Opening WhatsApp', getLang() === 'bn' ? 'আপনার অর্ডার সেভ হয়েছে' : 'Your order info has been saved', 3500);
    });
  }

  /* begin_checkout observer */
  const paySection = document.getElementById('krPaymentSection');
  if (paySection) {
    new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting && !state.beginCheckoutFired) {
          const activeInsts = checkoutInstances.filter(i => i.qty > 0);
          if (activeInsts.length > 0) {
            const district = (document.getElementById('krDistrictVal') || {}).value || '';
            const totals   = calcTotals(activeInsts, district, '', 0);
            pushBeginCheckout(activeInsts.map(inst => { const p = KR.PRODUCTS[inst.pid]; return { item_id:String(inst.pid), item_name:p?.name_en||'', category:p?.category||'Exclusive', price:instanceUnitPrice(inst), quantity:inst.qty, item_variant:selectionDisplay(p,inst,'en').map(x=>x.value).join(' / ') }; }), totals.totalPayable);
            state.beginCheckoutFired = true;
            if (window.SessionTracker) window.SessionTracker.setStage('checkout_started');
          }
        }
      });
    }, { threshold: 0.3 }).observe(paySection);
  }
}

/* ================================================================
   16. FIXED BUTTONS
   ================================================================ */
function initFixedButtons() {
  const fixedOrderNow = document.getElementById('krFixedOrderNow');
  const fixedConfirm  = document.getElementById('krFixedConfirm');
  const orderSection  = document.getElementById('kr-order-form');
  if (!orderSection) return;
  new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (fixedOrderNow) fixedOrderNow.classList.toggle('is-hidden',  e.isIntersecting);
      if (fixedConfirm)  fixedConfirm.classList.toggle('is-visible',  e.isIntersecting);
    });
  }, { threshold: 0.1 }).observe(orderSection);
}

/* ================================================================
   17. SIZE CHART
   ================================================================ */
function initSizeChart(){window._krOpenSizeChart=pid=>window.KRSizeGuide?.openForProduct(Number(pid));}
function openSizeChart(pid){window.KRSizeGuide?.openForProduct(Number(pid));}
function closeSizeChart(){window.KRSizeGuide?.close();}

/* ================================================================
   17b. HOW TO ORDER POPUP
   ================================================================ */
function initHowToOrder() {
  const btn     = document.getElementById('krHowToOrderBtn');
  const overlay = document.getElementById('krHowToOrderOverlay');
  const close   = document.getElementById('krHowToOrderClose');
  if (!btn || !overlay) return;
  btn.addEventListener('click', () => {
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  });
  if (close) close.addEventListener('click', () => {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  });
}

/* ================================================================
   18. FAQ
   ================================================================ */
function initFAQ() {
  document.querySelectorAll('.kr-faq-item').forEach(item => {
    const q = item.querySelector('.kr-faq-q');
    if (!q) return;
    q.addEventListener('click', () => toggleFAQ(item));
    q.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleFAQ(item); } });
  });
}

function toggleFAQ(item) {
  const isOpen = item.classList.contains('is-open');
  document.querySelectorAll('.kr-faq-item.is-open').forEach(i => i.classList.remove('is-open'));
  if (!isOpen) item.classList.add('is-open');
}

/* ================================================================
   19. SCROLL ANIMATIONS + COUNT-UP
   ================================================================ */
function initScrollAnimations() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.anim-fade-up').forEach(el => obs.observe(el));
}
function initCountUp() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el     = e.target;
      const target = parseInt(el.getAttribute('data-count'));
      const dur    = 1800;
      const start  = performance.now();
      obs.unobserve(el);
      function tick(now) { const p = Math.min((now - start) / dur, 1); el.textContent = Math.round((1 - Math.pow(1 - p, 3)) * target).toLocaleString(); if (p < 1) requestAnimationFrame(tick); else el.textContent = target.toLocaleString() + '+'; }
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(el => obs.observe(el));
}

/* ================================================================
   20. REVIEWS CAROUSEL (NEW BULLETPROOF LOGIC)
   ================================================================ */
function initReviewsCarousel() {
  const viewport = document.querySelector('.kr-reviews-viewport');
  const track = document.getElementById('krReviewsTrack');
  const prevBtn = document.getElementById('krReviewsPrev');
  const nextBtn = document.getElementById('krReviewsNext');
  const dotsContainer = document.getElementById('krReviewsDots');
  
  if (!viewport || !track) return;
  
  const cards = Array.from(track.querySelectorAll('.kr-review-card'));
  const cardCount = cards.length;
  if (cardCount === 0) return;
  
  let currentIndex = 0;
  let autoPlayTimer;
  
  // ১. ডট জেনারেট করা
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    cards.forEach((_, index) => {
      const dot = document.createElement('button');
      dot.className = `kr-reviews-dot ${index === 0 ? 'is-active' : ''}`;
      dot.setAttribute('type', 'button');
      dot.setAttribute('aria-label', `Go to review ${index + 1}`);
      
      dot.addEventListener('click', () => {
        goToCard(index);
        resetAutoPlay();
      });
      dotsContainer.appendChild(dot);
    });
  }
  const dots = Array.from(document.querySelectorAll('.kr-reviews-dot'));
  
  // ২. নির্দিষ্ট কার্ডে স্ক্রোল করা
  function goToCard(index) {
    if (index < 0 || index >= cardCount) return;
    const card = cards[index];
    
    // কার্ডকে ভিউপোর্টের ঠিক মাঝখানে আনার ম্যাথ
    const scrollLeft = card.offsetLeft - (viewport.clientWidth / 2) + (card.clientWidth / 2);
    
    viewport.scrollTo({
      left: scrollLeft,
      behavior: 'smooth'
    });
    
    updateActiveState(index);
  }
  
  // ৩. অ্যাক্টিভ স্টেট আপডেট করা
  function updateActiveState(index) {
    currentIndex = index;
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === index);
    });
  }
  
  // ৪. ডানে-বামে বাটন ক্লিক ইভেন্ট
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      const newIndex = currentIndex === 0 ? cardCount - 1 : currentIndex - 1;
      goToCard(newIndex);
      resetAutoPlay();
    });
  }
  
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const newIndex = currentIndex === cardCount - 1 ? 0 : currentIndex + 1;
      goToCard(newIndex);
      resetAutoPlay();
    });
  }
  
  // ৫. আঙুল দিয়ে সোয়াইপ করলে বা স্ক্রোল করলে ডট আপডেট হবে
  let scrollTimeout;
  viewport.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const viewportCenter = viewport.scrollLeft + (viewport.clientWidth / 2);
      let closestIndex = 0;
      let minDistance = Infinity;
      
      // কোন কার্ডটি স্ক্রিনের মাঝখানে আছে তা বের করা
      cards.forEach((card, index) => {
        const cardCenter = card.offsetLeft + (card.clientWidth / 2);
        const distance = Math.abs(viewportCenter - cardCenter);
        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = index;
        }
      });
      
      if (closestIndex !== currentIndex) {
        updateActiveState(closestIndex);
      }
    }, 50); // ছোট্ট ডিবাইন্স যাতে ব্রাউজারে প্রেশার না পড়ে
  }, { passive: true });
  
  // ৬. অটো-প্লে ফাংশন (৩ সেকেন্ড পর পর)
  function startAutoPlay() {
    autoPlayTimer = setInterval(() => {
      const nextIndex = currentIndex === cardCount - 1 ? 0 : currentIndex + 1;
      goToCard(nextIndex);
    }, 3000);
  }
  
  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
  }
  
  // ইউজার ইন্টারঅ্যাক্ট করলে অটো-প্লে সাময়িক বন্ধ রাখা
  viewport.addEventListener('mouseenter', () => clearInterval(autoPlayTimer));
  viewport.addEventListener('mouseleave', startAutoPlay);
  viewport.addEventListener('touchstart', () => clearInterval(autoPlayTimer), { passive: true });
  viewport.addEventListener('touchend', startAutoPlay);
  
  // প্রথমবার অটো-প্লে চালু করা
  startAutoPlay();
}

/* ================================================================
   21. SMOOTH SCROLL
   ================================================================ */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.getElementById(a.getAttribute('href').slice(1));
      if (!target) return; e.preventDefault();
      const navH      = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--navbar-h')) || 62;
      const announceH = document.getElementById('kr-announcement') ? (document.getElementById('kr-announcement').style.display === 'none' ? 0 : document.getElementById('kr-announcement').offsetHeight) : 0;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navH - announceH - 8, behavior: 'smooth' });
    });
  });
}

/* ================================================================
   INIT
   ================================================================ */
const spinStyle = document.createElement('style');
spinStyle.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
document.head.appendChild(spinStyle);

async function init() {
  if (window.KRProducts?.ready) await window.KRProducts.ready;
  initCheckoutInstances();
  initTheme();
  initLang();
  initAnnouncement();
  initNavbar();
  initIsland();
initSlowConnectionWatch();
  initHeroBanner();                  /* ✅ NEW: replaces initGallery + initHeroPopup */
  buildCarousel();
  initCarouselDrag();
  buildProductCards();
  initDistrict();
  initThanaDropdown();
  buildCheckoutProducts();

  const coList = document.getElementById('krCoList');
  if (coList && !coList.dataset.bound) {
    coList.addEventListener('click', handleCheckoutClick);
    coList.addEventListener('change', handleCheckoutChange);
    coList.dataset.bound = '1';
  }

  initPayment();
  initCoupon();
  initReferenceCheckoutUI();
  initSizeChart();
  initHowToOrder();
  initOrderForm();
  initFixedButtons();
  initFAQ();
  initScrollAnimations();
  initCountUp();
  initReviewsCarousel();
  initSmoothScroll();
  initLeadCapture();
  updateSummary();
  refreshWALink();
  
  if (window.lucide) lucide.createIcons();

  document.addEventListener('click', e => {
    const btn = e.target.closest('.kr-co-sizechart-btn');
    if (btn) { const pid=Number(btn.getAttribute('data-pid')); if(pid) openSizeChart(pid); }
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

})();