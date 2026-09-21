/* ================================================================
   KORA ROYAL — Backend Catalog Bridge v1
   Safe rollout: if D1/catalog is unavailable, existing KR.PRODUCTS remains.
   ================================================================ */
(function () {
  'use strict';

  const API_BASE = window.KR_API?.WORKER_URL || '';
  const originalProducts = window.KR?.PRODUCTS ? { ...window.KR.PRODUCTS } : {};
  const originalGallery = Array.isArray(window.KR?.GALLERY_IMAGES) ? [...window.KR.GALLERY_IMAGES] : [];
  const fallbackHeroSlides = [
    {id:1,imageUrl:'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779260556/Puma_Firefly_ylasp7.webp',lines_en:['Crafted For','BOLD','Simplicity—'],lines_bn:['তৈরি','সাহসী','সরলতার জন্য—'],priority:1,status:'active'},
    {id:2,imageUrl:'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779260556/Puma_1779256219340-019e43ee-653f-75d1-8245-feb189cd5a34_gt2anj.webp',lines_en:['Redefine','Your','Style—'],lines_bn:['নতুনভাবে','আপনার','স্টাইল—'],priority:2,status:'active'},
    {id:3,imageUrl:'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779260556/Puma_1779259198114-019e441b-98d6-78e6-bce6-6dab15cb5d09_ml3zrm.webp',lines_en:['Wear What','Feels','REAL—'],lines_bn:['পরুন যা','মনে হয়','আসল—'],priority:3,status:'active'}
  ];
  const VISITOR_KEY = 'kr_product_visitor_v1';
  const LIKES_KEY = 'kr_product_likes_v1';
  const SESSION_MAX_AGE = 12 * 60 * 60 * 1000;

  const state = {
    source: 'fallback',
    version: 0,
    settings: { showcaseLayoutMode: 'auto', showcaseMaxPerRow: 10, soldDelayHours: 24 },
    products: originalProducts,
    heroSlides: fallbackHeroSlides,
    sizeChartTemplates: [],
    liked: loadLiked(),
    pageSessionId: makeId('page'),
    pageSessionStartedAt: Date.now(),
    cartSequence: 0,
    lastViewAt: new Map(),
    error: null
  };

  function makeId(prefix) {
    const id = crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `${prefix}-${id}`;
  }

  function visitorId() {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id || id.length < 12) {
      id = makeId('visitor');
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  }

  function loadLiked() {
    try { return new Set(JSON.parse(localStorage.getItem(LIKES_KEY) || '[]').map(String)); }
    catch { return new Set(); }
  }
  function saveLiked() {
    localStorage.setItem(LIKES_KEY, JSON.stringify([...state.liked]));
  }

  function safeArray(value) { return Array.isArray(value) ? value : []; }
  function normalizeHeroSlide(raw) {
    return {
      id:Number(raw.id), internalName:raw.internalName||'', imageUrl:raw.imageUrl||'',
      lines_en:safeArray(raw.lines_en).slice(0,3).map(String),
      lines_bn:safeArray(raw.lines_bn).slice(0,3).map(String),
      status:raw.status||'active', priority:Number(raw.priority||100)
    };
  }

  function normalizeSizeTemplate(raw) {
    const d = raw?.diagram && typeof raw.diagram === 'object' ? raw.diagram : null;
    let diagram = null;
    if (d && d.available && d.url) {
      let url = String(d.url || '');
      if (url.startsWith('/') && API_BASE) url = `${API_BASE}${url}`;
      diagram = {
        available: true,
        url,
        alt_en: String(d.alt_en || ''), alt_bn: String(d.alt_bn || ''),
        viewBox: String(d.viewBox || '0 0 1200 675'),
        aspectRatio: String(d.aspectRatio || '16/9'),
        position: d.position === 'after_table' ? 'after_table' : 'before_table',
        updatedAt: Number(d.updatedAt || 0)
      };
    }
    return {
      ...raw, id:Number(raw.id), priority:Number(raw.priority || 100), diagram
    };
  }

  function normalizeProduct(raw) {
    const options = safeArray(raw.options);
    const sizeOpt = options.find(o => String(o.code).toLowerCase() === 'size');
    const colorOpt = options.find(o => String(o.code).toLowerCase() === 'color');
    const sizes = sizeOpt ? safeArray(sizeOpt.values).map(v => v.value_en || v.code) : [];
    const colors = colorOpt ? safeArray(colorOpt.values).map(v => ({
      id: v.code,
      name_en: v.value_en || v.code,
      name_bn: v.value_bn || v.value_en || v.code,
      hex: v.colorHex || ''
    })) : [];
    const stats = raw.stats || {};
    const product = {
      id: Number(raw.id),
      slug: raw.slug || `product-${raw.id}`,
      name_en: raw.name_en || '', name_bn: raw.name_bn || raw.name_en || '',
      sub_en: raw.sub_en || '', sub_bn: raw.sub_bn || raw.sub_en || '',
      collection_en: 'Our Exclusive Collection', collection_bn: 'আমাদের এক্সক্লুসিভ কালেকশন',
      category: raw.category || 'Exclusive',
      price: Number(raw.price || 0), comparePrice: Number(raw.comparePrice || 0),
      imageUrl: raw.mainImageUrl || '',
      detailImages: safeArray(raw.detailImages),
      description_en: raw.description_en || '', description_bn: raw.description_bn || '',
      sizeChartTemplateId: raw.sizeChartTemplateId ? Number(raw.sizeChartTemplateId) : null,
      sizeChart: raw.sizeChart || {}, sizes, colors, options, variants: safeArray(raw.variants),
      status: raw.status || 'active', salesStatus: raw.salesStatus || 'available',
      allowBackorder: raw.allowBackorder !== false,
      priority: Number(raw.priority || 100), showcaseRow: raw.showcaseRow, showcasePosition: raw.showcasePosition,
      stats: {
        views: Number(stats.views || 0), likes: Number(stats.likes || 0), carts: Number(stats.carts || 0),
        sold: Number(stats.sold || 0), soldBySource: stats.soldBySource || {}
      },
      soldCount: Number(stats.sold || 0), rating: null
    };
    return product;
  }

  function mergeGallery(remote) {
    const seen = new Set();
    return [...originalGallery, ...safeArray(remote).map(x => ({
      url: x.url, name_en: x.name_en, name_bn: x.name_bn
    }))].filter(item => {
      const url = typeof item === 'string' ? item : item?.url;
      if (!url || seen.has(url)) return false;
      seen.add(url); return true;
    });
  }

  async function load() {
    if (!API_BASE || !window.KR) return state;
    try {
      const res = await fetch(`${API_BASE}/api/catalog?_=${Date.now()}`, {
        method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok || !Array.isArray(json.products)) {
        throw new Error(json.error || `Catalog unavailable (${res.status})`);
      }
      const mapped = {};
      json.products.map(normalizeProduct)
        .sort((a, b) => a.priority - b.priority || a.id - b.id)
        .forEach(p => { mapped[p.id] = p; });
      window.KR.PRODUCTS = mapped;
      window.KR.GALLERY_IMAGES = mergeGallery(json.gallery);
      state.source = 'backend'; state.version = Number(json.version || 1);
      state.settings = { ...state.settings, ...(json.settings || {}) };
      state.products = mapped;
      state.heroSlides = safeArray(json.heroSlides).map(normalizeHeroSlide).filter(s => s.status === 'active' && s.imageUrl).sort((a,b)=>a.priority-b.priority||a.id-b.id);
      state.sizeChartTemplates = safeArray(json.sizeChartTemplates).map(normalizeSizeTemplate).sort((a,b)=>a.priority-b.priority||a.id-b.id);
      window.dispatchEvent(new CustomEvent('kr:catalog-ready', { detail: { source:'backend', version:state.version } }));
    } catch (error) {
      state.error = error; state.source = 'fallback'; state.products = originalProducts; state.heroSlides = fallbackHeroSlides;
      console.warn('[Catalog] Backend unavailable; current frontend catalog retained:', error.message);
      window.dispatchEvent(new CustomEvent('kr:catalog-ready', { detail: { source:'fallback', error:error.message } }));
    }
    return state;
  }

  function updateStats(productId, stats) {
    const p = window.KR?.PRODUCTS?.[productId];
    if (!p || !stats) return;
    p.stats = { ...(p.stats || {}), ...stats };
    p.soldCount = Number(p.stats.sold || 0);
    window.dispatchEvent(new CustomEvent('kr:product-stats-updated', { detail: { productId:Number(productId), stats:p.stats } }));
  }

  async function post(path, body) {
    if (!API_BASE) throw new Error('Product API unavailable');
    const res = await fetch(`${API_BASE}${path}`, {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  }

  async function recordView(productId) {
    const now = Date.now(), last = state.lastViewAt.get(String(productId)) || 0;
    if (now - last < 500) return { counted:false };
    state.lastViewAt.set(String(productId), now);
    try {
      const json = await post('/api/products/view', { productId, visitorId:visitorId() });
      updateStats(productId, json.stats); return json;
    } catch (e) { console.warn('[Product view]', e.message); return { counted:false }; }
  }

  function isLiked(productId) { return state.liked.has(String(productId)); }
  async function toggleLike(productId) {
    const key = String(productId), wasLiked = state.liked.has(key), action = wasLiked ? 'unlike' : 'like';
    if (wasLiked) state.liked.delete(key); else state.liked.add(key);
    saveLiked();
    const p = window.KR?.PRODUCTS?.[productId];
    if (p) {
      const next = Math.max(0, Number(p.stats?.likes || 0) + (wasLiked ? -1 : 1));
      updateStats(productId, { ...(p.stats || {}), likes:next });
    }
    try {
      const json = await post('/api/products/like', { productId, action, visitorId:visitorId() });
      updateStats(productId, json.stats); return { ...json, liked:!wasLiked };
    } catch (error) {
      if (wasLiked) state.liked.add(key); else state.liked.delete(key);
      saveLiked();
      if (p) updateStats(productId, { ...(p.stats || {}), likes:Math.max(0, Number(p.stats?.likes || 0) + (wasLiked ? 1 : -1)) });
      throw error;
    }
  }

  function currentPageSession() {
    if (Date.now() - state.pageSessionStartedAt >= SESSION_MAX_AGE) {
      state.pageSessionId = makeId('page'); state.pageSessionStartedAt = Date.now(); state.cartSequence = 0;
    }
    return state.pageSessionId;
  }

  async function recordCart(productId, actionType, detail = '') {
    state.cartSequence += 1;
    const actionKey = `${actionType}|${String(detail).slice(0,80)}|${state.cartSequence}`;
    try {
      const json = await post('/api/products/cart', {
        productId, pageSessionId:currentPageSession(), actionKey,
        actionType, detail:String(detail).slice(0,400), visitorId:visitorId()
      });
      updateStats(productId, json.stats); return json;
    } catch (e) { console.warn('[Product cart count]', e.message); return { counted:false }; }
  }

  window.KRProducts = {
    state, ready:load(), visitorId, isLiked, toggleLike, recordView, recordCart,
    get productList() { return Object.values(window.KR?.PRODUCTS || {}); },
    getProduct(id) { return window.KR?.PRODUCTS?.[Number(id)] || null; }
  };
})();
