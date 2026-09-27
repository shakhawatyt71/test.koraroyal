/* ================================================================
   KORA ROYAL — Product Details Modal v1
   ================================================================ */
(function () {
  'use strict';
  let currentProductId = null;
  let lastFocused = null;

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[ch]);

  function lang() { return document.documentElement.getAttribute('data-lang') === 'bn' ? 'bn' : 'en'; }
  function t(en, bn) { return lang() === 'bn' ? bn : en; }
  function money(n) { return `৳${Number(n || 0).toLocaleString('en-BD')}`; }
  function productName(p) { return lang() === 'bn' ? (p.name_bn || p.name_en) : p.name_en; }
  function discountInfo(p){const price=Number(p.price||0),compare=Number(p.comparePrice||0);return compare>price?{compare,saved:compare-price,percent:Math.round((compare-price)/compare*100)}:null;}
  function statWords(kind){const bn={likes:'জন লাইক করেছেন',views:'জন দেখেছেন',carts:'জন কার্ট করেছেন',sold:'টি বিক্রি হয়েছে'},en={likes:'people liked',views:'people viewed',carts:'people carted',sold:'items sold'};return (lang()==='bn'?bn:en)[kind];}
  function statusInfo(p) {
    if (p.salesStatus === 'out_of_stock') return { cls:'out', label:t('Out of Stock — Restocking Soon…','স্টক শেষ — শীঘ্রই আবার আসছে…') };
    if (p.salesStatus === 'limited') return { cls:'limited', label:t('Limited Availability','সীমিত স্টক—অর্ডার করে নিশ্চিত করুন') };
    return { cls:'available', label:t('Available to Order','অর্ডারের জন্য উপলব্ধ') };
  }

  function ensureModal() {
    if (document.getElementById('krProductDetailsModal')) return;
    const modal = document.createElement('div');
    modal.id = 'krProductDetailsModal';
    modal.className = 'krpd-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML = `
      <div class="krpd-overlay" data-krpd-close></div>
      <section class="krpd-dialog" role="dialog" aria-modal="true" aria-labelledby="krpdTitle" tabindex="-1">
        <button type="button" class="krpd-close" data-krpd-close aria-label="Close product details">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div id="krpdContent" class="krpd-content"></div>
      </section>`;
    document.body.appendChild(modal);
  }

  function descriptionHTML(text) {
    const lines = String(text || '').split(/\r?\n/);
    let html = '', list = [];
    const flush = () => {
      if (!list.length) return;
      html += `<ul>${list.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`; list = [];
    };
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) { flush(); continue; }
      if (/^[-•]\s+/.test(line)) { list.push(line.replace(/^[-•]\s+/,'')); continue; }
      flush();
      if (/^#{1,3}\s+/.test(line)) html += `<h3>${esc(line.replace(/^#{1,3}\s+/,''))}</h3>`;
      else html += `<p>${esc(line)}</p>`;
    }
    flush();
    return html || `<p>${t('More details will be added soon.','আরও বিস্তারিত শীঘ্রই যোগ করা হবে।')}</p>`;
  }

  function imagesFor(p) {
    const all = [{ url:p.imageUrl, alt_en:p.name_en, alt_bn:p.name_bn }, ...(p.detailImages || [])];
    const seen = new Set();
    return all.filter(x => x?.url && !seen.has(x.url) && seen.add(x.url));
  }

  function optionHTML(p) {
    if (!p.options?.length) return '';
    return `<div class="krpd-options-preview">
      ${p.options.map(o => `<div class="krpd-option-preview">
        <strong>${esc(lang()==='bn' ? (o.label_bn||o.label_en) : o.label_en)}</strong>
        <span>${(o.values||[]).map(v => esc(lang()==='bn' ? (v.value_bn||v.value_en) : v.value_en)).join(' · ') || '—'}</span>
      </div>`).join('')}
    </div>`;
  }

  function relatedHTML(p) {
    const related = Object.values(window.KR?.PRODUCTS || {})
      .filter(x => x.id !== p.id && x.status === 'active')
      .sort((a,b) => a.priority-b.priority || a.id-b.id);
    if (!related.length) return '';
    return `<section class="krpd-related">
      <h3>${t('Explore More Products','আরও পণ্য দেখুন')}</h3>
      <div class="krpd-related-track">
        ${related.map(x => `<button type="button" class="krpd-related-card" data-related-pid="${x.id}">
          <img src="${esc(x.imageUrl)}" alt="${esc(productName(x))}" loading="lazy" />
          <span>${esc(productName(x))}</span><b>${money(x.price)}</b>
        </button>`).join('')}
      </div>
    </section>`;
  }

  function render(productId) {
    const p = window.KRProducts?.getProduct(productId) || window.KR?.PRODUCTS?.[productId];
    const content = document.getElementById('krpdContent');
    if (!p || !content) return false;
    currentProductId = Number(p.id);
    const imgs = imagesFor(p), main = imgs[0]?.url || '';
    const status = statusInfo(p), blocked = p.salesStatus === 'out_of_stock';
    const stats = p.stats || {};
    const liked = window.KRProducts?.isLiked(p.id);
    const phone = String(window.KR?.WHATSAPP || '').replace(/[^0-9+]/g,'');
    const waNumber = phone.replace(/\D/g,'');
    const inquiry = t(
      `Hello KORA ROYAL, I want to know about restock/availability of ${p.name_en} (${money(p.price)}).`,
      `হ্যালো KORA ROYAL, ${p.name_bn || p.name_en} (${money(p.price)}) পণ্যটির স্টক/রিস্টক সম্পর্কে জানতে চাই।`
    );
    const description = lang()==='bn' ? (p.description_bn || p.description_en) : p.description_en;

    content.innerHTML = `
      <div class="krpd-main-grid">
        <div class="krpd-media">
          <div class="krpd-main-image-wrap"><img id="krpdMainImage" class="krpd-main-image" src="${esc(main)}" alt="${esc(productName(p))}" decoding="async" /><button type="button" class="krpd-zoom-trigger" data-krpd-zoom aria-label="${t('Zoom product image','পণ্যের ছবি জুম করুন')}">${window.KRUIIcon?.('zoom')||'+'}<span>${t('Zoom','জুম')}</span></button></div>
          ${imgs.length>1 ? `<div class="krpd-thumbs" aria-label="Product images">
            ${imgs.map((img,i)=>`<button type="button" class="krpd-thumb${i===0?' is-active':''}" data-image-src="${esc(img.url)}"><img src="${esc(img.url)}" alt="${esc(lang()==='bn'?(img.alt_bn||productName(p)):(img.alt_en||productName(p)))}" loading="lazy" /></button>`).join('')}
          </div>`:''}
        </div>
        <div class="krpd-info">
          <span class="krpd-status krpd-status--${status.cls}">${esc(status.label)}</span>
          <h2 id="krpdTitle">${esc(productName(p))}</h2>
          <p class="krpd-sub">${esc(lang()==='bn' ? (p.sub_bn||p.sub_en) : p.sub_en)}</p>
          ${(()=>{const d=discountInfo(p);return `<div class="krpd-price-row"><strong>${money(p.price)}</strong>${d?`<del>${money(d.compare)}</del><span class="krpd-discount">${d.percent}% OFF</span>`:''}</div>${d?`<div class="krpd-saving">${t(`You save ${money(d.saved)}`,`আপনি সাশ্রয় করছেন ${money(d.saved)}`)}</div>`:''}`})()}
          <div class="krpd-stats" data-product-stats="${p.id}">
            <button type="button" class="krpd-stat krpd-like${liked?' is-liked':''}" data-product-like="${p.id}" aria-pressed="${liked?'true':'false'}">${window.KRUIIcon?.('like')||''}<div><b data-stat="likes">${Number(stats.likes||0)}</b> <span>${statWords('likes')}</span></div></button>
            <span class="krpd-stat">${window.KRUIIcon?.('view')||''}<div><b data-stat="views">${Number(stats.views||0)}</b> <span>${statWords('views')}</span></div></span>
            <span class="krpd-stat">${window.KRUIIcon?.('cart')||''}<div><b data-stat="carts">${Number(stats.carts||0)}</b> <span>${statWords('carts')}</span></div></span>
            <span class="krpd-stat">${window.KRUIIcon?.('sold')||''}<div><b data-stat="sold">${Number(stats.sold||0)}</b> <span>${statWords('sold')}</span></div></span>
          </div>
          ${optionHTML(p)}
          ${p.sizeChartTemplateId||p.sizeChart?.headers?.length||p.sizeChart?.cells?.length?`<button type="button" class="krpd-sizechart" data-krpd-sizechart="${p.id}">${t('View Size Chart','সাইজ চার্ট দেখুন')}</button>`:''}
          <div class="krpd-actions">
            <button type="button" class="krpd-grab" data-krpd-grab="${p.id}" ${blocked?'disabled':''}>${blocked?t('Out of Stock','স্টক শেষ'):t('Grab It Now','এখনই নিন')}</button>
            <a class="krpd-whatsapp" href="https://wa.me/${waNumber}?text=${encodeURIComponent(inquiry)}" target="_blank" rel="noopener">${t('Order / Ask on WhatsApp','WhatsApp-এ জিজ্ঞাসা করুন')}</a>
            ${blocked ? `<button class="krpd-call is-disabled" type="button" disabled>${t('Call Unavailable','কল বন্ধ')}</button>` : `<a class="krpd-call" href="tel:${esc(phone)}">${t('Call for Order','কল করে অর্ডার')}</a>`}
          </div>
        </div>
      </div>
      <section class="krpd-description"><h3>${t('Product Details','পণ্যের বিস্তারিত')}</h3>${descriptionHTML(description)}</section>
      ${relatedHTML(p)}`;
    return true;
  }

  async function open(productId, trigger) {
    ensureModal();
    if (!render(Number(productId))) return;
    const modal = document.getElementById('krProductDetailsModal');
    lastFocused = trigger || document.activeElement;
    modal.classList.add('is-open'); modal.setAttribute('aria-hidden','false');
    document.body.classList.add('krpd-open');
    modal.querySelector('.krpd-dialog')?.focus();
    const p = window.KRProducts?.getProduct(productId);
    if (p) {
      window.krTrackUI?.('product_detail_open',{ui_location:'product_details_modal',product_id:String(p.id),product_name:p.name_en});
      window.SessionTracker?.recordProductView(p);
      window.KRProducts?.recordView(p.id).then(result=>{if(result?.counted&&typeof window.pushViewItem==='function')window.pushViewItem(p);});
    }
  }

  function close() {
    const modal = document.getElementById('krProductDetailsModal');
    if (!modal?.classList.contains('is-open')) return;
    modal.classList.remove('is-open'); modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('krpd-open'); currentProductId = null;
    lastFocused?.focus?.();
  }

  async function toggleLike(productId, button) {
    if (button?.disabled) return;
    button && (button.disabled = true);
    try {
      const result = await window.KRProducts.toggleLike(productId);
      document.querySelectorAll(`[data-product-like="${productId}"]`).forEach(btn => {
        btn.classList.toggle('is-liked', !!result.liked); btn.setAttribute('aria-pressed', result.liked?'true':'false');
        const svg=btn.querySelector('svg'); if(svg) svg.setAttribute('fill',result.liked?'currentColor':'none');
      });
    } catch (e) { console.error('[Product like]', e.message); }
    finally { button && (button.disabled = false); }
  }

  document.addEventListener('click', e => {
    const closeBtn=e.target.closest('[data-krpd-close]'); if(closeBtn){close();return;}
    const thumb=e.target.closest('.krpd-thumb');
    if(thumb){
      const img=document.getElementById('krpdMainImage'); if(img) img.src=thumb.dataset.imageSrc;
      thumb.parentElement.querySelectorAll('.krpd-thumb').forEach(x=>x.classList.toggle('is-active',x===thumb)); window.krTrackUI?.('product_modal_thumbnail',{ui_location:'product_details_modal',product_id:String(currentProductId)}); return;
    }
    const zoom=e.target.closest('[data-krpd-zoom]'); if(zoom){const p=window.KRProducts?.getProduct(currentProductId),list=p?imagesFor(p):[],active=[...document.querySelectorAll('.krpd-thumb')].findIndex(x=>x.classList.contains('is-active'));window.KRProductImageViewer?.open(list,Math.max(0,active));return;}
    const related=e.target.closest('[data-related-pid]'); if(related){open(Number(related.dataset.relatedPid),related); return;}
    const like=e.target.closest('[data-product-like]'); if(like){e.preventDefault();e.stopPropagation();toggleLike(Number(like.dataset.productLike),like);return;}
    const size=e.target.closest('[data-krpd-sizechart]'); if(size){window._krOpenSizeChart?.(Number(size.dataset.krpdSizechart));return;}
    const grab=e.target.closest('[data-krpd-grab]');
    if(grab&&!grab.disabled){
      const pid=Number(grab.dataset.krpdGrab);
      close(); window.krSelectProduct?.(pid,'modal_grab'); return;
    }
  });

  document.addEventListener('keydown', e => {
    const modal=document.getElementById('krProductDetailsModal');
    if(!modal?.classList.contains('is-open')) return;
    if(e.key==='Escape'){e.preventDefault();close();return;}
    if(e.key==='Tab'){
      const focusable=[...modal.querySelectorAll('button:not(:disabled),a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
      if(!focusable.length)return; const first=focusable[0],last=focusable[focusable.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
  });

  window.addEventListener('kr:product-stats-updated', e => {
    const {productId,stats}=e.detail||{};
    document.querySelectorAll(`[data-product-stats="${productId}"], [data-stat-product="${productId}"]`).forEach(root => {
      ['likes','views','carts','sold'].forEach(key => {
        const el=root.querySelector(`[data-stat="${key}"]`); if(el) el.textContent=Number(stats?.[key]||0).toLocaleString('en-BD');
      });
    });
  });

  window.KRProductDetails = { open, close, render, toggleLike, get currentProductId(){return currentProductId;} };
})();
