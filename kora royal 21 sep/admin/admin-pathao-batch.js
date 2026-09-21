'use strict';
/* KORA ROYAL — admin/admin-pathao-batch.js (v1.0)
   SHARED Pathao courier widgets, used by orders.html AND pathao.html:
     • window.openPathaoBatch(orderIds)  — review table → "Book N parcels" (one API order per row)
     • window.syncPathao(orderIds|[])    — pull latest courier status from Pathao
     • window.krPathaoCsv(orderIds)      — Pathao bulk-import CSV with Pathao's OWN city/zone/area names
     • window.krPathaoCsvArchive()       — archive modal of generated CSVs (localStorage)
   Hooks (optional, set by the host page BEFORE the user clicks):
     window.KR_PATHAO_HOOKS = { afterBook: async()=>{}, afterSync: async()=>{} }
   Backend: POST /api/admin/pathao/resolve, /book-batch, /sync-status, /price, /csv-rows
   The modal HTML + CSS are injected on first use, so host pages need no markup. */
(function(){
  const esc = v => String(v==null?'':v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const hooks = () => window.KR_PATHAO_HOOKS || {};
  const PB = { rows: [], cities: [], zones: {}, areas: {}, settings: {}, widgets: {}, mounted: false };

  /* ── one-time DOM (CSS + modals) ── */
  function mount(){
    if (PB.mounted) return; PB.mounted = true;
    const css = document.createElement('style'); css.id = 'krPathaoBatchCss';
    css.textContent = `
  .kr-pb-table{width:100%;border-collapse:separate;border-spacing:0 6px;font-size:0.8rem;}
  .kr-pb-row{background:var(--bg-body);border-radius:var(--radius-md);}
  .kr-pb-row>td{padding:8px 6px;vertical-align:top;}
  .kr-pb-row>td:first-child{border-radius:var(--radius-md) 0 0 var(--radius-md);}
  .kr-pb-row>td:last-child{border-radius:0 var(--radius-md) var(--radius-md) 0;}
  .kr-pb-row.is-error{outline:1.5px solid rgba(220,38,38,0.5);}
  .kr-pb-row.is-auto{outline:1.5px dashed rgba(245,158,11,0.6);}
  .kr-pb-row.is-done{opacity:0.7;}
  .kr-pb-row .kr-input{padding:0.4rem 0.55rem;font-size:0.8rem;}
  .kr-pb-conf{display:inline-block;padding:2px 7px;border-radius:999px;font-size:0.66rem;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;}
  .kr-pb-conf.high{background:rgba(34,197,94,0.14);color:#15803D;}.kr-pb-conf.medium{background:rgba(245,158,11,0.16);color:#B45309;}.kr-pb-conf.low,.kr-pb-conf.none{background:rgba(239,68,68,0.14);color:#B91C1C;}
  .kr-pb-conf.learned{background:rgba(14,165,233,0.14);color:#0369A1;}.kr-pb-conf.auto{background:rgba(245,158,11,0.16);color:#92400E;}
  .kr-pb-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .kr-pb-meta{font-size:0.72rem;color:var(--text-muted);margin-top:3px;}
  .kr-pb-warn{font-size:0.72rem;color:#B45309;margin-top:3px;}
  .kr-pb-err{font-size:0.74rem;color:#DC2626;margin-top:4px;font-weight:600;}
  .kr-pb-ok{font-size:0.74rem;color:#15803D;margin-top:4px;font-weight:600;}
  .kr-pb-details{margin-top:6px;}
  .kr-pb-details summary{cursor:pointer;font-size:0.74rem;color:var(--brand-coral);font-weight:600;}
  .kr-pb-details .kr-pb-grid{grid-template-columns:1fr 1fr;margin-top:6px;}
  .kr-pb-modal{display:none;z-index:1000;position:fixed;inset:0;background:rgba(0,0,0,0.5);align-items:center;justify-content:center;padding:1rem;}
  .kr-pb-x{background:none;border:none;font-size:1.5rem;color:var(--text-muted);cursor:pointer;line-height:1;}
  @media (max-width:760px){.kr-pb-grid{grid-template-columns:1fr;}.kr-pb-table,.kr-pb-table tbody,.kr-pb-row,.kr-pb-row>td{display:block;width:100%;}.kr-pb-row{padding:6px;margin-bottom:8px;}.kr-pb-row>td{padding:4px 2px;}}`;
    document.head.appendChild(css);
    document.body.insertAdjacentHTML('beforeend', `
<div id="krPathaoBatchModal" class="kr-modal-backdrop kr-pb-modal">
  <div class="kr-modal-box" style="max-width:1080px;width:100%;padding:1.25rem 1.25rem 1rem;display:flex;flex-direction:column;gap:0.75rem;max-height:min(94dvh,960px);">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
      <div>
        <h3 style="font-family:'Outfit',sans-serif;font-size:1.15rem;font-weight:800;color:var(--text-primary);margin:0;">🚚 Send to Pathao — review &amp; book</h3>
        <div id="pbSub" style="font-size:0.76rem;color:var(--text-muted);margin-top:2px;">Every field below is exactly what Pathao's "New Parcel" form asks for — pre-filled from the order and the defaults in <b>Pathao Courier → Parcel defaults</b>. Fix anything red, then press <b>Book</b>. One Pathao parcel per order; pickup is NOT requested by this site.</div>
      </div>
      <button type="button" class="kr-pb-x" data-pb-close>&times;</button>
    </div>
    <div id="pbBanner" style="display:none;font-size:0.8rem;padding:8px 12px;border-radius:var(--radius-md);"></div>
    <div style="overflow:auto;flex:1;min-height:0;-webkit-overflow-scrolling:touch;">
      <table class="kr-pb-table"><tbody id="pbRows"></tbody></table>
    </div>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;flex-wrap:wrap;border-top:1px solid var(--border-subtle);padding-top:10px;">
      <div id="pbSummary" style="font-size:0.78rem;color:var(--text-muted);"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="kr-btn kr-btn-ghost" type="button" data-pb-close>Close</button>
        <button id="pbRefreshBtn" class="kr-btn kr-btn-ghost" type="button">↻ Re-detect</button>
        <button id="pbBookBtn" class="kr-btn kr-btn-primary" type="button">Book all</button>
      </div>
    </div>
  </div>
</div>
<div id="krCsvArchiveModal" class="kr-modal-backdrop kr-pb-modal">
  <div class="kr-modal-box" style="max-width:620px;width:100%;display:flex;flex-direction:column;gap:1rem;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <h3 style="font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:700;color:var(--text-primary);margin:0;">📂 Bulk CSV Archive</h3>
      <button type="button" class="kr-pb-x" data-csv-close>&times;</button>
    </div>
    <p style="margin:0;font-size:0.8rem;color:var(--text-muted);">Generated CSV files (Pathao bulk-import format) সেভ থাকে। যেকোনো সময় আবার ডাউনলোড/ডিলিট করা যায়।</p>
    <div id="krCsvArchiveList" style="display:flex;flex-direction:column;gap:8px;max-height:340px;overflow-y:auto;"></div>
  </div>
</div>`);
    document.querySelectorAll('[data-pb-close]').forEach(b => b.onclick = () => { document.getElementById('krPathaoBatchModal').style.display = 'none'; });
    document.querySelectorAll('[data-csv-close]').forEach(b => b.onclick = () => { document.getElementById('krCsvArchiveModal').style.display = 'none'; });
    document.getElementById('pbBookBtn').onclick = bookAll;
  }

  async function loadCities(){ if(PB.cities.length) return PB.cities; const r=await krAdminFetch('/api/admin/pathao/cities'); if(!r.ok) throw new Error(r.error||'City list failed'); PB.cities=r.cities||[]; return PB.cities; }
  async function loadZones(cityId){ if(!cityId) return []; if(PB.zones[cityId]) return PB.zones[cityId]; const r=await krAdminFetch(`/api/admin/pathao/zones?city_id=${cityId}`); if(!r.ok) throw new Error(r.error||'Zone list failed'); PB.zones[cityId]=r.zones||[]; return PB.zones[cityId]; }
  async function loadAreas(zoneId){ if(!zoneId) return []; if(PB.areas[zoneId]) return PB.areas[zoneId]; const r=await krAdminFetch(`/api/admin/pathao/areas?zone_id=${zoneId}`); PB.areas[zoneId]=(r.ok&&r.areas)||[]; return PB.areas[zoneId]; }

  window.openPathaoBatch = async function(orderIds){
    mount();
    const ids=[...new Set(orderIds||[])]; if(!ids.length) return krToast('Select orders first (checkbox)','warning');
    if(ids.length>50) return krToast('Max 50 orders per batch','warning');
    const modal=document.getElementById('krPathaoBatchModal'); modal.style.display='flex';
    const rowsEl=document.getElementById('pbRows'); rowsEl.innerHTML=`<tr><td style="padding:2rem;text-align:center;color:var(--text-muted);">Detecting Pathao city / zone / area for ${ids.length} order(s)…<div style="width:20px;height:20px;border:2.5px solid rgba(255,96,68,0.2);border-top-color:var(--brand-coral);border-radius:50%;animation:krSpin 0.7s linear infinite;margin:10px auto 0;"></div></td></tr>`;
    document.getElementById('pbSummary').textContent=''; banner('');
    document.getElementById('pbBookBtn').disabled=true; document.getElementById('pbBookBtn').textContent='Book all';
    document.getElementById('pbRefreshBtn').onclick=()=>openPathaoBatch(ids);
    try{
      const [res]=await Promise.all([krAdminFetch('/api/admin/pathao/resolve',{method:'POST',body:JSON.stringify({orderIds:ids})}), loadCities().catch(()=>[])]);
      if(!res.ok) throw new Error(res.error||'Resolve failed');
      PB.settings={mode:res.mode,storeId:res.storeId,enabled:res.enabled,addressMode:res.addressMode||'resolver'};
      if(!res.enabled) banner('⚠️ Pathao integration is OFF. Open <a href="pathao.html" style="color:inherit;font-weight:700;">Pathao Courier</a> → Connection → enable it and select a store.','warn');
      else if(!res.storeId) banner('⚠️ No Pathao store selected for '+res.mode+' mode. <a href="pathao.html" style="color:inherit;font-weight:700;">Pathao Courier</a> → Parcel defaults → Sync Stores → pick store → Save.','warn');
      else if(res.fatal) banner('❌ Pathao API error: '+esc(res.fatal),'error');
      else banner(`Mode: <b>${esc(res.mode.toUpperCase())}</b> · Store #${esc(res.storeId)} · Address mode: <b>${esc(PB.settings.addressMode)}</b>${res.mode==='sandbox'?' · sandbox parcels are NOT real deliveries':''}`, res.mode==='sandbox'?'warn':'info');
      PB.rows=res.orders.map(o=>({...o, cityId:o.city?.id||'', zoneId:o.zone?.id||'', areaId:o.area?.id||'', cityName:o.city?.name||'', zoneName:o.zone?.name||'', areaName:o.area?.name||'', result:null, weightVal:o.weight,
        /* addressMode 'auto' → start with no ids; Pathao geocodes the address itself */
        ...(PB.settings.addressMode==='auto' ? {cityId:'',zoneId:'',areaId:'',cityName:'',zoneName:'',areaName:''} : {})}));
      render();
    }catch(e){ rowsEl.innerHTML=`<tr><td style="padding:1.5rem;color:#DC2626;font-size:0.85rem;">${esc(e.message)}</td></tr>`; }
  };
  function banner(html,type){ const b=document.getElementById('pbBanner'); if(!html){b.style.display='none';return;} b.style.display='block'; b.innerHTML=html; b.style.background=type==='error'?'rgba(220,38,38,0.08)':type==='warn'?'rgba(245,158,11,0.12)':'rgba(14,165,233,0.08)'; b.style.color=type==='error'?'#B91C1C':type==='warn'?'#92400E':'#0369A1'; }
  /* ready = has city+zone; auto = no ids but Pathao may auto-detect (allowed unless address mode is manual); needs = must pick */
  function rowState(r){ if(!r.ok) return 'error'; if(r.alreadyBooked) return 'booked'; if(r.cancelled) return 'cancelled'; if(!r.cityId||!r.zoneId) return PB.settings.addressMode==='manual' ? 'needs' : (String(r.recipientAddress||'').length>=15 ? 'auto' : 'needs'); return 'ready'; }
  const bookable = st => st==='ready'||st==='auto';
  function render(){
    const rowsEl=document.getElementById('pbRows'); PB.widgets={};
    rowsEl.innerHTML=PB.rows.map((r,i)=>{
      const st=rowState(r);
      const conf=st==='auto'?'auto':r.source==='learned'?'learned':(r.confidence||'none');
      const skip=st==='booked'||st==='cancelled'||st==='error';
      return `<tr class="kr-pb-row ${st==='needs'||st==='error'?'is-error':''} ${st==='auto'?'is-auto':''} ${skip?'is-done':''}" data-i="${i}">
        <td style="width:34px;"><input type="checkbox" data-pb-sel ${skip?'disabled':'checked'} style="appearance:auto;width:16px;height:16px;margin-top:4px;"></td>
        <td style="min-width:170px;">
          <div style="font-family:'Outfit',sans-serif;font-weight:700;color:var(--brand-coral);">${esc(r.orderId)}</div>
          <div style="font-weight:600;">${esc(r.recipientName)}</div>
          <div class="kr-pb-meta">${esc(r.recipientPhone)} · ${krStatusBadge(r.status)}</div>
          <div class="kr-pb-meta">${esc(r.district||'—')}${r.thana?' / '+esc(r.thana):''}</div>
          ${st==='booked'?`<div class="kr-pb-ok">Already booked → <a href="${krTrackingUrl(r.consignmentId)}" target="_blank" rel="noopener">${esc(r.consignmentId)}</a></div>`:''}
          ${st==='cancelled'?`<div class="kr-pb-err">Cancelled order — skipped</div>`:''}
          ${st==='error'?`<div class="kr-pb-err">${esc(r.error)}</div>`:''}
        </td>
        <td style="min-width:300px;">
          ${skip?'':`<div class="kr-pb-grid"><div data-pb-city></div><div data-pb-zone></div><div data-pb-area></div></div>
          <div class="kr-pb-meta" data-pb-confline><span class="kr-pb-conf ${conf}">${conf==='auto'?'Pathao auto-detect':conf==='learned'?'learned ✓':conf==='none'?'not mapped':conf+' match'}</span> ${st==='auto'?'city/zone will be detected by Pathao from the full address (or pick manually)':(r.reasons&&r.reasons.length?esc(r.reasons.join(' · ')):'')} ${st==='needs'?'<b style="color:#B91C1C">— pick city &amp; zone'+(PB.settings.addressMode==='manual'?' (manual mode)':' or write a fuller address')+'</b>':''}</div>
          ${(r.warnings||[]).map(w=>`<div class="kr-pb-warn">⚠ ${esc(w)}</div>`).join('')}
          <details class="kr-pb-details"><summary>Edit recipient / address / instruction</summary>
            <div class="kr-pb-grid">
              <label style="font-size:0.72rem;font-weight:600;">Name (3–64)<input class="kr-input" data-pb-name maxlength="64" value="${esc(r.recipientName)}" style="width:100%;margin-top:3px;"></label>
              <label style="font-size:0.72rem;font-weight:600;">Phone (01XXXXXXXXX)<input class="kr-input" data-pb-phone value="${esc(r.recipientPhone)}" style="width:100%;margin-top:3px;"></label>
              <label style="font-size:0.72rem;font-weight:600;grid-column:1/-1;">Address (sent to Pathao — include road, thana, district)<textarea class="kr-input" data-pb-address rows="2" maxlength="220" style="width:100%;margin-top:3px;font-family:inherit;">${esc(r.recipientAddress)}</textarea></label>
              <label style="font-size:0.72rem;font-weight:600;grid-column:1/-1;">Special instruction<textarea class="kr-input" data-pb-instr rows="2" maxlength="500" style="width:100%;margin-top:3px;font-family:inherit;">${esc(r.specialInstruction)}</textarea></label>
              <label style="font-size:0.72rem;font-weight:600;">Item description<input class="kr-input" data-pb-desc maxlength="250" value="${esc(r.itemDescription)}" style="width:100%;margin-top:3px;"></label>
              <label style="font-size:0.72rem;font-weight:600;">Qty<input class="kr-input" data-pb-qty type="number" min="1" value="${Number(r.itemQuantity)||1}" style="width:100%;margin-top:3px;"></label>
            </div>
          </details>`}
        </td>
        <td style="min-width:150px;">
          ${skip?'':`<label style="font-size:0.72rem;font-weight:600;">COD to collect (৳)<input class="kr-input" data-pb-cod type="number" min="0" value="${Number(r.amountToCollect)||0}" style="width:100%;margin-top:3px;font-weight:700;"></label>
          <div class="kr-pb-meta">${esc(r.paymentMethod)} · total ${krFmtMoney(r.totalPayable)}${r.deliveryCharge?` · incl. delivery ${krFmtMoney(r.deliveryCharge)}`:''}</div>
          <label style="font-size:0.72rem;font-weight:600;display:block;margin-top:6px;">Weight (kg)<input class="kr-input" data-pb-weight type="number" step="0.1" min="0.1" max="50" value="${Number(r.weightVal)||0.5}" style="width:100%;margin-top:3px;"></label>
          <div class="kr-pb-meta" data-pb-price></div>`}
          <div data-pb-result></div>
        </td>
      </tr>`;
    }).join('');
    PB.rows.forEach((r,i)=>{ const tr=rowsEl.querySelector(`tr[data-i="${i}"]`); const st=rowState(r); if(!tr||!(bookable(st)||st==='needs')) return; mountSelects(tr,r,i); tr.querySelector('[data-pb-address]')?.addEventListener('input',()=>{ r.recipientAddress=tr.querySelector('[data-pb-address]').value; mark(tr,r); }); });
    summary();
  }
  function mountSelects(tr,r,i){
    const cityHost=tr.querySelector('[data-pb-city]'), zoneHost=tr.querySelector('[data-pb-zone]'), areaHost=tr.querySelector('[data-pb-area]');
    const cityOpts=PB.cities.map(c=>({value:String(c.city_id),label:c.city_name}));
    const w={};
    w.city=krSearchSelect({container:cityHost,options:cityOpts,value:String(r.cityId||''),placeholder:'City (auto)',searchPlaceholder:'Search city…',allowClear:true,onSelect:async v=>{ r.touched=true; r.cityId=v; r.cityName=w.city.getLabel(); r.zoneId=''; r.zoneName=''; r.areaId=''; r.areaName=''; w.zone.setOptions([]); w.area.setOptions([]); w.area.setPlaceholder('Area (optional)'); if(!v){ w.zone.setPlaceholder('Zone'); w.zone.setDisabled(true); mark(tr,r); return; } w.zone.setPlaceholder('Loading zones…'); try{ const zs=await loadZones(v); w.zone.setOptions(zs.map(z=>({value:String(z.zone_id),label:z.zone_name}))); w.zone.setPlaceholder('Zone *'); w.zone.setDisabled(false);}catch(e){krToast(e.message,'error');} mark(tr,r); }});
    w.zone=krSearchSelect({container:zoneHost,options:[],value:'',placeholder:r.zoneId?'…':'Zone',searchPlaceholder:'Search zone / thana…',disabled:!r.cityId,onSelect:async v=>{ r.touched=true; r.zoneId=v; r.zoneName=w.zone.getLabel(); r.areaId=''; r.areaName=''; w.area.setOptions([]); w.area.setPlaceholder('Loading areas…'); try{ const as=await loadAreas(v); w.area.setOptions(as.map(a=>({value:String(a.area_id),label:a.area_name}))); w.area.setPlaceholder(as.length?'Area (optional)':'No areas'); w.area.setDisabled(!as.length);}catch(_){ } mark(tr,r); price(tr,r); }});
    w.area=krSearchSelect({container:areaHost,options:[],value:'',placeholder:'Area (optional)',searchPlaceholder:'Search area…',disabled:!r.zoneId,allowClear:true,onSelect:v=>{ r.areaId=v; r.areaName=w.area.getLabel(); }});
    PB.widgets[i]=w;
    if(r.cityId){ loadZones(r.cityId).then(zs=>{ w.zone.setOptions(zs.map(z=>({value:String(z.zone_id),label:z.zone_name}))); w.zone.setValue(String(r.zoneId||'')); w.zone.setPlaceholder('Zone *'); w.zone.setDisabled(false); if(r.zoneId){ loadAreas(r.zoneId).then(as=>{ w.area.setOptions(as.map(a=>({value:String(a.area_id),label:a.area_name}))); w.area.setValue(String(r.areaId||'')); w.area.setPlaceholder(as.length?'Area (optional)':'No areas'); w.area.setDisabled(!as.length); }); price(tr,r); } }).catch(()=>{}); }
    tr.querySelector('[data-pb-weight]')?.addEventListener('change',()=>price(tr,r));
  }
  function mark(tr,r){ const st=rowState(r); tr.classList.toggle('is-error',st==='needs'); tr.classList.toggle('is-auto',st==='auto'); const line=tr.querySelector('[data-pb-confline]'); if(line&&(st==='auto'||st==='needs'||st==='ready')){ const conf=st==='auto'?'auto':(r.touched?'high':(r.source==='learned'?'learned':(r.confidence||'none'))); line.innerHTML=`<span class="kr-pb-conf ${conf}">${st==='auto'?'Pathao auto-detect':st==='needs'?'not mapped':(r.touched?'manual ✓':conf==='learned'?'learned ✓':conf+' match')}</span> ${st==='auto'?'city/zone will be detected by Pathao from the full address (or pick manually)':st==='needs'?'<b style="color:#B91C1C">— pick city &amp; zone'+(PB.settings.addressMode==='manual'?' (manual mode)':' or write a fuller address')+'</b>':''}`; } summary(); }
  async function price(tr,r){ const el=tr.querySelector('[data-pb-price]'); if(!el||!r.cityId||!r.zoneId) return; el.textContent='Delivery fee: …'; try{ const w=Number(tr.querySelector('[data-pb-weight]')?.value)||0.5; const res=await krAdminFetch('/api/admin/pathao/price',{method:'POST',body:JSON.stringify({cityId:r.cityId,zoneId:r.zoneId,weight:w})}); el.textContent=res.ok?`Pathao fee ≈ ৳${res.price.final_price??res.price.price} (${w} kg)`:''; }catch(_){ el.textContent=''; } }
  function summary(){ const ready=PB.rows.filter(r=>bookable(rowState(r))).length, auto=PB.rows.filter(r=>rowState(r)==='auto').length, needs=PB.rows.filter(r=>rowState(r)==='needs').length, done=PB.rows.filter(r=>rowState(r)==='booked').length; document.getElementById('pbSummary').innerHTML=`<b>${ready}</b> ready${auto?` (${auto} via Pathao auto-address)`:''} · <b style="color:${needs?'#DC2626':'inherit'}">${needs}</b> need city/zone · ${done} already booked`; const btn=document.getElementById('pbBookBtn'); btn.disabled=!ready||!PB.settings.enabled||!PB.settings.storeId; btn.textContent=ready?`Book ${ready} parcel${ready>1?'s':''}`:'Book all'; }
  async function bookAll(){
    const btn=this, rowsEl=document.getElementById('pbRows'); const payload=[];
    PB.rows.forEach((r,i)=>{ const tr=rowsEl.querySelector(`tr[data-i="${i}"]`); const st=rowState(r); if(!tr||!bookable(st)) return; if(!tr.querySelector('[data-pb-sel]')?.checked) return;
      payload.push({ orderId:r.orderId, autoAddress:st==='auto', cityId:st==='auto'?null:r.cityId, cityName:r.cityName, zoneId:st==='auto'?null:r.zoneId, zoneName:r.zoneName, areaId:st==='auto'?null:(r.areaId||null), areaName:r.areaName||'',
        recipientName:tr.querySelector('[data-pb-name]').value.trim(), recipientPhone:tr.querySelector('[data-pb-phone]').value.trim(), recipientAddress:tr.querySelector('[data-pb-address]').value.trim(),
        specialInstruction:tr.querySelector('[data-pb-instr]').value.trim(), itemDescription:tr.querySelector('[data-pb-desc]').value.trim(), itemQuantity:Number(tr.querySelector('[data-pb-qty]').value)||1,
        amountToCollect:Number(tr.querySelector('[data-pb-cod]').value)||0, weight:Number(tr.querySelector('[data-pb-weight]').value)||0.5, remember:!!r.touched }); });
    if(!payload.length) return krToast('Nothing selected to book','warning');
    if(!confirm(`Create ${payload.length} Pathao parcel(s) now (${String(PB.settings.mode).toUpperCase()} mode)?\n\nLocal status will become "Shipped"; Pathao events will update it afterwards.`)) return;
    btn.disabled=true; btn.textContent='Booking…'; document.getElementById('pbRefreshBtn').disabled=true;
    try{
      const res=await krAdminFetch('/api/admin/pathao/book-batch',{method:'POST',body:JSON.stringify({orders:payload})});
      if(!res.ok) throw new Error(res.error||'Batch failed');
      res.results.forEach(x=>{ const idx=PB.rows.findIndex(r=>r.orderId===x.orderId); if(idx<0) return; const r=PB.rows[idx]; const tr=rowsEl.querySelector(`tr[data-i="${idx}"]`); const out=tr.querySelector('[data-pb-result]');
        if(x.ok){ r.alreadyBooked=true; r.consignmentId=x.consignmentId; tr.classList.add('is-done'); tr.classList.remove('is-error','is-auto'); out.innerHTML=`<div class="kr-pb-ok">✓ ${x.alreadyBooked?'Already':'Booked'} → <a href="${krTrackingUrl(x.consignmentId)}" target="_blank" rel="noopener">${esc(x.consignmentId)}</a>${x.deliveryFee?` · fee ৳${x.deliveryFee}`:''}${x.autoAddress?' · zone by Pathao':''}</div>`; }
        else { tr.classList.add('is-error'); out.innerHTML=`<div class="kr-pb-err">✕ ${esc(x.error)}</div>`; } });
      krToast(`Pathao: ${res.booked} booked, ${res.failed} failed, ${res.skipped} already`, res.failed?'warning':'success');
      summary(); try { await (hooks().afterBook||(()=>{}))(res); } catch(_) {}
    }catch(e){ krToast(e.message,'error'); }
    finally{ btn.disabled=false; document.getElementById('pbRefreshBtn').disabled=false; summary(); }
  }

  /* ── Status sync ── */
  window.syncPathao=async function(ids){ const body=ids&&ids.length?{orderIds:ids}:{all:true}; krToast('Syncing with Pathao…','info'); try{ const r=await krAdminFetch('/api/admin/pathao/sync-status',{method:'POST',body:JSON.stringify(body)}); if(!r.ok) throw new Error(r.error||'Sync failed'); const changed=r.results.filter(x=>x.ok&&!x.unchanged).length, failed=r.results.filter(x=>!x.ok); krToast(`Synced ${r.results.length} shipment(s) · ${changed} updated${failed.length?` · ${failed.length} failed`:''}`, failed.length?'warning':'success'); if(failed.length) console.warn('[Pathao sync]',failed); try { await (hooks().afterSync||(()=>{}))(r); } catch(_) {} return r; }catch(e){ krToast(e.message,'error'); } };
  window.openPathaoBooking = id => openPathaoBatch([id]);

  /* ── Bulk CSV (Pathao official import template) ──
     Column names/order come from Pathao's own sample file. City/Zone/Area are Pathao's names
     (resolved server-side) — the importer rejects site district names like "Chattogram". */
  const CSV_HEADER = ['ItemType','StoreName','MerchantOrderId','RecipientName(*)','RecipientPhone(*)','RecipientAddress(*)','RecipientCity(*)','RecipientZone(*)','RecipientArea','AmountToCollect(*)','ItemQuantity','ItemWeight','ItemDesc','SpecialInstruction'];
  const CSV_ARCHIVE_KEY='kr_csv_archive_v1';
  const getArchive=()=>{try{return JSON.parse(localStorage.getItem(CSV_ARCHIVE_KEY)||'[]')}catch(e){return[]}};
  const saveArchive=a=>{try{localStorage.setItem(CSV_ARCHIVE_KEY, JSON.stringify(a))}catch(e){krToast('Archive full (storage)','warning')}};
  /* Pathao's importer chokes on 4-byte UTF-8 (emoji / 𖹭); Bangla itself is BMP-safe. */
  const bmpSafe=v=>String(v==null?'':v).replace(/[\u{10000}-\u{10FFFF}]/gu,'');
  const cell=v=>{ const s=bmpSafe(v).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/\s+/g,' ').trim(); return /[",]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  window.krPathaoCsv = async function(orderIds){
    mount();
    const ids=[...new Set(orderIds||[])]; if(!ids.length) return krToast('Select orders first (checkbox)','warning');
    krToast('Preparing Pathao CSV for '+ids.length+' order(s)…','info');
    try{
      const r=await krAdminFetch('/api/admin/pathao/csv-rows',{method:'POST',body:JSON.stringify({orderIds:ids})});
      if(!r.ok) throw new Error(r.error||'CSV rows failed');
      const skipped=r.rows.filter(x=>x.alreadyBooked).map(x=>x.orderId), unmapped=r.rows.filter(x=>!x.alreadyBooked&&(!x.city||!x.zone)).map(x=>x.orderId);
      const rows=[CSV_HEADER.join(',')];
      r.rows.filter(x=>!x.alreadyBooked).forEach(x=>rows.push([x.itemType,x.storeName,x.orderId,x.recipientName,x.recipientPhone,x.recipientAddress,x.city,x.zone,x.area,x.amountToCollect,x.itemQuantity,x.itemWeight,x.itemDesc,x.specialInstruction].map(cell).join(',')));
      if(skipped.length) krToast(`Skipped ${skipped.length} already booked via API: ${skipped.join(', ')}`,'warning',6000);
      if(unmapped.length) krToast(`⚠ ${unmapped.length} row(s) have no Pathao city/zone (${unmapped.join(', ')}) — fill RecipientCity/Zone in the file or use "Send to Pathao" (auto-address)`,'warning',9000);
      if(rows.length===1){ krToast('Nothing to export','warning'); return; }
      const csv='\uFEFF'+rows.join('\r\n');
      const d=new Date(), p2=n=>String(n).padStart(2,'0');
      const fname=`kora_pathao_${d.getFullYear()}${p2(d.getMonth()+1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.csv`;
      const arch=getArchive(); arch.unshift({ id:Date.now().toString(), name:fname, createdAt:Date.now(), count:rows.length-1, csv }); saveArchive(arch.slice(0,40));
      const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=fname; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),3000);
      krToast(`CSV generated (${rows.length-1} orders, ${r.mode} store names) & saved to archive`,'success');
    }catch(e){ krToast(e.message,'error'); }
  };
  window.krPathaoCsvArchive = function(){
    mount();
    const el=document.getElementById('krCsvArchiveList'); const arch=getArchive();
    document.getElementById('krCsvArchiveModal').style.display='flex';
    if(!arch.length){ el.innerHTML='<div class="kr-empty">No CSV files yet.</div>'; return; }
    el.innerHTML=arch.map(f=>`<div style="border:1px solid var(--border-subtle);border-radius:var(--radius-md);padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="min-width:0;"><div style="font-family:'Outfit',sans-serif;font-weight:600;font-size:0.84rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(f.name)}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">${new Date(f.createdAt).toLocaleString('en-BD')} · ${f.count} orders</div></div>
        <div style="display:flex;gap:6px;flex-shrink:0;"><button class="kr-btn kr-btn-ghost kr-btn-sm" data-dl="${f.id}">Download</button><button class="kr-btn kr-btn-danger kr-btn-sm" data-del="${f.id}">Delete</button></div></div>`).join('');
    el.querySelectorAll('[data-dl]').forEach(b=>b.onclick=()=>{const f=arch.find(x=>x.id===b.dataset.dl);if(!f)return;const blob=new Blob([f.csv],{type:'text/csv;charset=utf-8;'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);});
    el.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{saveArchive(getArchive().filter(x=>x.id!==b.dataset.del));krPathaoCsvArchive();});
  };
})();
