/* ================================================================
   KORA ROYAL — reviews.js  v2
   Customer Reviews Section — Frontend Engine

   Dependencies (load order in index.html):
   1. integrations.js
   2. api.js           ← KR_API.WORKER_URL available
   3. reviews.js       ← this file
   4. main.js

   Phase 1: LocalStorage simulation
   Phase 2: Real Worker API (switch KRREV.USE_API = true)
   ================================================================ */
'use strict';

/* HTML escape — used for any user-controlled text rendered via innerHTML */
function escR(v){return String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

/* ================================================================
   CONFIG
   ================================================================ */
/* reviews.js এর একদম উপরে CONFIG এ এই দুটো লাইন পরিবর্তন করুন */

const KRREV = {
  
  /* ✅ এইটা true করুন */
  USE_API: true,
  
  /* ✅ বাকি সব same থাকবে */
  WORKER_URL: window.KR_API ?
    window.KR_API.WORKER_URL :
    '',
  
  /* ... বাকি config অপরিবর্তিত */

  /* Auto-scroll interval ms */
  AUTO_INTERVAL: 4500,

  /* Polling interval ms (30s) */
  POLL_INTERVAL: 30_000,

  /* Image limits */
  AVATAR_MAX_MB:  2,
  PRODUCT_MAX_MB: 5,
  PRODUCT_MAX_COUNT: 3,

  /* Auto-show rule:
     rating >= this AND has image → show without approval */
  AUTO_SHOW_MIN_RATING: 4,

  /* LS keys */
  LS_REVIEWS:  'krv2_reviews',
  LS_LIKES:    'krv2_likes',
  LS_ANON:     'krv2_anon_counter',
  LS_PENDING:  'krv2_pending',

  /* Language helper */
  get lang() {
    return document.documentElement.getAttribute('data-lang') === 'bn' ? 'bn' : 'en';
  }
};

/* ================================================================
   STATE
   ================================================================ */
const KRState = {
  allReviews: [],        /* approved + auto-shown */
  filteredReviews: [],   /* after filter applied */
  priorityOrder: [],     /* admin-set priority ids */

  currentFilter: 'all',
  currentSlide: 0,
  cardWidth: 340,
  cardGap: 16,
  visibleCount: 3,
  totalSlides: 0,

  autoTimer: null,
  pollTimer: null,
  isUserActive: false,   /* hover/touch detected */
  userActiveTimer: null,

  isAnimating: false,
  selectedRating: 0,

  avatarFile: null,
  productFiles: [],      /* max 3 */

  likedSet: new Set(),   /* review ids liked by user */
  anonCounter: 0,
};

/* ================================================================
   DOM REFS
   ================================================================ */
const KREl = {
  section:       () => document.getElementById('kr-reviews-v2'),
  track:         () => document.getElementById('krv2Track'),
  viewport:      () => document.getElementById('krv2Viewport'),
  dots:          () => document.getElementById('krv2Dots'),
  prevBtn:       () => document.getElementById('krv2Prev'),
  nextBtn:       () => document.getElementById('krv2Next'),
  filters:       () => document.getElementById('krv2Filters'),
  avgNum:        () => document.getElementById('krv2AvgNum'),
  avgStars:      () => document.getElementById('krv2AvgStars'),
  avgCount:      () => document.getElementById('krv2AvgCount'),
  bars:          () => document.getElementById('krv2Bars'),
  writeBtn:      () => document.getElementById('krv2WriteBtn'),

  /* Modal */
  modal:         () => document.getElementById('krv2Modal'),
  modalOverlay:  () => document.getElementById('krv2ModalOverlay'),
  modalClose:    () => document.getElementById('krv2ModalClose'),
  form:          () => document.getElementById('krv2Form'),
  starInput:     () => document.getElementById('krv2StarInput'),
  ratingVal:     () => document.getElementById('krv2RatingVal'),
  textInput:     () => document.getElementById('krv2TextInput'),
  charCount:     () => document.getElementById('krv2CharCount'),
  nameInput:     () => document.getElementById('krv2NameInput'),
  avatarInput:   () => document.getElementById('krv2AvatarInput'),
  avatarZone:    () => document.getElementById('krv2AvatarZone'),
  avatarPreview: () => document.getElementById('krv2AvatarPreview'),
  productInput:  () => document.getElementById('krv2ProductInput'),
  productZone:   () => document.getElementById('krv2ProductZone'),
  productPreview:() => document.getElementById('krv2ProductPreview'),
  submitBtn:     () => document.getElementById('krv2SubmitBtn'),
  formSuccess:   () => document.getElementById('krv2FormSuccess'),
  cancelConfirm: () => document.getElementById('krv2CancelConfirm'),
  confirmYes:    () => document.getElementById('krv2ConfirmYes'),
  confirmNo:     () => document.getElementById('krv2ConfirmNo'),

  /* Lightbox */
  lightbox:      () => document.getElementById('krv2Lightbox'),
  lightboxImg:   () => document.getElementById('krv2LightboxImg'),
  lightboxClose: () => document.getElementById('krv2LightboxClose'),
};

/* ================================================================
   SEED DATA — Phase 1 এ দেখানোর জন্য (Phase 2 এ সরে যাবে)
   ================================================================ */
const SEED_REVIEWS = [
  {
    id: 'seed-1',
    rating: 5,
    text_en: 'The Kora Signature shirt is absolutely amazing! Premium fabric, perfect fit.',
    text_bn: 'করা সিগনেচার শার্টটি অসাধারণ! প্রিমিয়াম কাপড়, নিখুঁত ফিট।',
    name: 'Rahul Ahmed',
    location_en: 'Dhaka', location_bn: 'ঢাকা',
    avatar: 'https://randomuser.me/api/portraits/men/32.jpg',
    productImgs: [],
    likes: 12, status: 'approved', approvedBy: 'admin',
    date: '2025-01-15T10:00:00Z',
    priorityBoost: 10, verified: true,
  },
  {
    id: 'seed-2',
    rating: 5,
    text_en: 'Ordered the Kora Polo and Pants combo. Both delivered in 3 days! Quality is superb.',
    text_bn: 'করা পোলো এবং পেন্ট একসাথে অর্ডার করেছিলাম। ৩ দিনেই ডেলিভারি!',
    name: 'Sabbir Hossain',
    location_en: 'Chattogram', location_bn: 'চট্টগ্রাম',
    avatar: 'https://randomuser.me/api/portraits/men/45.jpg',
    productImgs: [],
    likes: 8, status: 'approved', approvedBy: 'admin',
    date: '2025-01-20T12:00:00Z',
    priorityBoost: 8, verified: true,
  },
  {
    id: 'seed-3',
    rating: 5,
    text_en: 'Best online shopping experience in Bangladesh. Smooth website, easy ordering.',
    text_bn: 'বাংলাদেশে এ পর্যন্ত সেরা অনলাইন শপিং অভিজ্ঞতা।',
    name: 'Nadia Islam',
    location_en: 'Sylhet', location_bn: 'সিলেট',
    avatar: 'https://randomuser.me/api/portraits/women/44.jpg',
    productImgs: [],
    likes: 19, status: 'approved', approvedBy: 'admin',
    date: '2025-02-01T09:00:00Z',
    priorityBoost: 9, verified: true,
  },
  {
    id: 'seed-4',
    rating: 5,
    text_en: 'Super impressed! Fast delivery, quality fabric. Definitely buying again.',
    text_bn: 'অসাধারণ! দ্রুত ডেলিভারি, মানসম্পন্ন কাপড়। আবারও কিনবো।',
    name: 'Karim Uddin',
    location_en: 'Rajshahi', location_bn: 'রাজশাহী',
    avatar: 'https://randomuser.me/api/portraits/men/67.jpg',
    productImgs: [],
    likes: 5, status: 'approved', approvedBy: 'admin',
    date: '2025-02-10T14:00:00Z',
    priorityBoost: 7, verified: true,
  },
  {
    id: 'seed-5',
    rating: 4,
    text_en: 'Excellent product! The fabric quality is top notch. My friends also loved it.',
    text_bn: 'চমৎকার পণ্য! কাপড়ের মান অনেক ভালো। বন্ধুরাও পছন্দ করেছে।',
    name: 'Farhan Haque',
    location_en: 'Khulna', location_bn: 'খুলনা',
    avatar: 'https://randomuser.me/api/portraits/men/22.jpg',
    productImgs: [],
    likes: 3, status: 'approved', approvedBy: 'admin',
    date: '2025-02-18T11:00:00Z',
    priorityBoost: 5, verified: true,
  },
];

/* ================================================================
   UTILITY HELPERS
   ================================================================ */

function t(enText, bnText) {
  return KRREV.lang === 'bn' ? bnText : enText;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const opts = { year: 'numeric', month: 'short', day: 'numeric' };
  return KRREV.lang === 'bn'
    ? d.toLocaleDateString('bn-BD', opts)
    : d.toLocaleDateString('en-GB', opts);
}

function calcPriorityScore(r) {
  /* System logic — invisible to user
     5★+img=100, 5★=80, 4★+img=60, 4★=40, 3★+img=20, 3★=10 */
  const hasImg = r.productImgs && r.productImgs.length > 0;
  const boost  = r.priorityBoost || 0;
  const map = {
    5: hasImg ? 100 : 80,
    4: hasImg ?  60 : 40,
    3: hasImg ?  20 : 10,
    2: hasImg ?   5 :  2,
    1:              1,
  };
  return (map[r.rating] || 0) + boost;
}

function sortByPriority(arr) {
  return [...arr].sort((a, b) =>
    calcPriorityScore(b) - calcPriorityScore(a)
  );
}

/* Anonymous counter */
function nextAnonNumber() {
  let n = parseInt(localStorage.getItem(KRREV.LS_ANON) || '0');
  n += 1;
  localStorage.setItem(KRREV.LS_ANON, String(n));
  return n;
}

/* Like persistence */
function loadLikes() {
  try {
    const raw = localStorage.getItem(KRREV.LS_LIKES);
    if (raw) {
      JSON.parse(raw).forEach(id => KRState.likedSet.add(id));
    }
  } catch (_) {}
}

function saveLikes() {
  localStorage.setItem(
    KRREV.LS_LIKES,
    JSON.stringify([...KRState.likedSet])
  );
}

/* SVG star */
function starSVG(filled, size = 14) {
  const fill = filled ? '#FFB800' : 'var(--border-medium)';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}"
          height="${size}" viewBox="0 0 24 24"
          fill="${fill}" stroke="none">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14
                     18.18 21.02 12 17.77 5.82 21.02
                     7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>`;
}

/* Responsive card count */
function getVisibleCount() {
  const w = window.innerWidth;
  if (w < 600) return 1;
  if (w < 960) return 2;
  return 3;
}

/* ================================================================
   DATA LAYER — Phase 1: LocalStorage / Phase 2: API
   ================================================================ */

/* reviews.js এ fetchApprovedReviews() ফাংশনটা
   এই নতুন version দিয়ে replace করুন */

async function fetchApprovedReviews() {
  if (KRREV.USE_API) {
    try {
      const filter = KRState.currentFilter || 'all';
      const res = await fetch(
        `${KRREV.WORKER_URL}/api/reviews?filter=${filter}&page=1`,
        {
          headers: { 'Content-Type': 'application/json' },
          /* Cache bypass */
          cache: 'no-store',
        }
      );
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      
      const json = await res.json();
      
      if (json.ok && Array.isArray(json.reviews)) {
        /* Production API empty হলে fake/seed review দেখানো হবে না */
        return json.reviews;
      }
      throw new Error(json.error || 'Unknown error');
      
    } catch (e) {
      console.warn('[reviews.js] Reviews API failed:', e.message);
      /* Production-এ API failure fake review দিয়ে ঢেকে রাখা হবে না */
      return [];
    }
  }
  
  /* USE_API: false → LocalStorage */
  try {
    const stored = JSON.parse(
      localStorage.getItem(KRREV.LS_REVIEWS) || '[]'
    );
    const ids = new Set(stored.map(r => r.id));
    const merged = [
      ...stored,
      ...SEED_REVIEWS.filter(s => !ids.has(s.id))
    ];
    return merged.filter(r =>
      r.status === 'approved' || r.status === 'auto'
    );
  } catch (_) {
    return SEED_REVIEWS;
  }
}

/* fetchStats() ফাংশনটা replace করুন */

async function fetchStats(reviews) {
  /* USE_API mode এ Worker থেকে real stats আনি */
  if (KRREV.USE_API) {
    try {
      const res  = await fetch(
        `${KRREV.WORKER_URL}/api/reviews/stats`,
        { cache: 'no-store' }
      );
      const json = await res.json();

      if (json.ok && json.total > 0) {
        return {
          avg:       json.avg,
          total:     json.total,
          breakdown: json.breakdown,
        };
      }
    } catch (e) {
      console.warn('[reviews.js] Stats API failed:', e.message);
    }
  }

  /* Fallback: reviews array থেকে calculate */
  if (!reviews || !reviews.length) {
    return { avg: '0.0', total: 0, breakdown: { 5:0, 4:0, 3:0, 2:0, 1:0 } };
  }

  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;

  reviews.forEach(r => {
    sum += r.rating;
    breakdown[r.rating] = (breakdown[r.rating] || 0) + 1;
  });

  return {
    avg:       (sum / reviews.length).toFixed(1),
    total:     reviews.length,
    breakdown,
  };
}

/* submitReviewAPI() ফাংশনটা replace করুন */

async function submitReviewAPI(payload) {
  if (KRREV.USE_API) {
    try {
      const res = await fetch(
        `${KRREV.WORKER_URL}/api/reviews/submit`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: payload.rating,
            text_en: payload.text_en,
            name: payload.name || null,
            avatar: payload.avatar || null,
            productImgs: payload.productImgs || [],
            lang: KRREV.lang,
          }),
        }
      );
      
      const json = await res.json();
      
      if (!res.ok || !json.ok) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      
      return json;
      
    } catch (e) {
      console.error('[reviews.js] submitReviewAPI error:', e);
      throw e; /* Form এ error দেখাবে */
    }
  }
  
  /* LocalStorage fallback */
  const existing = JSON.parse(
    localStorage.getItem(KRREV.LS_PENDING) || '[]'
  );
  existing.push(payload);
  localStorage.setItem(KRREV.LS_PENDING, JSON.stringify(existing));
  
  const autoShow =
    payload.rating >= KRREV.AUTO_SHOW_MIN_RATING &&
    (payload.productImgs?.length > 0 || payload.avatar);
  
  if (autoShow) {
    const stored = JSON.parse(
      localStorage.getItem(KRREV.LS_REVIEWS) || '[]'
    );
    stored.push({ ...payload, status: 'auto', verified: false });
    localStorage.setItem(KRREV.LS_REVIEWS, JSON.stringify(stored));
  }
  
  return { success: true, autoShown: autoShow };
} 

async function toggleLikeAPI(reviewId, action) {
  if (KRREV.USE_API) {
    await fetch(`${KRREV.WORKER_URL}/api/reviews/like`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: reviewId, action })
    });
    return;
  }

  /* LocalStorage */
  const stored = JSON.parse(
    localStorage.getItem(KRREV.LS_REVIEWS) || '[]'
  );
  const rev = stored.find(r => r.id === reviewId)
    || SEED_REVIEWS.find(r => r.id === reviewId);
  if (rev) {
    rev.likes = Math.max(0, (rev.likes || 0) + (action === 'like' ? 1 : -1));
    /* Only update if in stored (seeds aren't persisted) */
    const idx = stored.findIndex(r => r.id === reviewId);
    if (idx > -1) {
      stored[idx] = rev;
      localStorage.setItem(KRREV.LS_REVIEWS, JSON.stringify(stored));
    }
  }
}

/* ================================================================
   STATS RENDER
   ================================================================ */
function renderStats(stats) {
  const avgEl    = KREl.avgNum();
  const starsEl  = KREl.avgStars();
  const countEl  = KREl.avgCount();
  const barsEl   = KREl.bars();

  if (!avgEl) return;

  avgEl.textContent = stats.total ? stats.avg : '—';

  /* Stars */
  const avgN = parseFloat(stats.avg) || 0;
  starsEl.innerHTML = [1,2,3,4,5].map(i =>
    starSVG(i <= Math.round(avgN), 15)
  ).join('');

  /* Count */
  countEl.innerHTML = stats.total
    ? `<span data-en="${stats.total} reviews"
             data-bn="${stats.total} রিভিউ">
         ${stats.total} ${t('reviews','রিভিউ')}
       </span>`
    : `<span data-en="No reviews yet" data-bn="কোনো রিভিউ নেই">
         ${t('No reviews yet','কোনো রিভিউ নেই')}
       </span>`;

  /* Bars */
  if (!barsEl) return;
  barsEl.innerHTML = [5,4,3,2,1].map(n => {
    const count = stats.breakdown[n] || 0;
    const pct   = stats.total ? Math.round((count / stats.total) * 100) : 0;
    return `
      <div class="krv2-bar-row">
        <span class="krv2-bar-label">${n}</span>
        <div class="krv2-bar-track">
          <div class="krv2-bar-fill" data-target="${pct}"
               style="width:0%"></div>
        </div>
        <span class="krv2-bar-pct">${pct}%</span>
      </div>`;
  }).join('');

  /* Animate bars after paint */
  requestAnimationFrame(() => {
    barsEl.querySelectorAll('.krv2-bar-fill').forEach(el => {
      const target = el.getAttribute('data-target');
      requestAnimationFrame(() => {
        el.style.width = target + '%';
      });
    });
  });
}

/* ================================================================
   FILTER LOGIC
   ================================================================ */
function applyFilter(reviews, filter) {
  switch (filter) {
    case '5':      return reviews.filter(r => r.rating === 5);
    case '4':      return reviews.filter(r => r.rating === 4);
    case '3':      return reviews.filter(r => r.rating === 3);
    case 'lowest': return reviews.filter(r => r.rating <= 2);
    case 'images': return reviews.filter(
      r => r.productImgs && r.productImgs.length > 0
    );
    default:       return reviews;
  }
}

/* Priority sort + optional shuffle for "all" filter */
function applyDisplayOrder(reviews, filter) {
  const sorted = sortByPriority(reviews);

  if (filter !== 'all') return sorted;

  /* Shuffle slightly — keep top 3 in place, shuffle rest */
  const top  = sorted.slice(0, 3);
  const rest = sorted.slice(3);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [...top, ...rest];
}

/* "Priority-only" subset for auto-scroll */
function getPrioritySubset(reviews) {
  return sortByPriority(reviews).slice(
    0, Math.min(6, reviews.length)
  );
}

/* ================================================================
   CARD BUILDER
   ================================================================ */
function buildCard(r) {
  const lang     = KRREV.lang;
  const text     = lang === 'bn' ? (r.text_bn || r.text_en) : r.text_en;
  const name     = r.name || `Anonymous_${String(r.anonNum || '').padStart(3,'0')}`;
  const location = lang === 'bn' ? (r.location_bn || '') : (r.location_en || '');
  const dateStr  = formatDate(r.date);
  const liked    = KRState.likedSet.has(r.id);

  /* Badge type */
  let badgeHTML = '';
  let nameExtraHTML = '';
  if (r.status === 'approved' && r.verified) {
    badgeHTML = `<span class="krv2-status-badge verified" title="${t('Verified Buyer','যাচাইকৃত ক্রেতা')}">
      <svg width="8" height="8" viewBox="0 0 24 24"
           fill="none" stroke="#fff" stroke-width="3.5"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </span>`;
    nameExtraHTML = `<span class="krv2-verified-inline" title="${t('Verified','যাচাইকৃত')}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#1DA1F2" stroke="none">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="9 12 11 14 15 10" stroke="#fff"
                  stroke-width="2.5" stroke-linecap="round"
                  stroke-linejoin="round" fill="none"/>
      </svg>
    </span>`;
  } else if (r.status === 'auto') {
    badgeHTML = `<span class="krv2-status-badge auto"
      title="${t('Pending Verification','যাচাই বাকি')}">
      <svg width="8" height="8" viewBox="0 0 24 24"
           fill="none" stroke="var(--brand-black)" stroke-width="3"
           stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="9"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </span>`;
    nameExtraHTML = `<span class="krv2-pending-pill">
      ${t('Pending','পেন্ডিং')}
    </span>`;
  }

  /* Avatar */
  let avatarHTML = '';
  if (r.avatar) {
      avatarHTML = `<img class="krv2-avatar" src="${escR(r.avatar)}"
                       alt="${escR(name)}" loading="lazy" onerror="krImgRetry(this)">`;
  } else {
    const initial = escR(name.charAt(0).toUpperCase());
    avatarHTML = `<div class="krv2-avatar-initial">${initial}</div>`;
  }

  /* Stars */
  const starsHTML = [1,2,3,4,5].map(i =>
    `<svg class="krv2-star${i <= r.rating ? '' : ' empty'}"
          xmlns="http://www.w3.org/2000/svg" width="15" height="15"
          viewBox="0 0 24 24"
          fill="${i <= r.rating ? '#FFB800' : 'var(--border-medium)'}"
          stroke="none">
       <polygon points="12 2 15.09 8.26 22 9.27 17 14.14
                        18.18 21.02 12 17.77 5.82 21.02
                        7 14.14 2 9.27 8.91 8.26 12 2"/>
     </svg>`
  ).join('');

  /* Product images */
  let imgsHTML = '';
  if (r.productImgs && r.productImgs.length > 0) {
    imgsHTML = `<div class="krv2-images">
      ${r.productImgs.slice(0,3).map(src =>
          `<img class="krv2-img-thumb" src="${escR(src)}" alt="product"
              loading="lazy" onerror="krImgRetry(this)" onclick="KRReviews.openLightbox('${escR(src)}')">`
      ).join('')}
    </div>`;
  }

  /* Text truncation */
  const shortText = text.length > 120;

  const score = calcPriorityScore(r);

  return `
<div class="krv2-card" data-id="${r.id}" data-rating="${r.rating}"
     data-priority="${score}" data-status="${r.status}">

  <div class="krv2-card-header">
    <div class="krv2-user-row">
      <div class="krv2-avatar-wrap">
        ${avatarHTML}
        ${badgeHTML}
      </div>
      <div class="krv2-user-info">
        <span class="krv2-user-name">
          ${escR(name)}
          ${nameExtraHTML}
        </span>
        ${location ? `
        <span class="krv2-user-location">
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${escR(location)}
        </span>` : ''}
      </div>
    </div>
    <div class="krv2-card-rating">
      <div class="krv2-stars">${starsHTML}</div>
      <span class="krv2-rating-num">${r.rating}.0</span>
    </div>
  </div>

  <div class="krv2-card-body">
    <p class="krv2-review-text${shortText ? ' collapsed' : ''}"
       id="krv2-txt-${r.id}">
      ${escR(text)}
    </p>
    ${shortText ? `
    <button class="krv2-read-more" onclick="KRReviews.toggleText('${r.id}', this)">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12"
           viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      <span>${t('Read more','আরো পড়ুন')}</span>
    </button>` : ''}
    ${imgsHTML}
  </div>

  <div class="krv2-card-footer">
    <div class="krv2-card-meta">
      ${dateStr ? `
      <span class="krv2-date">
        <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        ${dateStr}
      </span>` : ''}
    </div>
    <button class="krv2-like-btn${liked ? ' liked' : ''}"
            id="krv2-like-${r.id}"
            onclick="KRReviews.toggleLike('${r.id}', this)">
      <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13"
           viewBox="0 0 24 24"
           fill="${liked ? 'currentColor' : 'none'}"
           stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2
                 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z"/>
        <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
      </svg>
      <span class="krv2-like-count">${r.likes || 0}</span>
    </button>
  </div>

  <!-- Quote deco -->
  <div class="krv2-quote-deco" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36"
         viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4
               c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2
               1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031
               V20c0 1 0 1 1 1z"/>
      <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4
               c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75
               c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
    </svg>
  </div>

</div>`;
}

/* ================================================================
   RENDER ENGINE
   ================================================================ */
function renderCards(reviews) {
  const track = KREl.track();
  if (!track) return;

  if (!reviews.length) {
    track.innerHTML = `
      <div style="flex:0 0 100%;text-align:center;
                  padding:var(--sp-12);color:var(--text-muted)">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"
             style="margin:0 auto var(--sp-4);display:block;opacity:0.4">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0
                   0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>${t('No reviews found','কোনো রিভিউ পাওয়া যায়নি')}</p>
      </div>`;
    return;
  }

  track.innerHTML = reviews.map(r => buildCard(r)).join('');
  updateSliderDimensions();
}

/* ================================================================
   SLIDER ENGINE
   ================================================================ */
function updateSliderDimensions() {
  KRState.visibleCount = getVisibleCount();
  const card = KREl.track()?.querySelector('.krv2-card');
  if (!card) return;

  const style = getComputedStyle(card);
  KRState.cardWidth = card.offsetWidth;
  KRState.cardGap   = parseInt(
    getComputedStyle(KREl.track()).gap || '16'
  );

  KRState.totalSlides = Math.max(
    0,
    KRState.filteredReviews.length - KRState.visibleCount
  );

  buildDots();
  goToSlide(0, false);
}

function goToSlide(index, animate = true) {
  const track = KREl.track();
  if (!track) return;

  index = Math.max(0, Math.min(index, KRState.totalSlides));
  KRState.currentSlide = index;

  const offset = index * (KRState.cardWidth + KRState.cardGap);
  track.style.transition = animate
    ? 'transform 0.5s cubic-bezier(0.4,0,0.2,1)'
    : 'none';
  track.style.transform = `translateX(-${offset}px)`;

  updateDots();
  updateNavBtns();
}

function buildDots() {
  const dotsEl = KREl.dots();
  if (!dotsEl) return;

  const count = KRState.totalSlides + 1;
  dotsEl.innerHTML = Array.from({ length: count }, (_, i) =>
    `<button class="krv2-dot${i === 0 ? ' active' : ''}"
             aria-label="Slide ${i+1}"
             onclick="KRReviews.goToSlidePublic(${i})"></button>`
  ).join('');
}

function updateDots() {
  const dotsEl = KREl.dots();
  if (!dotsEl) return;
  dotsEl.querySelectorAll('.krv2-dot').forEach((d, i) => {
    d.classList.toggle('active', i === KRState.currentSlide);
  });
}

function updateNavBtns() {
  const prev = KREl.prevBtn();
  const next = KREl.nextBtn();
  if (prev) prev.disabled = KRState.currentSlide <= 0;
  if (next) next.disabled = KRState.currentSlide >= KRState.totalSlides;
}

/* ================================================================
   AUTO SCROLL
   ================================================================ */
function startAutoScroll() {
  stopAutoScroll();

  /* Only scroll priority subset when user not active */
  const subset = getPrioritySubset(KRState.allReviews);
  const maxIdx = Math.max(0, subset.length - KRState.visibleCount);

  KRState.autoTimer = setInterval(() => {
    if (KRState.isUserActive) return;

    let next = KRState.currentSlide + 1;
    if (next > maxIdx) next = 0;
    goToSlide(next);
  }, KRREV.AUTO_INTERVAL);
}

function stopAutoScroll() {
  clearInterval(KRState.autoTimer);
  KRState.autoTimer = null;
}

function setUserActive() {
  KRState.isUserActive = true;
  clearTimeout(KRState.userActiveTimer);
  KRState.userActiveTimer = setTimeout(() => {
    KRState.isUserActive = false;
  }, 8000);
}

/* ================================================================
   POLLING
   ================================================================ */
function startPolling() {
  KRState.pollTimer = setInterval(async () => {
    await loadAndRender();
  }, KRREV.POLL_INTERVAL);
}

/* ================================================================
   TOUCH / DRAG
   ================================================================ */
function initDragSwipe() {
  const vp = KREl.viewport();
  if (!vp) return;

  let startX = 0;
  let isDragging = false;

  /* Touch */
  vp.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    isDragging = true;
    setUserActive();
  }, { passive: true });

  vp.addEventListener('touchend', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? slideNext() : slidePrev();
    }
  });

  /* Mouse drag */
  vp.addEventListener('mousedown', e => {
    startX = e.clientX;
    isDragging = true;
    setUserActive();
  });

  window.addEventListener('mouseup', e => {
    if (!isDragging) return;
    isDragging = false;
    const diff = startX - e.clientX;
    if (Math.abs(diff) > 40) {
      diff > 0 ? slideNext() : slidePrev();
    }
  });

  /* Hover pause */
  vp.addEventListener('mouseenter', setUserActive);
  vp.addEventListener('mouseleave', () => {
    KRState.isUserActive = false;
  });
}

function slideNext() {
  if (KRState.currentSlide < KRState.totalSlides) {
    goToSlide(KRState.currentSlide + 1);
  } else {
    goToSlide(0); /* loop */
  }
}

function slidePrev() {
  if (KRState.currentSlide > 0) {
    goToSlide(KRState.currentSlide - 1);
  } else {
    goToSlide(KRState.totalSlides);
  }
}

/* ================================================================
   FILTER BUTTON EVENTS
   ================================================================ */
function initFilters() {
  const filtersEl = KREl.filters();
  if (!filtersEl) return;

  filtersEl.addEventListener('click', e => {
    const btn = e.target.closest('.krv2-filter-btn');
    if (!btn) return;

    filtersEl.querySelectorAll('.krv2-filter-btn').forEach(b =>
      b.classList.remove('active')
    );
    btn.classList.add('active');

    KRState.currentFilter = btn.dataset.filter;
    KRState.isUserActive  = true;

    const filtered = applyFilter(KRState.allReviews, KRState.currentFilter);
    KRState.filteredReviews = applyDisplayOrder(filtered, KRState.currentFilter);
    renderCards(KRState.filteredReviews);
    updateSliderDimensions();
  });
}

/* ================================================================
   LIKE TOGGLE (public — called from card HTML)
   ================================================================ */
async function toggleLike(reviewId, btn) {
  const isLiked = KRState.likedSet.has(reviewId);
  const action  = isLiked ? 'unlike' : 'like';

  /* Optimistic UI */
  const countEl = btn.querySelector('.krv2-like-count');
  const current = parseInt(countEl?.textContent || '0');
  btn.classList.toggle('liked', !isLiked);
  const svgPath = btn.querySelector('svg');
  if (svgPath) {
    svgPath.setAttribute('fill', !isLiked ? 'currentColor' : 'none');
  }
  if (countEl) {
    countEl.textContent = String(current + (isLiked ? -1 : 1));
  }

  if (isLiked) {
    KRState.likedSet.delete(reviewId);
  } else {
    KRState.likedSet.add(reviewId);
  }
  saveLikes();

  /* API call (fire & forget) */
  try {
    await toggleLikeAPI(reviewId, action);
  } catch (_) {}
}

/* ================================================================
   READ MORE TOGGLE (public)
   ================================================================ */
function toggleText(reviewId, btn) {
  const p = document.getElementById(`krv2-txt-${reviewId}`);
  if (!p) return;
  const collapsed = p.classList.toggle('collapsed');
  const svg = btn.querySelector('svg');
  const label = btn.querySelector('span');
  if (label) {
    label.textContent = collapsed
      ? t('Read more', 'আরো পড়ুন')
      : t('Show less', 'কম দেখুন');
  }
  if (svg) {
    svg.style.transform = collapsed ? '' : 'rotate(180deg)';
  }
}

/* ================================================================
   LIGHTBOX (public)
   ================================================================ */
function openLightbox(src) {
  const lb  = KREl.lightbox();
  const img = KREl.lightboxImg();
  if (!lb || !img) return;
  img.src = src;
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  const lb = KREl.lightbox();
  if (lb) lb.classList.remove('open');
  document.body.style.overflow = '';
}

/* ================================================================
   MODAL — OPEN / CLOSE
   ================================================================ */
function openModal() {
  const m = KREl.modal();
  if (!m) return;
  m.classList.add('open');
  document.body.style.overflow = 'hidden';
  KREl.textInput()?.focus();
}

function tryCloseModal() {
  /* Show cancel confirm if form has data */
  const hasRating = KRState.selectedRating > 0;
  const hasText   = (KREl.textInput()?.value || '').trim().length > 0;

  if (hasRating || hasText) {
    KREl.cancelConfirm()?.classList.add('show');
  } else {
    closeModal();
  }
}

function closeModal() {
  const m = KREl.modal();
  if (!m) return;
  m.classList.remove('open');
  document.body.style.overflow = '';
  resetForm();
}

function resetForm() {
  KREl.form()?.reset();
  KRState.selectedRating = 0;
  KRState.avatarFile     = null;
  KRState.productFiles   = [];
  if (KREl.ratingVal()) KREl.ratingVal().value = '0';
  KREl.starInput()?.querySelectorAll('.krv2-star-pick')
      .forEach(s => s.classList.remove('on'));
  KREl.avatarPreview().innerHTML  = '';
  KREl.productPreview().innerHTML = '';
  KREl.charCount().textContent    = '0 / 500';
  KREl.charCount().classList.remove('warn');
  KREl.cancelConfirm()?.classList.remove('show');
  KREl.formSuccess()?.classList.remove('show');
  if (KREl.form()) KREl.form().style.display = '';
}

/* ================================================================
   STAR INPUT
   ================================================================ */
function initStarInput() {
  const stars = KREl.starInput()?.querySelectorAll('.krv2-star-pick');
  if (!stars) return;

  stars.forEach((star, idx) => {
    star.addEventListener('mouseenter', () => highlightStars(idx + 1, stars));
    star.addEventListener('mouseleave', () => highlightStars(KRState.selectedRating, stars));
    star.addEventListener('click', () => {
      KRState.selectedRating = idx + 1;
      if (KREl.ratingVal()) KREl.ratingVal().value = String(idx + 1);
      highlightStars(idx + 1, stars);
    });
    star.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        KRState.selectedRating = idx + 1;
        if (KREl.ratingVal()) KREl.ratingVal().value = String(idx + 1);
        highlightStars(idx + 1, stars);
      }
    });
  });
}

function highlightStars(count, stars) {
  stars.forEach((s, i) => s.classList.toggle('on', i < count));
}

/* ================================================================
   IMAGE UPLOAD
   ================================================================ */
function initImageUpload() {
  /* Avatar */
  const avatarInput = KREl.avatarInput();
  const avatarZone  = KREl.avatarZone();

  if (avatarInput) {
    avatarInput.addEventListener('change', () => {
      const file = avatarInput.files?.[0];
      if (!file) return;
      if (!validateImageFile(file, KRREV.AVATAR_MAX_MB, 1)) return;
      KRState.avatarFile = file;
      renderPreview([file], KREl.avatarPreview(), 'avatar');
    });
  }

  if (avatarZone) {
    setupDragDrop(avatarZone, (files) => {
      const file = files[0];
      if (!file) return;
      if (!validateImageFile(file, KRREV.AVATAR_MAX_MB, 1)) return;
      KRState.avatarFile = file;
      renderPreview([file], KREl.avatarPreview(), 'avatar');
    });
  }

  /* Product */
  const productInput = KREl.productInput();
  const productZone  = KREl.productZone();

  if (productInput) {
    productInput.addEventListener('change', () => {
      const files = [...(productInput.files || [])];
      if (!files.length) return;
      addProductFiles(files);
    });
  }

  if (productZone) {
    setupDragDrop(productZone, (files) => {
      addProductFiles([...files]);
    });
  }
}

function addProductFiles(files) {
  const remaining = KRREV.PRODUCT_MAX_COUNT - KRState.productFiles.length;
  if (remaining <= 0) {
    showToast(t('Max 3 product images allowed','সর্বোচ্চ ৩টি পণ্য ছবি'), 'warn');
    return;
  }
  const toAdd = files.slice(0, remaining);
  const valid = toAdd.filter(f =>
    validateImageFile(f, KRREV.PRODUCT_MAX_MB, KRREV.PRODUCT_MAX_COUNT)
  );
  KRState.productFiles = [...KRState.productFiles, ...valid];
  renderPreview(KRState.productFiles, KREl.productPreview(), 'product');
}

function validateImageFile(file, maxMB, _maxCount) {
  const allowed = ['image/jpeg','image/png','image/webp'];
  if (!allowed.includes(file.type)) {
    showToast(t('Only JPG/PNG/WEBP allowed','শুধু JPG/PNG/WEBP অনুমোদিত'), 'error');
    return false;
  }
  if (file.size > maxMB * 1024 * 1024) {
    showToast(
      t(`File too large (max ${maxMB}MB)`,`ফাইল অনেক বড় (সর্বোচ্চ ${maxMB}MB)`),
      'error'
    );
    return false;
  }
  return true;
}

function renderPreview(files, container, type) {
  if (!container) return;
  container.innerHTML = files.map((file, idx) => {
    const url = URL.createObjectURL(file);
    return `
      <div class="krv2-preview-item">
        <img src="${url}" alt="preview">
        <button class="krv2-preview-remove" type="button"
                onclick="KRReviews.removeFile('${type}', ${idx})">
          <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>`;
  }).join('');
}

function removeFile(type, idx) {
  if (type === 'avatar') {
    KRState.avatarFile = null;
    KREl.avatarPreview().innerHTML = '';
    if (KREl.avatarInput()) KREl.avatarInput().value = '';
  } else {
    KRState.productFiles.splice(idx, 1);
    renderPreview(KRState.productFiles, KREl.productPreview(), 'product');
  }
}

function setupDragDrop(zone, callback) {
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    callback(e.dataTransfer.files);
  });
}

/* ================================================================
   FORM SUBMIT
   ================================================================ */
function initFormSubmit() {
  KREl.form()?.addEventListener('submit', async (e) => {
    e.preventDefault();

    /* Validate */
    if (!KRState.selectedRating) {
      showToast(
        t('Please select a rating','অনুগ্রহ করে রেটিং দিন'),
        'error'
      );
      return;
    }

    const text = (KREl.textInput()?.value || '').trim();
    if (text.length < 10) {
      showToast(
        t('Review must be at least 10 characters',
          'রিভিউ কমপক্ষে ১০ অক্ষর হতে হবে'),
        'error'
      );
      return;
    }

    /* Build payload */
    const rawName = (KREl.nameInput()?.value || '').trim();
    const anonNum = rawName ? null : nextAnonNumber();
    const name    = rawName || null;

    /* Convert images to base64 for LS storage */
    let avatarB64    = null;
    let productB64s  = [];

    if (KRState.avatarFile) {
      avatarB64 = await fileToBase64(KRState.avatarFile, 400, 0.85);   /* ছোট avatar */
    }
    for (const f of KRState.productFiles) {
      productB64s.push(await fileToBase64(f, 1200, 0.82));            /* max 1200px, ~82% jpeg */
    }

    const payload = {
      id:          `usr-${Date.now()}`,
      rating:      KRState.selectedRating,
      text_en:     text,
      text_bn:     text, /* user submits one lang */
      name:        name,
      anonNum:     anonNum,
      location_en: '',
      location_bn: '',
      avatar:      avatarB64,
      productImgs: productB64s,
      likes:       0,
      status:      'pending',
      verified:    false,
      date:        new Date().toISOString(),
      priorityBoost: 0,
      approvedBy:  null,
    };

    /* Submit loading */
    const btn = KREl.submitBtn();
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
             viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
             style="animation:krv2spin 0.8s linear infinite">
          <line x1="12" y1="2" x2="12" y2="6"/>
          <line x1="12" y1="18" x2="12" y2="22"/>
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
          <line x1="2" y1="12" x2="6" y2="12"/>
          <line x1="18" y1="12" x2="22" y2="12"/>
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
        </svg>
        ${t('Submitting...','জমা হচ্ছে...')}`;
    }

    try {
      const result = await submitReviewAPI(payload);
      /* Show success */
      if (KREl.form()) KREl.form().style.display = 'none';
      KREl.formSuccess()?.classList.add('show');

      /* Auto close modal after 2.5s */
      setTimeout(() => {
        closeModal();
        /* Refresh reviews */
        loadAndRender();
      }, 2500);

    } catch (err) {
      showToast(
        t('Failed to submit. Please try again.',
          'জমা দেওয়া যায়নি। আবার চেষ্টা করুন।'),
        'error'
      );
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"
               viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          ${t('Submit Review','রিভিউ জমা দিন')}`;
      }
    }
  });
}

/* Client-side AUTO-OPTIMIZATION — ফোনের 5MB ছবি আপলোডের আগেই
   canvas-এ resize + JPEG re-encode হয়ে ~100-300KB হয়ে যায়।
   (Worker-এ Cloudinary আবার f_auto/q_auto দিয়ে serve করে।) */
function fileToBase64(file, maxEdge = 1200, quality = 0.82) {
  return new Promise((resolve) => {
    const fallback = () => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    try {
      if (!file || !/^image\//.test(file.type)) return fallback();
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxEdge / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || 1) * scale));
          const h = Math.max(1, Math.round((img.height || 1) * scale));
          const cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          URL.revokeObjectURL(img.src);
          const out = cv.toDataURL('image/jpeg', quality);
          resolve(out && out.length > 24 ? out : null);
        } catch (_) { fallback(); }
      };
      img.onerror = fallback;
      img.src = URL.createObjectURL(file);
    } catch (_) { fallback(); }
  });
}

/* ================================================================
   CHAR COUNTER
   ================================================================ */
function initCharCounter() {
  KREl.textInput()?.addEventListener('input', () => {
    const len = (KREl.textInput()?.value || '').length;
    const el  = KREl.charCount();
    if (!el) return;
    el.textContent = `${len} / 500`;
    el.classList.toggle('warn', len > 450);
  });
}

/* ================================================================
   TOAST
   ================================================================ */
function showToast(msg, type = 'info') {
  document.querySelectorAll('.krv2-toast').forEach(t => t.remove());

  const colors = {
    info:  { bg: 'var(--brand-black)', icon: 'ℹ' },
    error: { bg: '#EF4444', icon: '!' },
    warn:  { bg: '#F59E0B', icon: '!' },
    ok:    { bg: '#16A34A', icon: '✓' },
  };
  const c = colors[type] || colors.info;

  const el = document.createElement('div');
  el.className = 'krv2-toast';
  el.setAttribute('role', 'alert');
  el.style.cssText = `
    position:fixed; bottom:24px; right:24px; z-index:99999;
    background:${c.bg}; color:#fff;
    padding:12px 18px; border-radius:var(--radius-md);
    font-family:var(--font-body); font-size:var(--text-sm);
    box-shadow:var(--shadow-lg); display:flex;
    align-items:center; gap:8px; max-width:320px;
    transform:translateY(20px); opacity:0;
    transition:all 0.3s cubic-bezier(0.34,1.56,0.64,1)`;
  el.textContent = msg;

  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.style.transform = 'translateY(0)';
    el.style.opacity   = '1';
  });

  setTimeout(() => {
    el.style.transform = 'translateY(20px)';
    el.style.opacity   = '0';
    setTimeout(() => el.remove(), 350);
  }, 3500);
}

/* ================================================================
   SCROLL REVEAL
   ================================================================ */
function initScrollReveal() {
  const els = document.querySelectorAll('.krv2-reveal');
  if (!els.length) return;

  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('in-view');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => obs.observe(el));
}

/* ================================================================
   MAIN LOAD & RENDER
   ================================================================ */
async function loadAndRender() {
  const reviews = await fetchApprovedReviews();
  KRState.allReviews = reviews;

  const stats    = await fetchStats(reviews);
  renderStats(stats);

  const filtered = applyFilter(reviews, KRState.currentFilter);
  KRState.filteredReviews = applyDisplayOrder(filtered, KRState.currentFilter);
  renderCards(KRState.filteredReviews);

  updateSliderDimensions();
  startAutoScroll();
}

/* ================================================================
   KEYBOARD NAV
   ================================================================ */
function initKeyboard() {
  document.addEventListener('keydown', e => {
    /* Modal close */
    if (e.key === 'Escape') {
      const modal     = KREl.modal();
      const lightbox  = KREl.lightbox();
      const confirm   = KREl.cancelConfirm();

      if (confirm?.classList.contains('show')) {
        confirm.classList.remove('show');
        return;
      }
      if (lightbox?.classList.contains('open')) {
        closeLightbox();
        return;
      }
      if (modal?.classList.contains('open')) {
        tryCloseModal();
        return;
      }
    }

    /* Slider arrow keys (when section visible) */
    const section = document.getElementById('kr-reviews-v2');
    if (!section) return;
    const r = section.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      if (e.key === 'ArrowLeft')  { slidePrev(); setUserActive(); }
      if (e.key === 'ArrowRight') { slideNext(); setUserActive(); }
    }
  });
}

/* ================================================================
   BILINGUAL TEXT SYNC
   ================================================================ */
function syncLang() {
  const lang = KRREV.lang;
  document.querySelectorAll('[data-en][data-bn]').forEach(el => {
    el.textContent = el.getAttribute(`data-${lang}`) || el.textContent;
  });
  document.querySelectorAll('[data-placeholder-en]').forEach(el => {
    el.placeholder = el.getAttribute(`data-placeholder-${lang}`) || '';
  });
}

/* ================================================================
   INIT
   ================================================================ */
async function init() {
  loadLikes();

  /* Nav buttons */
  KREl.prevBtn()?.addEventListener('click', () => {
    slidePrev(); setUserActive();
  });
  KREl.nextBtn()?.addEventListener('click', () => {
    slideNext(); setUserActive();
  });

  /* Write button */
  KREl.writeBtn()?.addEventListener('click', openModal);

  /* Modal close */
  KREl.modalClose()?.addEventListener('click', tryCloseModal);
  KREl.modalOverlay()?.addEventListener('click', tryCloseModal);

  /* Cancel confirm */
  KREl.confirmYes()?.addEventListener('click', closeModal);
  KREl.confirmNo()?.addEventListener('click', () => {
    KREl.cancelConfirm()?.classList.remove('show');
  });

  /* Lightbox */
  KREl.lightboxClose()?.addEventListener('click', closeLightbox);
  KREl.lightbox()?.addEventListener('click', e => {
    if (e.target === KREl.lightbox()) closeLightbox();
  });

  /* Window resize */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      updateSliderDimensions();
    }, 300);
  });

  initFilters();
  initStarInput();
  initImageUpload();
  initFormSubmit();
  initCharCounter();
  initDragSwipe();
  initKeyboard();
  initScrollReveal();
  syncLang();

  /* Load data */
  await loadAndRender();

  /* Start polling */
  startPolling();
}

/* CSS for spinner (injected once) */
(function injectSpinCSS() {
  if (document.getElementById('krv2-spin-style')) return;
  const s = document.createElement('style');
  s.id = 'krv2-spin-style';
  s.textContent = '@keyframes krv2spin{to{transform:rotate(360deg)}}';
  document.head.appendChild(s);
})();

/* ================================================================
   PUBLIC API — window.KRReviews
   (called from inline onclick in card HTML)
   ================================================================ */
window.KRReviews = {
  toggleLike,
  toggleText,
  openLightbox,
  removeFile,
  goToSlidePublic: (idx) => { goToSlide(idx); setUserActive(); },
};

/* ================================================================
   BOOT — DOMContentLoaded
   ================================================================ */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}