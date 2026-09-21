/* ================================================================
   KORA ROYAL — api.js
   Cloudflare Worker proxy — hides all secrets
   
   Load order in index.html:
   1. integrations.js  (config, tracking)
   2. api.js           (this file — worker communication)
   3. main.js          (UI logic)
   ================================================================ */
'use strict';

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ================================================================
   WORKER CONFIG — শুধু URL, কোনো Secret নেই
   ================================================================ */
const KR_API = {
  WORKER_URL: 'https://kora-api.shakhawatyt77.workers.dev'
};

/* ================================================================
   ORDER API — Worker এর মাধ্যমে Telegram + Sheets
   ================================================================ */
async function sendOrderToWorker(orderData) {
  const orderId = orderData?.orderId || '';
  try {
    const res = await fetch(`${KR_API.WORKER_URL}/api/order`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Idempotency-Key':orderData.idempotencyKey || orderId},
      body:JSON.stringify({ orderData })
    });
    const json=await res.json().catch(()=>({}));
    if(!res.ok||!json.ok)throw new Error(json.error||`Order API failed (${res.status})`);
    console.log('[api.js] ✅ Authoritative order saved',json);
    return {...json,ok:true,telegram:json.telegram===true,sheets:json.sheets===true,orderId:json.orderId||orderId,cancelDeadline:json.cancelDeadline||json.order?.cancelDeadline||null};
  } catch(err) {
    console.error('[api.js] sendOrderToWorker error:',err.message);throw err;
  }
}

/* ================================================================
   LEAD API — Worker এর মাধ্যমে Lead Bot + Lead Sheets
   ================================================================ */
async function sendLeadToWorker(telegramMessage, sheetsPayload) {
  try {
    const res = await fetch(`${KR_API.WORKER_URL}/api/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegramMessage: telegramMessage,
        sheetsPayload: sheetsPayload
      }),
      keepalive: true
    });
    
    if (!res.ok) {
      console.error('[api.js] Lead Worker response not ok:', res.status);
      return { telegram: false, sheets: false };
    }
    
    const json = await res.json();
    console.log('[api.js] ✅ Lead sent via Worker', json);
    return { telegram: json.telegram || false, sheets: json.sheets || false };
    
  } catch (err) {
    console.error('[api.js] sendLeadToWorker error:', err.message);
    return { telegram: false, sheets: false };
  }
}

/* ================================================================
   TELEGRAM ORDER MESSAGE BUILDER
   (integration.js এর sendToTelegram থেকে message logic নেওয়া)
   ================================================================ */
function buildTelegramOrderMsg(orderId, customer, payment, instances, totals, couponCode) {
  const productLines = instances.filter(i => i.qty > 0).map(i => {
    const p = window.KR.PRODUCTS[i.pid];
    const name = p ? p.name_en : 'Unknown';
    const price = p ? p.price : 0;
    return `🔹 <b>${name}</b>\n      ${i.size} / ${i.color} × ${i.qty} = <b>৳${(price * i.qty).toLocaleString()}</b>`;
  }).join('\n');
  
  const totalQty = instances.filter(i => i.qty > 0).reduce((sum, i) => sum + i.qty, 0);
  const line = '━━━━━━━━━━━━━━━━━━━━━━';
  
  let msg = '';
  msg += `🛒 <b>NEW ORDER — KORA ROYAL</b>\n${line}\n`;
  msg += `🆔 <b>Order ID:</b>   <code>${orderId}</code>\n`;
  msg += `📅 <b>Date:</b>       ${new Date().toLocaleString('en-BD', { hour12: true })}\n${line}\n\n`;
  msg += `👤 <b>CUSTOMER INFO</b>\n${line}\n`;
  
  
  
  
  msg += `👨‍💼 <b>Name</b>      <code>${escapeHtml(customer.name)}</code>\n`;
  msg += `📞 <b>Phone</b>     <code>${escapeHtml(customer.phone)}</code>\n`;
  if (customer.email) msg += `📧 <b>Email</b>     <code>${escapeHtml(customer.email)}</code>\n`;
  msg += `📍 <b>District</b>  ${escapeHtml(customer.district)}\n`;
  msg += `🏠 <b>Address</b>   <code>${escapeHtml(customer.address)}</code>\n${line}\n\n`;
  
  
  
  msg += `📦 <b>PRODUCTS</b>  (Total Qty: <b>${totalQty}</b>)\n${line}\n`;
  msg += `${productLines}\n${line}\n\n`;
  msg += `💳 <b>PAYMENT SUMMARY</b>\n${line}\n`;
  msg += `🧾 Subtotal     ৳${totals.subtotal.toLocaleString()}\n`;
  msg += `🚚 Delivery     ৳${totals.delivery.toLocaleString()}\n`;
  if (totals.discountAmt > 0) {
    msg += `🎟️ Discount     -৳${totals.discountAmt.toLocaleString()}  (<code>${couponCode}</code>)\n`;
  }
  msg += `💰 <b>Total       ৳${totals.totalPayable.toLocaleString()}</b>\n\n`;
  
  if (payment.method === 'COD') {
    msg += `💵 <b>Payment</b>    Cash on Delivery\n`;
  } else {
    msg += `📲 <b>Method</b>     ${payment.method}\n`;
    if (payment.trxId) msg += `🔑 <b>Trx ID</b>    <code>${payment.trxId}</code>\n`;
    msg += `✅ <b>Advance</b>    ৳${(payment.advance || 0).toLocaleString()}\n`;
    msg += `🚪 <b>COD Due</b>    ৳${totals.codRemaining.toLocaleString()}\n`;
  }
  msg += `${line}\n`;
  
  
  
  
  if (customer.note) msg += `\n📝 <b>Note:</b> ${customer.note}\n${line}\n`;
  
  
    
  
  msg += `\n✅ <i>Saved to Google Sheets</i>`;
  
  return msg;
}

/* ================================================================
   SHEETS ORDER PAYLOAD BUILDER
   ================================================================ */
function buildSheetsOrderPayload(orderData) {
  const { orderId, customer, payment, instances, totals, couponCode } = orderData;
  
  const productsStr = instances.filter(i => i.qty > 0).map(i => {
    const p = window.KR.PRODUCTS[i.pid];
    return `${p ? p.name_en : 'Unknown'} (Size:${i.size}, Color:${i.color}, Qty:${i.qty})`;
  }).join('; ');
  
  const totalQty = instances.reduce((s, i) => s + (i.qty || 0), 0);
  
  return {
    orderId,
    date: new Date().toLocaleString('en-BD'),
    name: customer.name,
    phone: customer.phone,
    email: customer.email || '',
    district: customer.district || '',
    address: customer.address || '',
    products: productsStr,
    qty: totalQty,
    subtotal: totals.subtotal,
    shipping: totals.delivery,
    discount: totals.discountAmt,
    coupon: couponCode || '',
    total: totals.totalPayable,
    payment: payment.method,
    trxId: payment.trxId || '',
    advance: payment.advance || 0,
    status: 'Pending'
  };
}

/* ================================================================
   EXPORTS
   ================================================================ */
window.KR_API = KR_API;
window.sendOrderToWorker = sendOrderToWorker;
window.sendLeadToWorker = sendLeadToWorker;