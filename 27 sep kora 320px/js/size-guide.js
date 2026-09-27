/* KORA ROYAL — reusable product size-guide + SVG measurement diagram renderer */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function lang() {
    return document.documentElement.dataset.lang === 'bn' ? 'bn' : 'en';
  }

  function cells(grid) {
    if (Array.isArray(grid?.cells)) return grid.cells;
    if (Array.isArray(grid?.headers)) return [grid.headers, ...(grid.rows || [])];
    return [];
  }

  function templates() {
    return window.KRProducts?.state?.sizeChartTemplates || [];
  }

  function safeDiagramUrl(value) {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
    } catch (_) {
      return '';
    }
  }

  function diagramHTML(template) {
    const diagram = template?.diagram;
    const url = safeDiagramUrl(diagram?.url);
    if (!diagram?.available || !url) return '';

    const alt = lang() === 'bn'
      ? (diagram.alt_bn || diagram.alt_en || template.title_bn || 'সাইজ মাপের ডায়াগ্রাম')
      : (diagram.alt_en || diagram.alt_bn || template.title_en || 'Size measurement diagram');
    const ratio = /^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(String(diagram.aspectRatio || ''))
      ? diagram.aspectRatio : '16/9';

    return `<figure class="krsg-diagram" style="--krsg-ratio:${esc(ratio)}">
      <img src="${esc(url)}" alt="${esc(alt)}" loading="lazy" decoding="async" draggable="false">
    </figure>`;
  }

  function tableHTML(grid) {
    const rows = cells(grid).filter(row => Array.isArray(row));
    if (!rows.length) return '';
    return `<div class="krsg-table-wrap"><table class="kr-sizechart-table">${rows.map((row, rowIndex) =>
      `<tr>${row.map(cell => rowIndex === 0
        ? `<th>${esc(cell)}</th>`
        : `<td>${esc(cell)}</td>`).join('')}</tr>`
    ).join('')}</table></div>`;
  }

  function templateContent(template) {
    const title = lang() === 'bn'
      ? (template.title_bn || template.title_en)
      : (template.title_en || template.title_bn);
    const description = lang() === 'bn'
      ? (template.description_bn || template.description_en)
      : (template.description_en || template.description_bn);
    const diagram = diagramHTML(template);
    const table = tableHTML(template.grid);
    const body = template.diagram?.position === 'after_table'
      ? `${table}${diagram}` : `${diagram}${table}`;

    return {
      title: title || template.internalName || (lang() === 'bn' ? 'সাইজ চার্ট' : 'Size Chart'),
      description,
      body,
      hasDiagram: !!diagram
    };
  }

  function templateHTML(template, allMode = false, index = 0) {
    const content = templateContent(template);
    if (allMode) {
      return `<details class="krsg-template krsg-template--accordion${content.hasDiagram ? ' has-diagram' : ''}" data-size-template="${esc(template.id || '')}" ${index === 0 ? 'open' : ''}>
        <summary>${esc(content.title)}</summary>
        <div class="krsg-template-content">${content.description ? `<p>${esc(content.description)}</p>` : ''}${content.body}</div>
      </details>`;
    }
    return `<section class="krsg-template${content.hasDiagram ? ' has-diagram' : ''}" data-size-template="${esc(template.id || '')}">
      <h3>${esc(content.title)}</h3>
      ${content.description ? `<p>${esc(content.description)}</p>` : ''}
      ${content.body}
    </section>`;
  }

  function ensure() {
    const overlay = $('sizeChartOverlay');
    if (!overlay) return null;
    if (!overlay.dataset.krsgBound) {
      overlay.dataset.krsgBound = '1';
      $('krSizeChartClose')?.addEventListener('click', close);
      overlay.addEventListener('click', event => {
        if (event.target === overlay) close();
      });
      document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && overlay.classList.contains('is-open')) {
          event.stopImmediatePropagation();
          close();
        }
      });
    }
    return overlay;
  }

  function openTemplates(list, allMode = false) {
    const overlay = ensure();
    const body = $('krSizeChartBody');
    const title = $('krSizeChartTitle');
    if (!overlay || !body) return;

    if (!list.length) {
      body.innerHTML = `<div class="krsg-empty">${lang() === 'bn'
        ? 'কোনো সাইজ চার্ট পাওয়া যায়নি'
        : 'No size chart is available'}</div>`;
    } else {
      body.innerHTML = list.map((template, index) => templateHTML(template, allMode, index)).join('');
    }

    if (title) {
      title.textContent = allMode
        ? (lang() === 'bn' ? 'সম্পূর্ণ সাইজ গাইড' : 'Complete Size Guide')
        : (lang() === 'bn' ? 'সাইজ চার্ট' : 'Size Chart');
    }
    overlay.classList.add('is-open');
    document.body.classList.add('krsg-open');
    $('krSizeChartClose')?.focus();
    window.krTrackUI?.(allMode ? 'size_guide_all_open' : 'product_size_chart_open', {ui_location:'size_guide'});
  }

  async function waitForCatalog() {
    try { await window.KRProducts?.ready; } catch (_) {}
  }

  async function openForProduct(productId) {
    await waitForCatalog();
    const product = window.KRProducts?.getProduct(productId) || window.KR?.PRODUCTS?.[productId];
    if (!product) return;

    let template = templates().find(item => Number(item.id) === Number(product.sizeChartTemplateId));
    if (!template && cells(product.sizeChart).length) {
      template = {
        id: `legacy-${product.id}`,
        internalName: product.name_en,
        title_en: `${product.name_en} — Size Chart`,
        title_bn: `${product.name_bn || product.name_en} — সাইজ চার্ট`,
        description_en: '', description_bn: '', grid: product.sizeChart, diagram: null
      };
    }
    openTemplates(template ? [template] : [], false);
  }

  async function openAll() {
    await waitForCatalog();
    let list = templates().filter(template => template.status !== 'archived');
    if (!list.length) {
      const seen = new Set();
      list = Object.values(window.KR?.PRODUCTS || {})
        .filter(product => cells(product.sizeChart).length)
        .map(product => ({
          id: `legacy-${product.id}`,
          internalName: product.name_en,
          title_en: `${product.name_en} — Size Chart`,
          title_bn: `${product.name_bn || product.name_en} — সাইজ চার্ট`,
          grid: product.sizeChart,
          diagram: null
        }))
        .filter(template => {
          const key = JSON.stringify(template.grid);
          if (seen.has(key)) return false;
          seen.add(key); return true;
        });
    }
    openTemplates(list, true);
  }

  function close() {
    const overlay = $('sizeChartOverlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    document.body.classList.remove('krsg-open');
    if (document.body.classList.contains('krpd-open')) {
      document.querySelector('.krpd-dialog')?.focus();
    }
  }

  document.addEventListener('click', event => {
    const all = event.target.closest('#krGlobalSizeChartBtn,#krFooterSizeGuide');
    if (all) {
      event.preventDefault();
      openAll();
    }
  });

  window.KRSizeGuide = {openForProduct, openAll, close};
  window._krOpenSizeChart = openForProduct;
})();
