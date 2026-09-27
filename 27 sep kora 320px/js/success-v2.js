/* KORA ROYAL — authoritative D1 order receipt / cancellation */
(function(){
'use strict';
const WORKER='https://kora-api.shakhawatyt77.workers.dev';let order=null,cancelTimer=null,lang='en';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>'৳'+Number(n||0).toLocaleString('en-BD');
function setTheme(t){document.documentElement.dataset.theme=t;localStorage.setItem('kr_theme',t);const a=document.querySelector('#krThemeToggle .icon-light'),b=document.querySelector('#krThemeToggle .icon-dark');if(a)a.style.display=t==='light'?'block':'none';if(b)b.style.display=t==='dark'?'block':'none';const l=document.getElementById('krLogoLight'),d=document.getElementById('krLogoDark');if(l){l.src=KR.LOGOS.light;l.style.display=t==='light'?'block':'none'}if(d){d.src=KR.LOGOS.dark;d.style.display=t==='dark'?'block':'none'}}
function setLang(v){lang=v;document.documentElement.dataset.lang=v;localStorage.setItem('kr_lang',v);const b=document.getElementById('krLangToggle');if(b)b.textContent=v==='bn'?'ENG':'বাং';document.querySelectorAll('[data-en]').forEach(el=>{const x=el.getAttribute('data-'+v);if(x)el.textContent=x});if(order)render(order)}
function notify(title,body){const island=document.getElementById('kr-island');if(!island)return;document.getElementById('krIslandTitle').textContent=title;document.getElementById('krIslandBody').textContent=body;island.classList.add('is-visible');setTimeout(()=>island.classList.remove('is-visible'),4500)}
function fmtDate(ts){return ts?new Date(ts).toLocaleString('en-BD',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}):''}
function optionText(item){return (item.options||[]).map(o=>lang==='bn'?`${o.label_bn||o.label_en}: ${o.value_bn||o.value_en}`:`${o.label_en}: ${o.value_en}`).join(' · ')}
function showContent(){document.getElementById('krLoadingState').style.display='none';document.getElementById('krSuccessContent').hidden=false}
function showMissing(message){document.getElementById('krLoadingState').innerHTML=`<div style="text-align:center;padding:25px"><p style="font-weight:700;margin-bottom:9px">${esc(message)}</p><a href="track.html" class="kr-btn kr-btn--primary">${lang==='bn'?'অর্ডার ট্র্যাক করুন':'Track an order'}</a></div>`}
function updateHeadline(status){const title=document.querySelector('.kr-success-title'),sub=document.querySelector('.kr-success-subtitle');const confirmed=['confirmed','packing','packed','shipped','delivered'].includes(status);if(title)title.textContent=lang==='bn'?(confirmed?'অর্ডার নিশ্চিত হয়েছে!':'অর্ডার গ্রহণ করা হয়েছে!'):(confirmed?'Order Confirmed!':'Order Received!');if(sub)sub.textContent=lang==='bn'?'আপনার অর্ডারটি নিরাপদভাবে সংরক্ষিত হয়েছে। স্ট্যাটাস পরিবর্তন হলে Track Order-এ দেখতে পারবেন।':'Your order was saved securely. Follow future updates from Track Order.';}
function updateSteps(status){const steps=[...document.querySelectorAll('.kr-order-step')],connectors=[...document.querySelectorAll('.kr-step-connector')],map={pending:0,confirmed:1,packing:2,packed:2,shipped:3,delivered:4},idx=map[status]??0,cancelled=String(status).startsWith('cancelled');steps.forEach((el,i)=>{el.classList.remove('is-done','is-active');if(cancelled)return;if(i<idx||status==='delivered'&&i===idx)el.classList.add('is-done');else if(i===idx)el.classList.add('is-active')});connectors.forEach((el,i)=>el.classList.toggle('done',!cancelled&&i<idx));if(cancelled){steps[0]?.classList.add('is-active');const label=steps[0]?.querySelector('.kr-order-step-label');if(label)label.textContent=lang==='bn'?'অর্ডার বাতিল':'Order Cancelled'}}
function render(data){order=data;showContent();updateHeadline(data.status||'pending');updateSteps(data.status||'pending');const id=data.orderId||new URLSearchParams(location.search).get('id')||'';document.getElementById('krDisplayOrderId').textContent=id;const items=document.getElementById('krSuccessItems');if(items){const arr=data.items||[];items.innerHTML=arr.length?arr.map(i=>`<div class="kr-summary-item"><img class="kr-summary-item-img" src="${esc(i.imageUrl||'')}" alt="${esc(lang==='bn'?(i.productNameBn||i.productName):i.productName)}"><div class="kr-summary-item-info"><div class="kr-summary-item-name">${esc(lang==='bn'?(i.productNameBn||i.productName):i.productName)}</div><div class="kr-summary-item-meta">${esc(optionText(i)||i.sku||'—')} · x${Number(i.quantity||0)}</div></div><div class="kr-summary-item-price">${money(i.lineTotal??Number(i.unitPrice||0)*Number(i.quantity||0))}</div></div>`).join(''):`<div class="kr-summary-empty">${lang==='bn'?'পণ্যের বিস্তারিত Track Order-এ দেখুন':'See order progress from Track Order'}</div>`}
const totals=document.getElementById('krSuccessTotals'),t=data.totals;if(totals&&t){totals.innerHTML=`<div class="kr-summary-row"><span>${lang==='bn'?'সাবটোটাল':'Subtotal'}</span><b>${money(t.subtotal)}</b></div>${t.discountAmt?`<div class="kr-summary-row"><span>${lang==='bn'?'ছাড়':'Discount'} ${esc(data.couponCode||'')}</span><b>-${money(t.discountAmt)}</b></div>`:''}<div class="kr-summary-row"><span>${lang==='bn'?'ডেলিভারি':'Delivery'}</span><b>${t.delivery===0?(lang==='bn'?'ফ্রি':'Free'):money(t.delivery)}</b></div><div class="kr-summary-row kr-summary-row--total"><span>${lang==='bn'?'মোট':'Total'}</span><b>${money(t.totalPayable)}</b></div>${t.advance?`<div class="kr-summary-row"><span>${lang==='bn'?'এডভ্যান্স':'Advance'}</span><b>-${money(t.advance)}</b></div><div class="kr-summary-row"><span>${lang==='bn'?'বাকি':'COD due'}</span><b>${money(t.codRemaining)}</b></div>`:''}`}
const customer=document.getElementById('krSuccessCustomer'),c=data.customer;if(customer&&c){const rows=[[lang==='bn'?'নাম':'Name',c.name],[lang==='bn'?'ফোন':'Phone',c.phone],[lang==='bn'?'জেলা':'District',c.district],[lang==='bn'?'থানা/এলাকা':'Area',c.thana],[lang==='bn'?'ঠিকানা':'Address',c.address],[lang==='bn'?'পেমেন্ট':'Payment',data.payment?.method]];customer.innerHTML=rows.filter(x=>x[1]).map(x=>`<div class="kr-success-meta-row"><div class="kr-success-meta-label">${esc(x[0])}</div><div class="kr-success-meta-val">${esc(x[1])}</div></div>`).join('')}
const est=document.getElementById('krDeliveryEstText');if(est)est.textContent=lang==='bn'?'আনুমানিক ডেলিভারি: ৩-৫ কার্যদিবস':'Estimated delivery: 3–5 working days';const wa=document.getElementById('krSuccessWA');if(wa)wa.href=`https://wa.me/8801935158745?text=${encodeURIComponent(lang==='bn'?`আমার অর্ডার ${id} সম্পর্কে সাহায্য চাই`:`I need help with order ${id}`)}`;
initCancel(data);firePurchaseOnce(data);if(window.lucide)lucide.createIcons();}
function firePurchaseOnce(data){if(String(data.status).startsWith('cancelled')||!data.totals)return;const key=`kr_purchase_fired_${data.orderId}`;if(localStorage.getItem(key))return;if(typeof pushPurchase==='function'){pushPurchase({orderId:data.orderId,totals:data.totals,items:data.items||[],customer:data.customer||{},couponCode:data.couponCode||''});localStorage.setItem(key,'1')}}
async function refreshStatus(orderId){try{const r=await fetch(`${WORKER}/api/track?id=${encodeURIComponent(orderId)}`,{cache:'no-store'}),j=await r.json();if(j.ok){const merged={...(order||{}),...j,customer:{...(order?.customer||{}),...(j.customer||{})},items:order?.items?.length?order.items:j.items};render(merged);return merged}}catch(e){console.warn('[Success track]',e.message)}return order}
function initCancel(data){clearInterval(cancelTimer);const zone=document.getElementById('krCancelZone'),active=document.getElementById('krCancelActive'),expired=document.getElementById('krCancelExpired'),timer=document.getElementById('krCancelTimer');if(!zone)return;const terminal=String(data.status).startsWith('cancelled')||['shipped','delivered'].includes(data.status),deadline=Number(data.cancelDeadline||0);zone.style.display='block';if(terminal||!deadline||Date.now()>=deadline){active.style.display='none';expired.style.display='block';return}active.style.display='block';expired.style.display='none';const tick=()=>{const left=Math.max(0,deadline-Date.now()),m=Math.floor(left/60000),s=Math.floor(left%60000/1000);if(timer)timer.textContent=`${m}:${String(s).padStart(2,'0')}`;if(!left){clearInterval(cancelTimer);active.style.display='none';expired.style.display='block'}};tick();cancelTimer=setInterval(tick,1000);document.getElementById('krCancelBtn').onclick=()=>openCancel(deadline)}
function openCancel(deadline){const modal=document.getElementById('krCancelModal');modal.style.display='flex';document.querySelectorAll('.kr-cancel-reason').forEach(label=>label.onclick=()=>{document.querySelectorAll('.kr-cancel-reason').forEach(x=>x.classList.remove('selected'));label.classList.add('selected');document.getElementById('krOtherNote').style.display=label.id==='reason_other'?'block':'none'});const close=()=>modal.style.display='none';document.getElementById('krCancelDismiss').onclick=close;modal.onclick=e=>{if(e.target===modal)close()};document.getElementById('krCancelConfirm').onclick=async function(){if(Date.now()>=deadline)return close();const selected=document.querySelector('.kr-cancel-reason.selected');if(!selected)return alert(lang==='bn'?'একটি কারণ বেছে নিন':'Please select a reason');const reason=selected.querySelector('input').value,note=document.getElementById('krCancelNote')?.value.trim()||'';this.disabled=true;this.textContent=lang==='bn'?'বাতিল হচ্ছে…':'Cancelling…';try{const r=await fetch(`${WORKER}/api/cancel`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({orderId:order.orderId,reason,reasonNote:note})}),j=await r.json();if(!j.ok)throw new Error(j.error||'Cancel failed');close();const local={...(order||{}),status:j.status||'cancelled_by_customer',cancelReason:reason,_cancelledAt:Date.now()};localStorage.setItem('kr_last_order',JSON.stringify(local));order=local;render(local);window.dataLayer=window.dataLayer||[];window.dataLayer.push({event:'order_cancelled',transaction_id:order.orderId,cancel_reason:reason,value:order.totals?.totalPayable||0,currency:'BDT'});notify(lang==='bn'?'অর্ডার বাতিল হয়েছে':'Order Cancelled',lang==='bn'?'স্টক/রিজার্ভ স্বয়ংক্রিয়ভাবে সমন্বয় হয়েছে':'Inventory was adjusted automatically')}catch(e){alert(e.message)}finally{this.disabled=false;this.textContent=lang==='bn'?'বাতিল নিশ্চিত করুন':'Confirm Cancel'}}}
async function init(){setTheme(localStorage.getItem('kr_theme')||'light');setLang(localStorage.getItem('kr_lang')||'en');document.getElementById('krThemeToggle').onclick=()=>setTheme(document.documentElement.dataset.theme==='dark'?'light':'dark');document.getElementById('krLangToggle').onclick=()=>setLang(lang==='bn'?'en':'bn');const id=new URLSearchParams(location.search).get('id'),raw=localStorage.getItem('kr_last_order');let local=null;try{local=raw?JSON.parse(raw):null}catch{}if(local&&(!id||local.orderId===id)){order=local;render(local)}if(id){const found=await refreshStatus(id);if(!found)showMissing(lang==='bn'?'অর্ডারের তথ্য পাওয়া যায়নি':'Order data not found')}else if(!local)showMissing(lang==='bn'?'অর্ডারের তথ্য পাওয়া যায়নি':'Order data not found');}

async function downloadSuccessInvoice() {
  const orderId = order ? order.orderId : new URLSearchParams(location.search).get('id');
  if (!orderId) {
    alert(lang === 'bn' ? 'অর্ডারের তথ্য পাওয়া যায়নি।' : 'Order ID not found.');
    return;
  }

  /* Invoice এখন ফোন-ভেরিফাইড — অর্ডারের ফোন নম্বরটি লোকাল কপি থেকে নিই,
     না পেলে ব্যবহারকারীর কাছে জিজ্ঞেস করি */
  let phone = (order && order.customer && order.customer.phone) || '';
  if (!phone) {
    try { const lo = JSON.parse(localStorage.getItem('kr_last_order') || 'null'); if (lo && lo.orderId === orderId && lo.customer && lo.customer.phone) phone = lo.customer.phone; } catch {}
  }
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
window.downloadSuccessInvoice = downloadSuccessInvoice;

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
