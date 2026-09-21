'use strict';
(function () {
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('sizecharts');
  krAdminInitMobileNav();

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  let templates = [];
  let cells = [];
  let dragId = null;
  let previewUrl = '';
  let removeDiagram = false;

  const mobile = $('krMobileMenuBtn');
  if (mobile) mobile.innerHTML = _SVG.menu;

  function normalized(grid) {
    if (Array.isArray(grid?.cells)) return grid.cells.map(row => [...row]);
    if (Array.isArray(grid?.headers)) return [grid.headers, ...(grid.rows || [])].map(row => [...row]);
    return [['Size','Measurement 1','Measurement 2'],['M','',''],['L','','']];
  }

  function publicDiagramUrl(template) {
    const url = String(template?.diagram?.url || '');
    return url.startsWith('/') ? `${KR_ADMIN.WORKER}${url}` : url;
  }

  async function load() {
    try {
      const response = await krAdminFetch('/api/admin/size-charts');
      if (!response.ok) throw new Error(response.error);
      templates = response.templates || [];
      renderList();
    } catch (error) {
      $('scList').innerHTML = `<div class="kr-empty">${esc(error.message || 'Load failed')}</div>`;
      krToast(error.message || 'Load failed', 'error');
    }
  }

  function miniTable(template) {
    const grid = normalized(template.grid);
    return `<table>${grid.slice(0,5).map(row =>
      `<tr>${row.slice(0,5).map(cell => `<td>${esc(cell)}</td>`).join('')}</tr>`
    ).join('')}</table>`;
  }

  function mini(template) {
    const url = publicDiagramUrl(template);
    return `<div class="kr-sc-mini-content">${url && template.diagram?.available
      ? `<img class="kr-sc-mini-diagram" src="${esc(url)}" alt="" loading="lazy">`
      : ''}${miniTable(template)}</div>`;
  }

  function renderList() {
    $('scList').innerHTML = templates.length ? templates.map(template =>
      `<article class="kr-sc-card" draggable="true" data-sc-id="${template.id}">
        <div class="kr-sc-info">
          <h3>${esc(template.internalName)}</h3>
          <p>${esc(template.title_en || 'No English title')}</p>
          <p>${esc(template.title_bn || 'বাংলা শিরোনাম নেই')}</p>
          <p>Priority ${template.priority} · ${esc(template.status)} ${template.diagram?.available ? '· SVG diagram' : '· Table only'}</p>
        </div>
        <div class="kr-sc-mini">${mini(template)}</div>
        <div class="kr-sc-actions">
          <button class="kr-btn kr-btn-ghost kr-btn-sm" data-sc-edit="${template.id}">Edit</button>
          <button class="kr-btn ${template.status === 'active' ? 'kr-btn-danger' : 'kr-btn-primary'} kr-btn-sm" data-sc-toggle="${template.id}">${template.status === 'active' ? 'Archive' : 'Activate'}</button>
          <button class="kr-btn kr-btn-danger kr-btn-sm" data-sc-delete="${template.id}">Delete</button>
        </div>
      </article>`
    ).join('') : '<div class="kr-empty">No size-chart templates.</div>';
    bindDrag();
  }

  function renderSheet() {
    const rows = cells.length;
    const columns = Math.max(1, ...cells.map(row => row.length));
    cells = cells.map(row => Array.from({length:columns}, (_, index) => row[index] || ''));
    $('scSheet').style.gridTemplateColumns = `repeat(${columns},130px)`;
    $('scSheet').innerHTML = cells.flatMap((row, rowIndex) => row.map((value, columnIndex) =>
      `<input class="kr-sc-cell${rowIndex === 0 || columnIndex === 0 ? ' is-header' : ''}" data-r="${rowIndex}" data-c="${columnIndex}" value="${esc(value)}" placeholder="${rowIndex === 0 ? 'Header' : columnIndex === 0 ? 'Label' : ''}">`
    )).join('');
    $('scDimensions').textContent = `${rows} rows × ${columns} columns`;
  }

  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
  }

  function validateSvg(svg) {
    const text = String(svg || '').trim();
    if (!text) return {ok:false, empty:true, message:'No diagram'};
    if (new Blob([text]).size > 220000) return {ok:false, message:'SVG must be 220 KB or smaller'};
    if (!/^<svg\b/i.test(text) || !/<\/svg>\s*$/i.test(text)) return {ok:false, message:'Paste one complete SVG element'};
    if (!/\bviewBox\s*=\s*(["'])[\s\d.\-]+\1/i.test(text)) return {ok:false, message:'SVG viewBox is required'};
    if (/<(?:script|foreignObject|iframe|object|embed|audio|video|a|animate|animateTransform|animateMotion|set)\b/i.test(text)) return {ok:false, message:'SVG contains a forbidden element'};
    if (/\son[a-z]+\s*=/i.test(text) || /javascript\s*:/i.test(text) || /<!DOCTYPE|<!ENTITY/i.test(text)) return {ok:false, message:'SVG contains unsafe code'};
    return {ok:true, message:`Ready · ${(new Blob([text]).size / 1024).toFixed(1)} KB`};
  }

  function updateDiagramStatus() {
    const result = validateSvg($('scDiagramSvg').value);
    const status = $('scDiagramStatus');
    status.textContent = result.message;
    status.className = result.ok ? 'is-valid' : result.empty ? '' : 'is-invalid';
    return result;
  }

  function previewDiagram(showToast = true) {
    const svg = $('scDiagramSvg').value.trim();
    const result = updateDiagramStatus();
    if (!result.ok) {
      $('scDiagramPreviewBox').hidden = true;
      if (showToast && !result.empty) krToast(result.message, 'error');
      return;
    }
    revokePreview();
    previewUrl = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml'}));
    $('scDiagramPreviewImage').src = previewUrl;
    $('scDiagramPreviewBox').hidden = false;
    if (showToast) krToast('SVG preview updated', 'success');
  }

  function openEditor(template = null) {
    $('scEditorTitle').textContent = template ? 'Edit Size Chart' : 'Add Size Chart';
    $('scId').value = template?.id || '';
    $('scName').value = template?.internalName || '';
    $('scPriority').value = template?.priority || 100;
    $('scTitleEn').value = template?.title_en || '';
    $('scTitleBn').value = template?.title_bn || '';
    $('scDescEn').value = template?.description_en || '';
    $('scDescBn').value = template?.description_bn || '';
    $('scStatus').value = template?.status || 'active';

    $('scDiagramSvg').value = template?.diagram?.svg || '';
    $('scDiagramAltEn').value = template?.diagram?.alt_en || '';
    $('scDiagramAltBn').value = template?.diagram?.alt_bn || '';
    $('scDiagramPosition').value = template?.diagram?.position === 'after_table' ? 'after_table' : 'before_table';
    $('scDiagramEnabled').checked = template?.diagram?.enabled !== false;
    removeDiagram = false;
    revokePreview();
    $('scDiagramPreviewBox').hidden = true;
    updateDiagramStatus();
    if ($('scDiagramSvg').value.trim()) previewDiagram(false);

    cells = normalized(template?.grid);
    renderSheet();
    $('scModal').style.display = 'flex';
  }

  function close() {
    revokePreview();
    $('scModal').style.display = 'none';
  }

  function syncCells() {
    document.querySelectorAll('.kr-sc-cell').forEach(input => {
      cells[Number(input.dataset.r)][Number(input.dataset.c)] = input.value;
    });
  }

  function addRow() {
    syncCells(); cells.push(Array(cells[0]?.length || 1).fill('')); renderSheet();
  }
  function addColumn() {
    syncCells(); cells.forEach(row => row.push('')); renderSheet();
  }
  function removeRow() {
    syncCells(); if (cells.length > 1) cells.pop(); renderSheet();
  }
  function removeColumn() {
    syncCells(); if ((cells[0]?.length || 0) > 1) cells.forEach(row => row.pop()); renderSheet();
  }

  async function save() {
    syncCells();
    const firstRow = cells[0] || [];
    if (!firstRow.some(value => String(value).trim())) return krToast('Add at least one non-empty table header', 'error');
    const svg = $('scDiagramSvg').value.trim();
    const validation = validateSvg(svg);
    if (svg && !validation.ok) return krToast(validation.message, 'error');

    const button = $('scSave');
    button.disabled = true;
    try {
      const payload = {
        id: Number($('scId').value) || null,
        internalName: $('scName').value,
        title_en: $('scTitleEn').value,
        title_bn: $('scTitleBn').value,
        description_en: $('scDescEn').value,
        description_bn: $('scDescBn').value,
        grid: {cells},
        diagram: {
          svg,
          alt_en: $('scDiagramAltEn').value,
          alt_bn: $('scDiagramAltBn').value,
          position: $('scDiagramPosition').value,
          enabled: $('scDiagramEnabled').checked
        },
        removeDiagram,
        status: $('scStatus').value,
        priority: Number($('scPriority').value) || 100
      };
      const response = await krAdminFetch('/api/admin/size-charts/save', {
        method:'POST', body:JSON.stringify(payload)
      });
      if (!response.ok) throw new Error(response.error);
      close();
      krToast('Size chart and diagram saved', 'success');
      await load();
    } catch (error) {
      krToast(error.message || 'Save failed', 'error');
    } finally {
      button.disabled = false;
    }
  }

  async function toggle(id) {
    const template = templates.find(item => item.id === id);
    const status = template.status === 'active' ? 'archived' : 'active';
    const response = await krAdminFetch('/api/admin/size-charts/status', {
      method:'POST', body:JSON.stringify({id,status})
    });
    if (!response.ok) throw new Error(response.error);
    await load();
  }

  async function remove(id) {
    if (!confirm('Permanently delete this template and its SVG diagram? Assigned templates cannot be deleted.')) return;
    const response = await krAdminFetch('/api/admin/size-charts/delete', {
      method:'DELETE', body:JSON.stringify({id})
    });
    if (!response.ok) throw new Error(response.error);
    krToast('Template deleted', 'success');
    await load();
  }

  function bindDrag() {
    document.querySelectorAll('[data-sc-id]').forEach(element => {
      element.ondragstart = () => { dragId = Number(element.dataset.scId); element.classList.add('is-dragging'); };
      element.ondragend = () => element.classList.remove('is-dragging');
      element.ondragover = event => event.preventDefault();
      element.ondrop = async event => {
        event.preventDefault();
        const target = Number(element.dataset.scId);
        if (!dragId || dragId === target) return;
        const from = templates.findIndex(item => item.id === dragId);
        const to = templates.findIndex(item => item.id === target);
        const [moved] = templates.splice(from, 1);
        templates.splice(to, 0, moved);
        renderList();
        try {
          const response = await krAdminFetch('/api/admin/size-charts/reorder', {
            method:'POST', body:JSON.stringify({items:templates.map(item => ({id:item.id}))})
          });
          if (!response.ok) throw new Error(response.error);
          await load();
        } catch (error) {
          krToast(error.message || 'Reorder failed', 'error'); await load();
        }
      };
    });
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.scEdit) openEditor(templates.find(item => item.id === Number(button.dataset.scEdit)));
    if (button.dataset.scToggle) toggle(Number(button.dataset.scToggle)).catch(error => krToast(error.message, 'error'));
    if (button.dataset.scDelete) remove(Number(button.dataset.scDelete)).catch(error => krToast(error.message, 'error'));
  });

  $('scSheet').addEventListener('input', event => {
    if (event.target.matches('.kr-sc-cell')) cells[Number(event.target.dataset.r)][Number(event.target.dataset.c)] = event.target.value;
  });
  $('scDiagramSvg').addEventListener('input', () => { removeDiagram = false; updateDiagramStatus(); });
  $('scDiagramPreview').onclick = () => previewDiagram(true);
  $('scDiagramClear').onclick = () => {
    if (!$('scDiagramSvg').value.trim() && $('scDiagramPreviewBox').hidden) return;
    if (!confirm('Remove the SVG diagram from this template? The size table will remain.')) return;
    $('scDiagramSvg').value = '';
    $('scDiagramAltEn').value = '';
    $('scDiagramAltBn').value = '';
    removeDiagram = true;
    revokePreview();
    $('scDiagramPreviewImage').removeAttribute('src');
    $('scDiagramPreviewBox').hidden = true;
    updateDiagramStatus();
  };

  $('scAdd').onclick = () => openEditor();
  $('scRefresh').onclick = load;
  $('scAddRow').onclick = addRow;
  $('scAddCol').onclick = addColumn;
  $('scRemoveRow').onclick = removeRow;
  $('scRemoveCol').onclick = removeColumn;
  $('scSave').onclick = save;
  document.querySelectorAll('[data-sc-close]').forEach(button => button.onclick = close);
  $('scModal').onclick = event => { if (event.target === $('scModal')) close(); };

  load();
})();
