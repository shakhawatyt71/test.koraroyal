/* KORA ROYAL — tracking, cancellation and service requests */
(function(){'use strict';const WORKER='https://kora-api.shakhawatyt77.workers.dev',STEPS=[['pending','📋','Order Placed','অর্ডার গৃহীত'],['confirmed','✅','Confirmed','অর্ডার নিশ্চিত'],['packing','📦','Packing','প্যাকিং চলছে'],['packed','🎁','Packed','প্যাক সম্পন্ন'],['shipped','🚚','Shipped','পাঠানো হয়েছে'],['delivered','🏠','Delivered','পৌঁছে গেছে']],RANK=Object.fromEntries(STEPS.map((s,i)=>[s[0],i]));let lang='en',current=null;const $=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function theme(t){document.documentElement.dataset.theme=t;localStorage.setItem('kr_theme',t);$('krLogo').src=t==='dark'?'https://res.cloudinary.com/dvvgofrhs/image/upload/v1776146561/Picsart_26-04-14_12-01-21-890_d8icez.png':'https://res.cloudinary.com/dvvgofrhs/image/upload/v1776146557/Picsart_26-04-14_11-59-56-382_ueiofu.png'}function language(v){lang=v;document.documentElement.dataset.lang=v;localStorage.setItem('kr_lang',v);$('krLangBtn').textContent=v==='en'?'বাংলা':'English';if(current)render(current)}function date(ts){return ts?new Date(ts).toLocaleString('en-BD',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}):''}function loading(v){$('krTrackBtn').classList.toggle('loading',v);$('krTrackBtn').disabled=v}function error(m){$('krErrorTxt').textContent=m;$('krTrackError').classList.add('show')}function clearError(){$('krTrackError').classList.remove('show')}function pill(s){const c={pending:'#F59E0B',confirmed:'#3B82F6',packing:'#8B5CF6',packed:'#06B6D4',shipped:'#10B981',delivered:'#22C55E',partial_delivered:'#84CC16',delivery_failed:'#F97316',returned:'#EF4444',exchanged:'#0EA5E9',refunded:'#6B7280',cancelled_by_customer:'#EF4444',cancelled_by_seller:'#DC2626'}[s]||'#717777';return `<span style="padding:5px 12px;border-radius:99px;background:${c}15;color:${c};font:700 .78rem Outfit">${esc(s.replaceAll('_',' '))}</span>`}function render(data){current=data;const cancelled=String(data.status).startsWith('cancelled');$('krResultHeader').innerHTML=`<div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><small>${lang==='bn'?'অর্ডার আইডি':'ORDER ID'}</small><div class="kr-order-id">${esc(data.orderId)}</div><div class="kr-order-meta">${date(data.createdAt)}</div>${data.customer?.name?`<div>${esc(data.customer.name)} · ${esc(data.customer.district||'')}</div>`:''}</div>${pill(data.status)}</div>`;if(cancelled)$('krSteps').innerHTML=`<div class="kr-step is-cancelled"><div class="kr-step-dot">❌</div><div class="kr-step-info"><div class="kr-step-label">${lang==='bn'?'অর্ডার বাতিল':'Order Cancelled'}</div><div class="kr-step-note">${esc(data.cancelReason||'')}</div></div></div>`;else{const AFTER={partial_delivered:['🏠','Partially Delivered','আংশিক ডেলিভারি'],delivery_failed:['⚠️','Delivery Failed','ডেলিভারি ব্যর্থ'],returned:['↩️','Returned','ফেরত এসেছে'],exchanged:['🔁','Exchanged','এক্সচেঞ্জ হয়েছে'],refunded:['💸','Refunded','রিফান্ড হয়েছে']}[data.status];const cur=AFTER?(RANK[(data.statusHistory||[]).some(h=>h.status==='delivered')?'delivered':'shipped']):(RANK[data.status]??0);$('krSteps').innerHTML=STEPS.map((s,i)=>`<div class="kr-step ${i<cur||(data.status==='delivered'||AFTER)&&i===cur?'is-done':i===cur?'is-active':''}"><div class="kr-step-dot"><span class="kr-step-emoji">${s[1]}</span><svg class="kr-step-done-icon" width="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div class="kr-step-info"><div class="kr-step-label">${lang==='bn'?s[3]:s[2]}</div>${(data.statusHistory||[]).find(h=>h.status===s[0])?`<div class="kr-step-time">${date((data.statusHistory||[]).find(h=>h.status===s[0]).time)}</div>`:''}</div></div>`).join('')+(AFTER?`<div class="kr-step is-active is-after"><div class="kr-step-dot"><span class="kr-step-emoji">${AFTER[0]}</span></div><div class="kr-step-info"><div class="kr-step-label">${lang==='bn'?AFTER[2]:AFTER[1]}</div>${(data.statusHistory||[]).slice().reverse().find(h=>h.status===data.status)?`<div class="kr-step-time">${date((data.statusHistory||[]).slice().reverse().find(h=>h.status===data.status).time)}</div>`:''}</div></div>`:'')}const courier=data.courier&&data.courier.consignmentId?`<div style="margin-top:8px;font-size:.8rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span>${lang==='bn'?'কুরিয়ার (Pathao)':'Courier (Pathao)'}: <b>${esc(data.courier.consignmentId)}</b> · ${esc(String(data.courier.status||'').replaceAll('_',' '))}</span><a href="${esc(data.courier.trackingUrl)}" target="_blank" rel="noopener" style="color:var(--brand-coral);font-weight:700;text-decoration:underline">${lang==='bn'?'Pathao-তে ট্র্যাক করুন ↗':'Track on Pathao ↗'}</a></div>`:'';$('krStatusInfo').innerHTML=`<div style="font-size:.85rem;line-height:1.6">${lang==='bn'?statusBn(data.status):statusEn(data.status)}${courier}</div>`;renderActions(data);renderRequests(data.requests||[]);$('krResult').classList.add('show')}function statusEn(s){return({pending:'Your order is waiting for review.',confirmed:'Your order is confirmed.',packing:'Your order is being packed.',packed:'Your order is packed.',shipped:'Your order is on the way.',delivered:'Your order was delivered.',partial_delivered:'Part of your order was delivered. We will contact you about the rest.',delivery_failed:'Delivery attempt failed. The courier will retry or we will call you.',returned:'The parcel was returned to us.',exchanged:'Your order was exchanged.',refunded:'Your refund has been processed.',cancelled_by_customer:'You cancelled this order.',cancelled_by_seller:'The seller cancelled this order.'})[s]||s}function statusBn(s){return({pending:'আপনার অর্ডার রিভিউয়ের অপেক্ষায় আছে।',confirmed:'আপনার অর্ডার নিশ্চিত হয়েছে।',packing:'আপনার অর্ডার প্যাক করা হচ্ছে।',packed:'আপনার অর্ডার প্যাক হয়েছে।',shipped:'আপনার অর্ডার রাস্তায় আছে।',delivered:'আপনার অর্ডার পৌঁছে গেছে।',partial_delivered:'আপনার অর্ডারের একটি অংশ ডেলিভারি হয়েছে। বাকিটা নিয়ে আমরা যোগাযোগ করব।',delivery_failed:'ডেলিভারির চেষ্টা ব্যর্থ হয়েছে। কুরিয়ার আবার চেষ্টা করবে অথবা আমরা কল করব।',returned:'পার্সেলটি আমাদের কাছে ফেরত এসেছে।',exchanged:'আপনার অর্ডারটি এক্সচেঞ্জ করা হয়েছে।',refunded:'আপনার রিফান্ড সম্পন্ন হয়েছে।',cancelled_by_customer:'আপনি অর্ডার বাতিল করেছেন।',cancelled_by_seller:'বিক্রেতা অর্ডার বাতিল করেছেন।'})[s]||s}function renderActions(d){
  const cancel=Number(d.cancelDeadline)>Date.now()&&!['shipped','delivered','partial_delivered','delivery_failed','returned','exchanged','refunded'].includes(d.status)&&!String(d.status).startsWith('cancelled'),delivered=d.status==='delivered'||d.status==='partial_delivered';
  $('krTrackActions').innerHTML=`
    ${cancel?`<button class="kr-track-action is-danger" data-track-cancel>${lang==='bn'?'অর্ডার বাতিল করুন':'Cancel Order'}</button>`:''}
    <button class="kr-track-action" data-invoice-download style="background-color: var(--brand-butter); color: var(--text-primary); border-color: var(--brand-butter); font-weight: 700;">${lang==='bn'?'ইনভয়েস ডাউনলোড 📄':'Download Invoice 📄'}</button>
    ${delivered?`<button class="kr-track-action is-primary" data-request="return">${lang==='bn'?'রিটার্ন রিকোয়েস্ট':'Request Return'}</button><button class="kr-track-action" data-request="refund">${lang==='bn'?'রিফান্ড রিকোয়েস্ট':'Request Refund'}</button><button class="kr-track-action" data-request="exchange">${lang==='bn'?'এক্সচেঞ্জ রিকোয়েস্ট':'Request Exchange'}</button>`:''}
  `;
}function renderRequests(list){$('krRequestHistory').innerHTML=list.length?list.map(r=>`<div class="kr-request-row"><b>${esc(r.request_type.toUpperCase())}</b> · ${esc(r.status)}<div>${esc(r.reason)}</div><small>${date(r.created_at)}</small></div>`).join(''):''}async function track(){const id=$('krOrderInput').value.trim().toUpperCase();if(!id)return error(lang==='bn'?'অর্ডার আইডি লিখুন':'Enter Order ID');loading(true);clearError();try{const r=await fetch(`${WORKER}/api/track?id=${encodeURIComponent(id)}`,{cache:'no-store'}),j=await r.json();if(!r.ok||!j.ok)throw new Error(j.error);render(j)}catch(e){error(lang==='bn'?'অর্ডার পাওয়া যায়নি':'Order not found or connection failed')}finally{loading(false)}}function ensureModal(){let m=$('krRequestModal');if(m)return m;m=document.createElement('div');m.id='krRequestModal';m.className='kr-request-modal';m.innerHTML='<div class="kr-request-box" id="krRequestBox"></div>';document.body.appendChild(m);m.onclick=e=>{if(e.target===m)closeModal()};return m}function closeModal(){const m=$('krRequestModal');m?.classList.remove('is-open');document.body.style.overflow=''}function openCancel(){const m=ensureModal(),box=$('krRequestBox');box.innerHTML=`<h3>${lang==='bn'?'অর্ডার বাতিল':'Cancel Order'}</h3><label>${lang==='bn'?'কারণ':'Reason'}<select id="cancelReason"><option>Ordered by mistake</option><option>Changed my mind</option><option>Wrong item/size/color selected</option><option>Other</option></select></label><label>${lang==='bn'?'নোট':'Note'}<textarea id="cancelNote" rows="3"></textarea></label><div class="kr-request-actions"><button class="kr-track-action" data-modal-close>${lang==='bn'?'রাখুন':'Keep Order'}</button><button class="kr-track-action is-danger" id="cancelSubmit">${lang==='bn'?'বাতিল নিশ্চিত করুন':'Confirm Cancel'}</button></div>`;m.classList.add('is-open');document.body.style.overflow='hidden';$('cancelSubmit').onclick=async function(){this.disabled=true;try{const r=await fetch(`${WORKER}/api/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:current.orderId,reason:$('cancelReason').value,reasonNote:$('cancelNote').value})}),j=await r.json();if(!j.ok)throw new Error(j.error);closeModal();window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'order_cancelled',transaction_id:current.orderId,cancel_reason:$('cancelReason').value,cancel_event_id:Date.now().toString(),value:current.totals?.totalPayable||0,currency:'BDT'});await track()}catch(e){alert(e.message)}finally{this.disabled=false}}}function openRequest(type){const m=ensureModal(),box=$('krRequestBox'),days=current.requestWindows?.[type]??7;box.innerHTML=`<h3>${type.toUpperCase()} Request</h3><p>${lang==='bn'?`ডেলিভারির ${days} দিনের মধ্যে রিকোয়েস্ট করা যাবে।`:`Available within ${days} days of delivery.`}</p><label>${lang==='bn'?'অর্ডারের ফোন নম্বর':'Order phone number'}<input id="reqPhone" inputmode="tel" placeholder="01XXXXXXXXX"></label><div>${(current.items||[]).map(i=>`<label class="kr-request-item"><input type="checkbox" data-request-item="${i.id}" data-max="${i.quantity}" checked><span>${esc(i.productName)} [${esc(i.sku||'')}]</span> <input class="kr-request-qty" type="number" min="1" max="${i.quantity}" value="${i.quantity}" data-item-qty="${i.id}" style="width:64px;padding:4px 6px;border:1.5px solid var(--border-input,#ccc);border-radius:8px;" aria-label="Quantity for ${esc(i.productName)}"> <small>/ ${i.quantity}</small></label>`).join('')}</div><label>${lang==='bn'?'কারণ':'Reason'}<select id="reqReason"><option value="Product issue">Product issue</option><option value="Wrong size/item">Wrong size/item</option><option value="Changed mind">Changed mind</option><option value="Other">Other</option></select></label><label>${lang==='bn'?'বিস্তারিত':'Details'}<textarea id="reqNote" rows="4"></textarea></label><div class="kr-request-actions"><button class="kr-track-action" data-modal-close>${lang==='bn'?'বন্ধ করুন':'Close'}</button><button class="kr-track-action is-primary" id="reqSubmit">${lang==='bn'?'রিকোয়েস্ট পাঠান':'Submit Request'}</button></div>`;m.classList.add('is-open');document.body.style.overflow='hidden';$('reqSubmit').onclick=async function(){const items=[...document.querySelectorAll('[data-request-item]:checked')].map(x=>{const id=Number(x.dataset.requestItem),max=Number(x.dataset.max);const qtyEl=document.querySelector(`[data-item-qty="${id}"]`);const q=qtyEl?Math.min(max,Math.max(1,Math.trunc(Number(qtyEl.value)||max))):max;return{orderItemId:id,quantity:q}});this.disabled=true;try{const r=await fetch(`${WORKER}/api/order/service-request`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:current.orderId,requestType:type,phone:$('reqPhone').value,reason:$('reqReason').value,note:$('reqNote').value,items,idempotencyKey:`${current.orderId}:${type}:${Date.now()}`})}),j=await r.json();if(!j.ok)throw new Error(j.error);closeModal();window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'service_request_submitted',request_type:type,order_id:current.orderId,request_id:j.request?.id||'',reason:$('reqReason').value,currency:'BDT',value:0});await track();alert(lang==='bn'?`রিকোয়েস্ট পাঠানো হয়েছে: ${j.request.id}`:`Request submitted: ${j.request.id}`)}catch(e){alert(e.message)}finally{this.disabled=false}}}document.addEventListener('click',e=>{
  if(e.target.closest('[data-track-cancel]'))openCancel();
  if(e.target.closest('[data-invoice-download]')) downloadCustomerInvoice(current.orderId);
  const r=e.target.closest('[data-request]');
  if(r)openRequest(r.dataset.request);
  if(e.target.closest('[data-modal-close]'))closeModal()
});function init(){theme(localStorage.getItem('kr_theme')||'light');language(localStorage.getItem('kr_lang')||'en');$('krThemeBtn').onclick=()=>theme(document.documentElement.dataset.theme==='dark'?'light':'dark');$('krLangBtn').onclick=()=>language(lang==='en'?'bn':'en');const q=new URLSearchParams(location.search).get('id');let last={};try{last=JSON.parse(localStorage.getItem('kr_last_order')||'{}')}catch{}$('krOrderInput').value=(q||last.orderId||'').toUpperCase();$('krTrackBtn').onclick=track;$('krOrderInput').onkeydown=e=>{if(e.key==='Enter')track()};$('krOrderInput').oninput=function(){this.value=this.value.toUpperCase();clearError()};$('krSearchAgain').onclick=()=>{$('krResult').classList.remove('show');$('krOrderInput').value='';$('krOrderInput').focus()};if(q)setTimeout(track,250)}
async function downloadCustomerInvoice(orderId) {
  /* ফোন-ভেরিফাইড ইনভয়েস — লোকাল কপি থেকে ফোন নিই, না পেলে জিজ্ঞেস করি */
  let phone = '';
  try { const lo = JSON.parse(localStorage.getItem('kr_last_order') || 'null'); if (lo && lo.orderId === orderId && lo.customer && lo.customer.phone) phone = lo.customer.phone; } catch {}
  if (!phone) {
    phone = (prompt(lang === 'bn'
      ? 'ইনভয়েস যাচাইয়ের জন্য অর্ডারে দেওয়া ফোন নম্বরটি লিখুন (01XXXXXXXXX)'
      : 'Enter the phone number used in this order (01XXXXXXXXX)', '') || '').trim();
    if (!phone) return;
  }
  try {
    const res = await fetch(`${WORKER}/api/order/invoice/request?orderId=${encodeURIComponent(orderId)}&phone=${encodeURIComponent(phone)}`, { cache: 'no-store' });
    const data = await res.json();
    
    if (!res.ok || !data.ok) {
      if (data.rateLimitTriggered) {
        const h = Math.floor(data.remaining / 3600000);
        const m = Math.floor((data.remaining % 3600000) / 60000);
        const timeStr = lang === 'bn' ? `${h} ঘণ্টা ${m} মিনিট` : `${h} hour(s) ${m} minute(s)`;
        alert(lang === 'bn' 
          ? `আপনি ২৪ ঘণ্টায় একবার ইনভয়েস ডাউনলোড করতে পারবেন। আবার ডাউনলোড করতে দয়া করে ${timeStr} অপেক্ষা করুন।`
          : `You can download the invoice once every 24 hours. Please wait ${timeStr} before requesting again.`
        );
      } else {
        throw new Error(data.error || 'Failed to request invoice');
      }
      return;
    }
    
    const o = data.order;
    const c = o.customer || {};
    const t = o.totals || {};
    const p = o.payment || {};
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Header
    doc.setFillColor(18, 19, 19);
    doc.rect(0, 0, 210, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(22);
    doc.text("KORA ROYAL", 15, 25);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "normal");
    doc.text("Store Order Invoice", 15, 32);
    doc.setFontSize(20);
    doc.setFont("Helvetica", "bold");
    doc.text("INVOICE", 150, 25);
    
    // Details
    doc.setTextColor(58, 61, 61);
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text(`Order ID:`, 15, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(o.orderId, 36, 55);
    doc.setFont("Helvetica", "bold");
    doc.text(`Date:`, 15, 62);
    doc.setFont("Helvetica", "normal");
    doc.text(new Date(o.createdAt).toLocaleString('en-BD'), 36, 62);
    
    // Customer
    doc.setDrawColor(224, 217, 207);
    doc.rect(110, 48, 85, 35);
    doc.setFont("Helvetica", "bold");
    doc.text("BILLED TO:", 115, 55);
    doc.setFont("Helvetica", "normal");
    doc.text(c.name || '', 115, 62);
    doc.text(c.phone || '', 115, 68);
    doc.text(c.district || '', 115, 74);
    const splitAddress = doc.splitTextToSize(c.address || '', 75);
    doc.text(splitAddress, 115, 80);
    
    // Items
    let y = 95;
    doc.setFillColor(255, 96, 68);
    doc.rect(15, y, 180, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("Helvetica", "bold");
    doc.text("Product Description", 18, y + 6);
    doc.text("Qty", 120, y + 6);
    doc.text("Price", 145, y + 6);
    doc.text("Total", 175, y + 6);
    y += 8;
    
    doc.setTextColor(18, 19, 19);
    doc.setFont("Helvetica", "normal");
    (o.items || []).forEach(item => {
      doc.text(item.productName, 18, y + 6);
      const skuStr = item.sku ? `[${item.sku}]` : '';
      const optStr = (item.options || []).map(x=>`${x.label_en}:${x.value_en}`).join(' / ');
      doc.setFontSize(8);
      doc.setTextColor(113, 119, 119);
      doc.text(`${skuStr} ${optStr}`, 18, y + 10);
      doc.setFontSize(10);
      doc.setTextColor(18, 19, 19);
      
      doc.text(String(item.quantity), 122, y + 6);
      doc.text(`BDT ${item.unitPrice}`, 145, y + 6);
      doc.text(`BDT ${item.lineTotal}`, 175, y + 6);
      y += 12;
    });
    
    y += 5;
    doc.line(15, y, 195, y);
    y += 7;
    
    doc.text("Subtotal:", 135, y);
    doc.text(`BDT ${t.subtotal || 0}`, 175, y);
    y += 6;
    doc.text("Delivery Charge:", 135, y);
    doc.text(`BDT ${t.delivery || 0}`, 175, y);
    y += 6;
    if (t.discountAmt > 0) {
      doc.text(`Discount (${o.couponCode || ''}):`, 135, y);
      doc.text(`-BDT ${t.discountAmt}`, 175, y);
      y += 6;
    }
    doc.setFont("Helvetica", "bold");
    doc.setTextColor(255, 96, 68);
    doc.text("Total Payable:", 135, y);
    doc.text(`BDT ${t.totalPayable || 0}`, 175, y);
    y += 6;
    
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(18, 19, 19);
    if (p.advance > 0) {
      doc.text("Advance Paid:", 135, y);
      doc.text(`BDT ${p.advance}`, 175, y);
      y += 6;
      doc.setFont("Helvetica", "bold");
      doc.text("Remaining (COD Due):", 135, y);
      doc.text(`BDT ${t.codRemaining || 0}`, 175, y);
      y += 6;
    }
    
    doc.line(15, 255, 195, 255);
    doc.setFontSize(9);
    doc.setFont("Helvetica", "normal");
    doc.setTextColor(113, 119, 119);
    doc.text("Thank you for shopping with KORA ROYAL!", 15, 262);
    doc.text("For returns or support, please check policy details on our website or contact us via WhatsApp.", 15, 267);
    doc.text("This is an electronically generated document. No signature required.", 15, 272);
    
    doc.save(`invoice_${orderId}.pdf`);
  } catch (err) {
    alert(err.message);
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init()})();