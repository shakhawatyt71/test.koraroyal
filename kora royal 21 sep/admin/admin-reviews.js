'use strict';

(function() {
  if (!krAdminCheckSession()) return;
  krAdminRenderNav('reviews');
  krAdminInitMobileNav();
  
  let allReviews = [];
  let currentTab = 'pending';
  const escA = v => String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  
  async function loadReviews() {
    const listEl = document.getElementById('krReviewList');
    listEl.innerHTML = `<div class="kr-empty">Loading detailed reviews...</div>`;
    
    try {
      const data = await krAdminFetch('/api/admin/reviews?status=all&page=1');
      if (!data.ok) throw new Error(data.error);
      
      allReviews = data.reviews || [];
      updateBadges();
      renderList();
    } catch (err) {
      krToast(err.message || 'Load failed', 'error');
    }
  }
  
  function updateBadges() {
    const counts = { pending: 0, auto: 0, approved: 0, rejected: 0 };
    allReviews.forEach(r => { if (counts.hasOwnProperty(r.status)) counts[r.status]++; });
    Object.keys(counts).forEach(k => {
      const el = document.getElementById(`kra2${k.charAt(0).toUpperCase() + k.slice(1)}Badge`);
      if (el) el.textContent = counts[k];
    });
  }
  
  function renderList() {
    const listEl = document.getElementById('krReviewList');
    const filtered = allReviews.filter(r => r.status === currentTab);
    
    if (!filtered.length) {
      listEl.innerHTML = `<div class="kr-empty">No reviews in ${currentTab}</div>`;
      return;
    }
    
    listEl.innerHTML = filtered.map(r => {
      const name = r.name || 'Anonymous';
      const text = r.text_en || r.text_bn || '';
      const date = krFmtDate(r.date || r.createdAt);
      
      return `
            <div class="kr-review-card" id="rev-${r.id}">
                <div class="kr-review-summary" onclick="KRA2.toggleRow('${r.id}')">
                    <div class="kr-rev-user">
                        <div class="kr-rev-avatar">${escA(name.charAt(0).toUpperCase())}</div>
                        <div class="kr-rev-name">${escA(name)}</div>
                    </div>
                    <div class="kr-rev-text-preview">${escA(text.substring(0, 70))}...</div>
                    <div class="kr-rev-time">${krTimeAgo(r.date || r.createdAt)}</div>
                    <div class="kr-rev-rating">${'★'.repeat(r.rating)}</div>
                </div>

                <div class="kr-rev-detail">
                    <!-- Basic Info -->
                    <div class="kr-rev-full-text">${escA(text)}</div>
                    
                    ${r.productImgs?.length ? `
                        <div style="display:flex; gap:8px; margin-bottom:15px;">
                            ${r.productImgs.map(img => `<img src="${escA(img)}" style="width:70px;height:70px;border-radius:6px;object-fit:cover;cursor:pointer;" onclick="event.stopPropagation(); KRA2.openLightbox('${escA(img)}')">`).join('')}
                        </div>
                    ` : ''}

                    <div class="kr-rev-info-grid">
                        <div class="kr-rev-info-item">ID: <strong>${r.id}</strong></div>
                        <div class="kr-rev-info-item">Date: <strong>${date}</strong></div>
                        <div class="kr-rev-info-item">Rating: <strong>${r.rating}★</strong></div>
                        ${r.approvedBy ? `<div class="kr-rev-info-item">By: <strong>${escA(r.approvedBy)}</strong></div>` : ''}
                        ${r.rejectReason ? `<div class="kr-rev-info-item">Reason: <strong>${escA(r.rejectReason)}</strong></div>` : ''}
                    </div>

                    <!-- Actions Area -->
                    <div style="margin-top:15px; display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
                        ${(currentTab==='pending' || currentTab==='auto' || currentTab==='rejected') ? `
                            <button class="kr-btn kr-btn-primary kr-btn-sm" onclick="KRA2.toggleApprovePanel('${r.id}')">Approve...</button>
                        ` : ''}
                        ${(currentTab!=='rejected') ? `
                            <button class="kr-btn kr-btn-danger kr-btn-sm" onclick="KRA2.updateStatus('${r.id}', 'reject')">Reject</button>
                        ` : ''}
                        ${(currentTab==='approved') ? `
                            <button class="kr-btn kr-btn-ghost kr-btn-sm" onclick="KRA2.updateStatus('${r.id}', 'revoke')">Move to Pending</button>
                        ` : ''}
                    </div>

                    <!-- Approve By Selection Panel -->
                    <div class="kr-approve-panel" id="panel-${r.id}">
                        <span class="kr-panel-title">Who is approving this?</span>
                        <div class="kr-radio-group">
                            ${['Admin','Moderator','Employee','Auto'].map(opt => `
                                <label class="kr-radio-item">
                                    <input type="radio" name="aby-${r.id}" value="${opt.toLowerCase()}" ${opt==='Admin'?'checked':''}>
                                    <span class="kr-radio-dot"></span>
                                    <span>${opt}</span>
                                </label>
                            `).join('')}
                        </div>
                        <button class="kr-btn kr-btn-primary kr-btn-sm" style="width:100%" onclick="KRA2.confirmApprove('${r.id}')">Confirm Approval</button>
                    </div>

                    <!-- Priority Slider -->
                    <div class="kr-priority-row">
                        <span class="kr-priority-label">Priority Boost:</span>
                        <input type="range" class="kr-priority-input" min="0" max="20" value="${r.priorityBoost || 0}" 
                               oninput="document.getElementById('pval-${r.id}').textContent=this.value">
                        <span class="kr-priority-val" id="pval-${r.id}">${r.priorityBoost || 0}</span>
                        <button class="kr-btn kr-btn-ghost kr-btn-sm" style="padding:2px 10px; font-size:0.7rem;" onclick="KRA2.savePriority('${r.id}')">Save</button>
                    </div>
                </div>
            </div>`;
    }).join('');
  }
  
  window.KRA2 = {
    toggleRow: (id) => {
      const card = document.getElementById(`rev-${id}`);
      card.classList.toggle('is-open');
    },
    toggleApprovePanel: (id) => {
      event.stopPropagation();
      document.getElementById(`panel-${id}`).classList.toggle('show');
    },
    confirmApprove: async (id) => {
      const val = document.querySelector(`input[name="aby-${id}"]:checked`).value;
      await KRA2.executeStatusChange(id, 'approve', { approvedBy: val });
    },
    updateStatus: async (id, action) => {
      event.stopPropagation();
      if (action === 'reject' && !confirm('Reject this review?')) return;
      await KRA2.executeStatusChange(id, action);
    },
    executeStatusChange: async (id, action, extraBody = {}) => {
      try {
        krShowLoading(true);
        const res = await krAdminFetch(`/api/admin/reviews/${action==='revoke'?'revoke':action}`, {
          method: 'POST',
          body: JSON.stringify({ id, ...extraBody })
        });
        if (!res.ok) throw new Error(res.error);
        krToast(`Success: Review ${action}ed`, 'success');
        loadReviews();
      } catch (err) {
        krToast(err.message, 'error');
      } finally {
        krShowLoading(false);
      }
    },
    savePriority: async (id) => {
      const boost = document.querySelector(`#rev-${id} .kr-priority-input`).value;
      try {
        krShowLoading(true);
        const res = await krAdminFetch(`/api/admin/reviews/priority`, {
          method: 'POST',
          body: JSON.stringify({ id, boost: parseInt(boost) })
        });
        krToast(res.ok ? 'Priority updated' : 'Failed to update', res.ok ? 'success' : 'error');
      } catch (err) {
        krToast(err.message, 'error');
      } finally {
        krShowLoading(false);
      }
    },
    openLightbox: (src) => {
      const lb = document.getElementById('kra2Lightbox');
      document.getElementById('kra2LightboxImg').src = src;
      lb.classList.add('is-open');
    },
    closeLightbox: () => {
      document.getElementById('kra2Lightbox').classList.remove('is-open');
    }
  };
  
  document.getElementById('kra2Tabs').onclick = (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    document.querySelectorAll('.kr-rtab').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    currentTab = btn.dataset.tab;
    renderList();
  };
  
  document.getElementById('kra2RefreshBtn').onclick = loadReviews;
  loadReviews();
})();