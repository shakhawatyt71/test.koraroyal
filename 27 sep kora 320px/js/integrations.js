/**
 * ================================================================
 * KORA ROYAL — integrations.js (UNIVERSAL TRACKING v4)
 * Loads BEFORE api.js and main.js
 *
 * FEATURES:
 *  - Every visitor tracked (anonymous + identified)
 *  - User ID + Session ID per visit
 *  - Full visit history stored in localStorage
 *  - Order history with order IDs
 *  - Merged historical data (all names, phones, addresses)
 *  - Telegram: compact format (under 4096 chars)
 *  - Google Sheets: lead backup
 *  - Cart abandonment timer
 *  - Page leave detection (keepalive fetch)
 *
 * SECURITY UPDATE:
 *  - All secrets (Bot Tokens, Sheet URLs) moved to Cloudflare Worker
 *  - Frontend contains NO sensitive credentials
 *  - API calls go through Worker proxy
 * ================================================================
 */
'use strict';

/* ================================================================
   KR CONFIG
   🔒 Secrets are now in Cloudflare Worker (Environment Variables)
   ================================================================ */
const KR = {
  GTM_WEB:    'GTM-MMBJVW59',
  GTM_SERVER: 'GTM-T6DCM6LC',
  GA4_ID:     'G-6P8GTD9T7K',
  GA4_STREAM: '14337807051',
  META_PIXEL: '1635272555265005',
  STAPE_URL:  'https://xqwfxhjh.in.stape.io',

  WHATSAPP: '+8801935158745',
  DELIVERY: { DHAKA: 60, OUTSIDE: 130, FREE_AT: 2999 },
  /* কুপন তালিকা এখন সম্পূর্ণ ব্যাকএন্ডে (D1) — Admin → Coupons প্যানেল。
     Frontend কোনো কুপন কোড/পার্সেন্ট জানে না; শুধু সার্ভার-কোট
     (window.KR_COUPON_QUOTE) ব্যবহার করে। */

  PRODUCTS: {
    1: {
      id: 1, name_en: 'Kora Signature', name_bn: 'করা সিগনেচার',
      sub_en: 'Premium Shirt', sub_bn: 'প্রিমিয়াম শার্ট',
      collection_en: 'Our Exclusive Collection', collection_bn: 'আমাদের এক্সক্লুসিভ কালেকশন',
      price: 999, sizes: ['M','L','XL'],
      colors: [
        { id: 'black',    name_en: 'Black',           name_bn: 'কালো' },
        { id: 'white',    name_en: 'White',           name_bn: 'সাদা' },
        { id: 'gray',     name_en: 'Gray',            name_bn: 'ধূসর' },
        { id: 'brown',    name_en: 'Brown',           name_bn: 'বাদামি' },
        { id: 'olive',    name_en: 'Olive',           name_bn: 'অলিভ' },
        { id: 'pink',     name_en: 'Light Pink',      name_bn: 'হালকা গোলাপি' },
        { id: 'offwhite', name_en: 'Off White',       name_bn: 'অফ হোয়াইট' },
        { id: 'magenta',  name_en: 'Light Dark Magenta', name_bn: 'ম্যাজেন্টা' }
      ],
      category: 'Exclusive', rating: 4.9, soldCount: 69,
      imageUrl: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090280/Puma_gemini-3-pro-image-preview_nano-banana-pro__a_____SUPER_COMBINED_M_1_ykh6i2.webp',
      sizeChart: {
        headers: ['Size','Chest (inch)','Length (inch)','Shoulder (inch)'],
        rows: [['M','40','28','17'],['L','42','29','18'],['XL','44','30','19']]
      }
    },
    2: {
      id: 2, name_en: 'Kora Polo', name_bn: 'করা পোলো',
      sub_en: 'Premium T-Shirt', sub_bn: 'প্রিমিয়াম টিশার্ট',
      collection_en: 'Our Exclusive Collection', collection_bn: 'আমাদের এক্সক্লুসিভ কালেকশন',
      price: 699, sizes: ['M','L','XL'],
      colors: [
        { id: 'black',   name_en: 'Black',            name_bn: 'কালো' },
        { id: 'cream',   name_en: 'Cream',            name_bn: 'ক্রিম' },
        { id: 'gray',    name_en: 'Gray',             name_bn: 'ধূসর' },
        { id: 'brown',   name_en: 'Brown',            name_bn: 'বাদামি' },
        { id: 'olive',   name_en: 'Olive',            name_bn: 'অলিভ' },
        { id: 'magenta', name_en: 'Light Dark Magenta', name_bn: 'ম্যাজেন্টা' }
      ],
      category: 'Exclusive', rating: 4.8, soldCount: 324,
      imageUrl: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090288/Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771145677248_eximcx.webp',
      sizeChart: {
        headers: ['Size','Chest (inch)','Length (inch)','Shoulder (inch)'],
        rows: [['M','38','26','16'],['L','40','27','17'],['XL','42','28','18']]
      }
    },
    3: {
      id: 3, name_en: 'Kora Pants', name_bn: 'করা পেন্ট',
      sub_en: 'Export Quality Pant', sub_bn: 'এক্সপোর্ট কোয়ালিটি পেন্ট',
      collection_en: 'Our Exclusive Collection', collection_bn: 'আমাদের এক্সক্লুসিভ কালেকশন',
      price: 1499, sizes: ['28','30','32','34','36','38','40','42'],
      colors: [
        { id: 'black',    name_en: 'Black',       name_bn: 'কালো' },
        { id: 'white',    name_en: 'White',       name_bn: 'সাদা' },
        { id: 'gray',     name_en: 'Gray',        name_bn: 'ধূসর' },
        { id: 'brown',    name_en: 'Brown',       name_bn: 'বাদামি' },
        { id: 'offwhite', name_en: 'Off White',   name_bn: 'অফ হোয়াইট' },
        { id: 'mixed',    name_en: 'Light Dark Mixed', name_bn: 'মিক্সড' }
      ],
      category: 'Exclusive', rating: 4.9, soldCount: 98,
      imageUrl: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090280/Puma_gemini-3-pro-image-preview_nano-banana-pro__a_____SUPER_COMBINED_M_jzbmi9.webp',
      sizeChart: {
        headers: ['Size (waist)','Waist (inch)','Hip (inch)','Length (inch)'],
        rows: [['28','28','36','40'],['30','30','38','40'],['32','32','40','41'],['34','34','42','41'],['36','36','44','42'],['38','38','46','42'],['40','40','48','43'],['42','42','50','43']]
      }
    }
  },

  CLOUDINARY_CLOUD: 'dvvgofrhs',
  CLOUDINARY_API_KEY: '765352335481485',
  CLOUDINARY_BASE: 'https://res.cloudinary.com/dvvgofrhs/image/upload/',

    GALLERY_IMAGES: [
    /* ========== Priority Posters (1-17) — User Defined Order ========== */
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090135/1_Puma_Puma_1775483112084-019d6308-9ebf-7776-a1df-bd080017926f_tw20mx.webp', name_en: 'Midnight Hoodie', name_bn: 'মিডনাইট হুডি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090128/1Puma_Puma_1778781570841-019e27a3-b7d1-7494-973a-11b4ad60d233_ua0lya.webp', name_en: 'Urban Drift Tee', name_bn: 'আরবান ড্রিফট টি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090161/2_Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1770645197548-019c42ac-9c64-70b8-9e22-3ffe4816fa26_abvv3d.webp', name_en: 'Royal Blazer', name_bn: 'রয়্যাল ব্লেজার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090146/3_Puma_Puma_1774016733838-019d0aa2-f556-740d-b1aa-94456bc6c1d6_eqef8t.webp', name_en: 'Street Edge Jacket', name_bn: 'স্ট্রিট এজ জ্যাকেট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090139/4_Puma_Puma_1775452294521-019d6133-36e9-70d9-a210-c24464331f07_nmja08.webp', name_en: 'Premium Cargo Pant', name_bn: 'প্রিমিয়াম কার্গো প্যান্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090162/5_Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1771088716896_ilsbyj.webp', name_en: 'Classic Denim Look', name_bn: 'ক্লাসিক ডেনিম লুক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090131/6_Puma_Puma_175556837079-019d676e-57ad-7a12-b7f3-824123b0d718_jhb3xt.webp', name_en: 'Velvet Black Polo', name_bn: 'ভেলভেট ব্ল্যাক পোলো' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090150/6_Puma_Puma_1772235859217-019ca17c-6295-75d5-ab68-645f1c8e6178_vupfwj.webp', name_en: 'Bold Statement Tee', name_bn: 'বোল্ড স্টেটমেন্ট টি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090161/7_Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1770624522255-019c4170-bff7-776d-acf8-d8ad63ac98a8_ye2uh4.webp', name_en: 'Vintage Crew Neck', name_bn: 'ভিনটেজ ক্রু নেক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090131/8_Puma_Puma_1775556222037-019d6762-9169-796c-8edf-92b83a756c7a_al5jqs.webp', name_en: 'Modern Fit Shirt', name_bn: 'মডার্ন ফিট শার্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090154/9_Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1771210054220-019c6454-1dff-7401-beb1-96b7bcdef78f_qanfn6.webp', name_en: 'Signature Bomber', name_bn: 'সিগনেচার বোমার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090170/10_Puma_Puma_1770009085869-019c1cc2-0692-76b7-bcc5-dd997eeb48ad_bpmfsp.webp', name_en: 'Coastal Linen Shirt', name_bn: 'কোস্টাল লিনেন শার্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090179/11_Puma_Puma_Image_Generation_Arena_-_Compare_AI_Image_Models_7_s2m6py.webp', name_en: 'Athleisure Joggers', name_bn: 'অ্যাথলেজার জগার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090180/12_Puma_Puma_gemini-3-pro-image-preview-2k_b_SYSTEM___ROLE__You_a_bdd8zw.webp', name_en: 'Noir Overcoat', name_bn: 'নয়ার ওভারকোট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090189/13_Puma_Puma_1769318147776-019bf393-e751-7253-a891-a12f0d83e90b_nxhsbq.webp', name_en: 'Heritage Flannel', name_bn: 'হেরিটেজ ফ্ল্যানেল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090181/14_Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_2_nattdm.webp', name_en: 'Sleek Casual Wear', name_bn: 'স্লিক ক্যাজুয়াল ওয়্যার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090195/16_Puma_Puma_gemini-3-pro-image-preview_nano-banana-pro__a_____SUPER_COMBINED_M_2_cadqpa.webp', name_en: 'Bold Royal Edition', name_bn: 'বোল্ড রয়্যাল এডিশন' },
    
    /* ========== Random Shuffled Posters (85 items) ========== */
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090152/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771163901816_zmquvm.webp', name_en: 'Carbon Black Series', name_bn: 'কার্বন ব্ল্যাক সিরিজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090188/Puma_Puma_gemini-3-pro-image-preview-2k_a___UNIVERSAL_MARKETIN_lfnzjz.webp', name_en: 'Refined Gentleman', name_bn: 'রিফাইন্ড জেন্টলম্যান' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090132/Puma_Puma_1775483438867-019d6308-9ebf-79a0-8306-604711cda589_zg5xru.webp', name_en: 'Onyx Slim Fit', name_bn: 'অনিক্স স্লিম ফিট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090167/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_14_goid1e.webp', name_en: 'Sunset Boulevard', name_bn: 'সানসেট বুলেভার্ড' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-25-05-971_hc39ca.webp', name_en: 'Iron Grey Essential', name_bn: 'আয়রন গ্রে এসেনশিয়াল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090194/Puma_Puma_gemini-3-pro-image-preview_nano-banana-pro__a_____SUPER_COMBINED_M_ex55gz.webp', name_en: 'Apex Statement', name_bn: 'এপেক্স স্টেটমেন্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090169/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_12_z7pqpl.webp', name_en: 'Urban Nomad', name_bn: 'আরবান নোম্যাড' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090158/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1771089411815_gwq5cm.webp', name_en: 'Tailored Charcoal', name_bn: 'টেইলর্ড চারকোল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090143/Puma_Puma_Compare_Image_Generation_AI_Models_Side_by_Side_8_h1s6p5.webp', name_en: 'Eclipse Hoodie', name_bn: 'ইক্লিপ্স হুডি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090184/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_tascnq.webp', name_en: 'Heritage Crewneck', name_bn: 'হেরিটেজ ক্রুনেক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090193/Puma_Puma_gemini-3-pro-image-preview_nano-banana-pro__a_____SUPER_COMBINED_M_1_j2fldz.webp', name_en: 'Velvet Noir', name_bn: 'ভেলভেট নয়ার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090155/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771127922186_ywptcw.webp', name_en: 'Modern Heritage', name_bn: 'মডার্ন হেরিটেজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-19-47-398_rm6uez.webp', name_en: 'Cobalt Casual', name_bn: 'কোবাল্ট ক্যাজুয়াল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090178/Puma_Puma_1769443235403-019bfb07-550d-77f6-9fd2-1dff41b37d26_jcre2g.webp', name_en: 'Coastline Polo', name_bn: 'কোস্টলাইন পোলো' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090138/Puma_Puma_1775452505241-019d6136-86cd-78dd-925a-9ef1299a5339_nmpugs.webp', name_en: 'Stealth Joggers', name_bn: 'স্টেলথ জগার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090192/Puma_Puma_gemini-3-pro-image-preview_nano-banana-pro__a_______SUPER_COMBINED_vtcsih.webp', name_en: 'Phantom Black', name_bn: 'ফ্যান্টম ব্ল্যাক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090184/Puma_Puma_Image_Generation_Arena_-_Compare_AI_Image_Models_bwg4bj.webp', name_en: 'Crimson Comfort', name_bn: 'ক্রিমসন কমফোর্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090132/Puma_Puma_1775555889613-019d675f-d9ad-7230-ab1c-58b1aa35facd_dkruct.webp', name_en: 'Steel Grey Bomber', name_bn: 'স্টিল গ্রে বোমার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090191/Puma_Puma_LMArena_12_yfhulq.webp', name_en: 'Ravens Edition', name_bn: 'রেভেনস এডিশন' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090163/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1770393066376_i4zse8.webp', name_en: 'Asphalt Series', name_bn: 'অ্যাসফল্ট সিরিজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090147/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1773939820010_vjotfc.webp', name_en: 'Boulevard Classic', name_bn: 'বুলেভার্ড ক্লাসিক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090177/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_6_p71xpg.webp', name_en: 'Midnight Drift', name_bn: 'মিডনাইট ড্রিফট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-23-16-307_nd8z1j.webp', name_en: 'Crimson Edge', name_bn: 'ক্রিমসন এজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090173/Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1769829676152-019c120f-851f-72ea-a8b6-4f867fcbbb71_zdyx4r.webp', name_en: 'Slate Comfort', name_bn: 'স্লেট কমফোর্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090140/Puma_Puma_1775450188516-019d6113-4571-793d-8f53-7eb4b41a1363_uq4kwr.webp', name_en: 'Forest Trail Jacket', name_bn: 'ফরেস্ট ট্রেইল জ্যাকেট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090187/Puma_Puma_gemini-3-pro-image-preview-2k_a___Prompt_MANDATES__T_rgbgjt.webp', name_en: 'Imperial Royal', name_bn: 'ইম্পেরিয়াল রয়্যাল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090175/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_9_p5vdws.webp', name_en: 'Atlas Streetwear', name_bn: 'অ্যাটলাস স্ট্রিটওয়্যার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090138/Puma_Puma_1775450790249-019d611c-5ad6-7eeb-a936-d2b4fda51cc8_uzfmwz.webp', name_en: 'Frosted Crew', name_bn: 'ফ্রস্টেড ক্রু' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090152/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771297817812_ej5sjs.webp', name_en: 'Concrete Pant', name_bn: 'কনক্রিট প্যান্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090189/Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1764753725562-019ae380-da12-79a4-b2bd-277761ff5f95.png_adbyed.webp', name_en: 'Royal Velvet', name_bn: 'রয়্যাল ভেলভেট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-17-48-531_hwl6bw.webp', name_en: 'Stone Wash Denim', name_bn: 'স্টোন ওয়াশ ডেনিম' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090169/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_13_kyqbul.webp', name_en: 'Empire Outerwear', name_bn: 'এম্পায়ার আউটারওয়্যার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090163/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1770117216742_nxlqnx.webp', name_en: 'Granite Hoodie', name_bn: 'গ্র্যানাইট হুডি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090128/Puma_Puma_1775755071260-019d733f-b33d-796f-9882-a328b6534437_s41rqw.webp', name_en: 'Bronze Heritage', name_bn: 'ব্রোঞ্জ হেরিটেজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090144/Puma_Puma_Compare_Image_Generation_AI_Models_Side_by_Side_7_tve7yw.webp', name_en: 'Royal Crest Tee', name_bn: 'রয়্যাল ক্রেস্ট টি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-30-59-567_a5jh3n.webp', name_en: 'Onyx Bold', name_bn: 'অনিক্স বোল্ড' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090154/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771145912134_rhkhbr.webp', name_en: 'Cobalt Aviator', name_bn: 'কোবাল্ট এভিয়েটর' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090183/Puma_Puma_LMArena___Benchmark_Compare_the_Best_AI_Models_w59fke.webp', name_en: 'Tundra Overcoat', name_bn: 'টুন্ড্রা ওভারকোট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090133/Puma_Puma_Compare_Image_Generation_AI_Models_Side_by_Side_1775483407979_ymokxv.webp', name_en: 'Desert Sand Fit', name_bn: 'ডেজার্ট স্যান্ড ফিট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-32-42-914_jeal6l.webp', name_en: 'Slate Statement', name_bn: 'স্লেট স্টেটমেন্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090149/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771586875223_n1xgut.webp', name_en: 'Maroon Premium', name_bn: 'মেরুন প্রিমিয়াম' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090188/Puma_Puma_gpt-image-1.5-high-fidelity_a___PROMPT_MANDATES__T_v38n1n.webp', name_en: 'Apex Performance', name_bn: 'এপেক্স পারফরম্যান্স' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090176/Puma_Puma_LMArena___Benchmark_Compare_the_Best_AI_Models_6_tjnnur.webp', name_en: 'Steel Edge', name_bn: 'স্টিল এজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090160/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1770393090027_dupbaa.webp', name_en: 'Iron Forge', name_bn: 'আয়রন ফোর্জ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090137/Puma_Puma_1775452800704-019d613a-f841-7759-9b6d-167f99c8f192_ampbuj.webp', name_en: 'Royal Indigo', name_bn: 'রয়্যাল ইন্ডিগো' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090190/Puma_Puma_LMArena_13_x1lcv0.webp', name_en: 'Stealth Black', name_bn: 'স্টেলথ ব্ল্যাক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090145/Puma_Puma_Compare_Image_Generation_AI_Models_Side_by_Side_3_lsovqd.webp', name_en: 'Stonewall Look', name_bn: 'স্টোনওয়াল লুক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-16-54-673_napbmw.webp', name_en: 'Olive Drift', name_bn: 'অলিভ ড্রিফট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090166/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_15_nt1c9w.webp', name_en: 'Vortex Casual', name_bn: 'ভর্টেক্স ক্যাজুয়াল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090167/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_14_iuwaiu.webp', name_en: 'Nightfall Series', name_bn: 'নাইটফল সিরিজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090187/Puma_Puma_1769142905512-019be921-cee8-79a4-9385-de30a5167e88_gjyye2.webp', name_en: 'Wolf Grey Edition', name_bn: 'উলফ গ্রে এডিশন' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090148/Puma_Puma_1772236130073-019ca180-72f6-78e4-b84a-293e06739846_p4x7oc.webp', name_en: 'Imperial Crest', name_bn: 'ইম্পেরিয়াল ক্রেস্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090124/Puma_Puma_Picsart_26-05-15_16-12-13-777_zvp8xh.webp', name_en: 'Espresso Brown', name_bn: 'এসপ্রেসো ব্রাউন' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090182/Puma_Puma_Image_Generation_Arena_-_Compare_AI_Image_Models_5_nxnknc.webp', name_en: 'Quartz Pearl', name_bn: 'কোয়ার্টজ পার্ল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090142/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1774018819926_auwuhg.webp', name_en: 'Royal Cuffs', name_bn: 'রয়্যাল কাফস' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090176/Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1769489229176-019bfdc5-fd00-7dfd-9be0-c6fef3e0db62_rsowxd.webp', name_en: 'Sapphire Coast', name_bn: 'স্যাফায়ার কোস্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090186/Puma_Puma_Image_Generation_Arena_-_Compare_AI_Image_Models_4_yhawak.webp', name_en: 'Stormrider Coat', name_bn: 'স্টর্মরাইডার কোট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090128/Puma_Puma_1778687184252-019e2203-3e35-7424-bcc9-dabb9bdc914c_dmog6r.webp', name_en: 'Twilight Blazer', name_bn: 'টোয়াইলাইট ব্লেজার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090175/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1_sgzmy0.webp', name_en: 'Carbon Slim', name_bn: 'কার্বন স্লিম' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090184/Puma_Puma_Image_Generation_Arena_-_Compare_AI_Image_Models_3_ayb2pq.webp', name_en: 'Vintage Royal', name_bn: 'ভিনটেজ রয়্যাল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-25-05-971_hc39ca.webp', name_en: 'Polished Earth', name_bn: 'পলিশড আর্থ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090174/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_4_o2vqpz.webp', name_en: 'Storm Slate', name_bn: 'স্টর্ম স্লেট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090141/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1775417251108_w81pd2.webp', name_en: 'Apex Cargo', name_bn: 'এপেক্স কার্গো' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090157/Puma_Puma_gemini-3-pro-image-preview-2k_b___SYSTEM___ROLE__Y_jbszpv.webp', name_en: 'Royal Coast', name_bn: 'রয়্যাল কোস্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090136/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1775471716717_hghygf.webp', name_en: 'Eclipse Pant', name_bn: 'ইক্লিপ্স প্যান্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090128/Puma_Puma_1775781983710-019d74da-16bd-7f59-9c2a-aa56597c9a3e_dsvbre.webp', name_en: 'Heritage Tan', name_bn: 'হেরিটেজ ট্যান' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090171/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_8_yv18gt.webp', name_en: 'Modern Aviator', name_bn: 'মডার্ন এভিয়েটর' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-19-47-398_rm6uez.webp', name_en: 'Velvet Statement', name_bn: 'ভেলভেট স্টেটমেন্ট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090157/Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1771089574647-019c5d29-652c-785c-ae9c-1da35c979f09_ofzxft.webp', name_en: 'Steel Royal', name_bn: 'স্টিল রয়্যাল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090158/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_1771088720663_xi0lum.webp', name_en: 'Onyx Drift', name_bn: 'অনিক্স ড্রিফট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090129/Puma_Puma_1775754893146-019d733c-42db-7fe2-93d0-29d4ecab0c74_kdstot.webp', name_en: 'Highlander Tee', name_bn: 'হাইল্যান্ডার টি' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-23-16-307_nd8z1j.webp', name_en: 'Smoke Grey Fit', name_bn: 'স্মোক গ্রে ফিট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090192/Puma_Puma_gemini-3-pro-image-preview_nano-banana-pro__a_MASTER_PROMPT_____ojiybc.webp', name_en: 'Royal Maverick', name_bn: 'রয়্যাল ম্যাভেরিক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090151/Puma_Puma_8992cf65-b8d2-4c24-a1c3-e9c15d3934f0_1771586452474-019c7ac6-eba5-79a1-ba18-09e2fdcebaf7_qlzwm6.webp', name_en: 'Frost Heritage', name_bn: 'ফ্রস্ট হেরিটেজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-30-59-567_a5jh3n.webp', name_en: 'Eagle Spirit', name_bn: 'ঈগল স্পিরিট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090179/Puma_Puma_1769406437033-019bf8d5-3f85-74ba-b510-bd8c8366880e_vpb2m2.webp', name_en: 'Knight Edition', name_bn: 'নাইট এডিশন' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090124/Puma_Puma_1778783341088-019e27be-e779-7ad5-acb4-8d1480ecc615_ihrywe.webp', name_en: 'Midnight Aviator', name_bn: 'মিডনাইট এভিয়েটর' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090153/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1771146084667_d1s3kg.webp', name_en: 'Cedar Bold', name_bn: 'সিডার বোল্ড' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090142/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1774153863820_ndrssn.webp', name_en: 'Ash Heritage', name_bn: 'অ্যাশ হেরিটেজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-32-42-914_jeal6l.webp', name_en: 'Marble White', name_bn: 'মার্বেল হোয়াইট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090149/Puma_Puma_1772236272070-019ca182-7b3f-74d7-ab22-144bde759abd_iotfas.webp', name_en: 'Crown Royal', name_bn: 'ক্রাউন রয়্যাল' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090123/Puma_Puma_Picsart_26-05-15_16-17-48-531_hwl6bw.webp', name_en: 'Royal Granite', name_bn: 'রয়্যাল গ্র্যানাইট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090130/Puma_Puma_1775585781197-019d6927-ac08-77ac-a29e-e245554325ef_iicanb.webp', name_en: 'Storm Crew', name_bn: 'স্টর্ম ক্রু' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090134/Puma_Puma_Compare_Image_Generation_AI_Models_Side_by_Side_1775483397913_rg5lej.webp', name_en: 'Crimson Bold', name_bn: 'ক্রিমসন বোল্ড' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090171/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_9_ringjj.webp', name_en: 'Apex Heritage', name_bn: 'এপেক্স হেরিটেজ' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090166/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_16_c9t4gb.webp', name_en: 'Forge Black', name_bn: 'ফোর্জ ব্ল্যাক' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090165/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_17_ngeowy.webp', name_en: 'Tide Premium', name_bn: 'টাইড প্রিমিয়াম' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090164/Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_20_rlyidd.webp', name_en: 'Iron Drift', name_bn: 'আয়রন ড্রিফট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090159/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1770645585345_msc3ca.webp', name_en: 'Royal Sapphire', name_bn: 'রয়্যাল স্যাফায়ার' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090139/Puma_Puma_1775450218042-019d6113-4571-7044-9ea7-9b130456a644_jkbsmn.webp', name_en: 'Modern Knight', name_bn: 'মডার্ন নাইট' },
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090135/Puma_Puma_Arena___Benchmark_Compare_the_Best_AI_Models_1775483068966_qqb0xl.webp', name_en: 'Eclipse Edge', name_bn: 'ইক্লিপ্স এজ' },
    
    /* ========== Final Poster (always last) ========== */
    { url: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1779090181/_Puma_Puma_AI_Chat_Arena_-_Compare_AI_Models_Side_by_Side_5_zwndnu.webp', name_en: 'Signature Finale', name_bn: 'সিগনেচার ফিনালে' }
  ],

  LOGOS: {
    light: 'https://res.cloudinary.com/dvvgofrhs/image/upload/v1776146557/Picsart_26-04-14_11-59-56-382_ueiofu.png',
    dark:  'https://res.cloudinary.com/dvvgofrhs/image/upload/v1776146561/Picsart_26-04-14_12-01-21-890_d8icez.png',
    footer:'https://res.cloudinary.com/dvvgofrhs/image/upload/v1775933197/New_Project_131_Copy_5BEB4D6_ywsvev.png'
  },

  DHAKA_DISTRICTS: ['Dhaka','Gazipur','Narayanganj','Manikganj','Munshiganj','Narsingdi'],
  DISTRICTS: ['Bagerhat','Bandarban','Barguna','Barishal','Bhola','Bogura','Brahmanbaria','Chandpur','Chapai Nawabganj','Chattogram','Chuadanga','Cox\'s Bazar','Cumilla','Dhaka','Dinajpur','Faridpur','Feni','Gaibandha','Gazipur','Gopalganj','Habiganj','Jamalpur','Jashore','Jhalokathi','Jhenaidah','Joypurhat','Khagrachhari','Khulna','Kishoreganj','Kurigram','Kushtia','Lakshmipur','Lalmonirhat','Madaripur','Magura','Manikganj','Meherpur','Moulvibazar','Munshiganj','Mymensingh','Naogaon','Narail','Narayanganj','Narsingdi','Natore','Netrokona','Nilphamari','Noakhali','Pabna','Panchagarh','Patuakhali','Pirojpur','Rajbari','Rajshahi','Rangamati','Rangpur','Satkhira','Shariatpur','Sherpur','Sirajganj','Sunamganj','Sylhet','Tangail','Thakurgaon']
  ,
  THANAS_BY_DISTRICT: {
  'Bagerhat': [
    'Bagerhat Sadar',
    'Chitalmari',
    'Fakirhat',
    'Kachua',
    'Mollahat',
    'Mongla',
    'Morrelganj',
    'Rampal',
    'Sarankhola'
  ],

  'Bandarban': [
    'Alikadam',
    'Bandarban Sadar',
    'Lama',
    'Naikhongchhari',
    'Rowangchhari',
    'Ruma',
    'Thanchi'
  ],

  'Barguna': [
    'Amtali',
    'Bamna',
    'Barguna Sadar',
    'Betagi',
    'Patharghata',
    'Taltali'
  ],

  'Barishal': [
    'Agailjhara',
    'Babuganj',
    'Bakerganj',
    'Banaripara',
    'Barishal Sadar',
    'Gournadi',
    'Hizla',
    'Mehendiganj',
    'Muladi',
    'Wazirpur'
  ],

  'Bhola': [
    'Bhola Sadar',
    'Burhanuddin',
    'Char Fasson',
    'Daulatkhan',
    'Lalmohan',
    'Manpura',
    'Tazumuddin'
  ],

  'Bogura': [
    'Adamdighi',
    'Bogura Sadar',
    'Dhunat',
    'Dhupchanchia',
    'Gabtali',
    'Kahaloo',
    'Nandigram',
    'Sariakandi',
    'Shahjahanpur',
    'Sherpur',
    'Shibganj',
    'Sonatala'
  ],

  'Brahmanbaria': [
    'Akhaura',
    'Ashuganj',
    'Bancharampur',
    'Bijoynagar',
    'Brahmanbaria Sadar',
    'Kasba',
    'Nabinagar',
    'Nasirnagar',
    'Sarail'
  ],

  'Chandpur': [
    'Chandpur Sadar',
    'Faridganj',
    'Haimchar',
    'Hajiganj',
    'Kachua',
    'Matlab Dakshin',
    'Matlab Uttar',
    'Shahrasti'
  ],

  'Chapai Nawabganj': [
    'Bholahat',
    'Chapai Nawabganj Sadar',
    'Gomastapur',
    'Nachole',
    'Shibganj'
  ],

  'Chattogram': [
    'Akbar Shah',
    'Anwara',
    'Bakalia',
    'Bandar',
    'Banshkhali',
    'Bayezid Bostami',
    'Boalkhali',
    'Chandanaish',
    'Chandgaon',
    'Chattogram Sadar',
    'Double Mooring',
    'EPZ',
    'Fatikchhari',
    'Halishahar',
    'Hathazari',
    'Karnaphuli',
    'Kotwali',
    'Khulshi',
    'Lohagara',
    'Mirsharai',
    'Pahartali',
    'Panchlaish',
    'Patenga',
    'Patiya',
    'Rangunia',
    'Raozan',
    'Sandwip',
    'Satkania',
    'Sitakunda'
  ],

  'Chuadanga': [
    'Alamdanga',
    'Chuadanga Sadar',
    'Damurhuda',
    'Jibannagar'
  ],

  "Cox's Bazar": [
    'Chakaria',
    "Cox's Bazar Sadar",
    'Eidgaon',
    'Kutubdia',
    'Maheshkhali',
    'Pekua',
    'Ramu',
    'Teknaf',
    'Ukhiya'
  ],

  'Cumilla': [
    'Barura',
    'Brahmanpara',
    'Burichang',
    'Chandina',
    'Chauddagram',
    'Cumilla Adarsha Sadar',
    'Cumilla Sadar Dakshin',
    'Daudkandi',
    'Debidwar',
    'Homna',
    'Laksam',
    'Lalmai',
    'Meghna',
    'Monohorgonj',
    'Muradnagar',
    'Nangalkot',
    'Titas'
  ],

  'Dhaka': [
    'Adabor',
    'Badda',
    'Bangshal',
    'Cantonment',
    'Chawkbazar',
    'Dakshinkhan',
    'Darus Salam',
    'Demra',
    'Dhamrai',
    'Dhanmondi',
    'Dohar',
    'Gendaria',
    'Gulshan',
    'Hazaribagh',
    'Jatrabari',
    'Kafrul',
    'Kalabagan',
    'Kamrangirchar',
    'Keraniganj',
    'Khilgaon',
    'Khilkhet',
    'Kotwali',
    'Lalbagh',
    'Mirpur',
    'Mohammadpur',
    'Motijheel',
    'Nawabganj',
    'New Market',
    'Pallabi',
    'Paltan',
    'Ramna',
    'Rampura',
    'Sabujbagh',
    'Savar',
    'Shah Ali',
    'Shahbagh',
    'Sher-e-Bangla Nagar',
    'Shyampur',
    'Sutrapur',
    'Tejgaon',
    'Tejgaon Industrial Area',
    'Turag',
    'Uttara',
    'Uttara East',
    'Uttara West',
    'Vatara',
    'Wari'
  ],

  'Dinajpur': [
    'Birampur',
    'Birganj',
    'Birol',
    'Bochaganj',
    'Chirirbandar',
    'Dinajpur Sadar',
    'Ghoraghat',
    'Hakimpur',
    'Kaharole',
    'Khansama',
    'Nawabganj',
    'Parbatipur'
  ],

  'Faridpur': [
    'Alfadanga',
    'Bhanga',
    'Boalmari',
    'Charbhadrasan',
    'Faridpur Sadar',
    'Madhukhali',
    'Nagarkanda',
    'Sadarpur',
    'Saltha'
  ],

  'Feni': [
    'Chhagalnaiya',
    'Daganbhuiyan',
    'Feni Sadar',
    'Fulgazi',
    'Parshuram',
    'Sonagazi'
  ],

  'Gaibandha': [
    'Fulchhari',
    'Gaibandha Sadar',
    'Gobindaganj',
    'Palashbari',
    'Sadullapur',
    'Saghata',
    'Sundarganj'
  ],

  'Gazipur': [
    'Gazipur Sadar',
    'Kaliakair',
    'Kaliganj',
    'Kapasia',
    'Sreepur',
    'Tongi'
  ],

  'Gopalganj': [
    'Gopalganj Sadar',
    'Kashiani',
    'Kotalipara',
    'Muksudpur',
    'Tungipara'
  ],

  'Habiganj': [
    'Ajmiriganj',
    'Bahubal',
    'Baniachong',
    'Chunarughat',
    'Habiganj Sadar',
    'Lakhai',
    'Madhabpur',
    'Nabiganj',
    'Shayestaganj'
  ],

  'Jamalpur': [
    'Bakshiganj',
    'Dewanganj',
    'Islampur',
    'Jamalpur Sadar',
    'Madarganj',
    'Melandaha',
    'Sarishabari'
  ],

  'Jashore': [
    'Abhaynagar',
    'Bagherpara',
    'Chaugachha',
    'Jashore Sadar',
    'Jhikargachha',
    'Keshabpur',
    'Manirampur',
    'Sharsha'
  ],

  'Jhalokathi': [
    'Jhalokathi Sadar',
    'Kathalia',
    'Nalchity',
    'Rajapur'
  ],

  'Jhenaidah': [
    'Harinakunda',
    'Jhenaidah Sadar',
    'Kaliganj',
    'Kotchandpur',
    'Maheshpur',
    'Shailkupa'
  ],

  'Joypurhat': [
    'Akkelpur',
    'Joypurhat Sadar',
    'Kalai',
    'Khetlal',
    'Panchbibi'
  ],

  'Khagrachhari': [
    'Dighinala',
    'Guimara',
    'Khagrachhari Sadar',
    'Lakshmichhari',
    'Mahalchhari',
    'Manikchhari',
    'Matiranga',
    'Panchhari',
    'Ramgarh'
  ],

  'Khulna': [
    'Batiaghata',
    'Dacope',
    'Daulatpur',
    'Dighalia',
    'Dumuria',
    'Khalishpur',
    'Khan Jahan Ali',
    'Khulna Sadar',
    'Koyra',
    'Paikgachha',
    'Phultala',
    'Rupsa',
    'Sonadanga',
    'Terokhada'
  ],

  'Kishoreganj': [
    'Austagram',
    'Bajitpur',
    'Bhairab',
    'Hossainpur',
    'Itna',
    'Karimganj',
    'Katiadi',
    'Kishoreganj Sadar',
    'Kuliarchar',
    'Mithamain',
    'Nikli',
    'Pakundia',
    'Tarail'
  ],

  'Kurigram': [
    'Bhurungamari',
    'Char Rajibpur',
    'Chilmari',
    'Fulbari',
    'Kurigram Sadar',
    'Nageshwari',
    'Rajarhat',
    'Raumari',
    'Ulipur'
  ],

  'Kushtia': [
    'Bheramara',
    'Daulatpur',
    'Khoksa',
    'Kumarkhali',
    'Kushtia Sadar',
    'Mirpur'
  ],

  'Lakshmipur': [
    'Kamalnagar',
    'Lakshmipur Sadar',
    'Raipur',
    'Ramganj',
    'Ramgati'
  ],

  'Lalmonirhat': [
    'Aditmari',
    'Hatibandha',
    'Kaliganj',
    'Lalmonirhat Sadar',
    'Patgram'
  ],

  'Madaripur': [
    'Dasar',
    'Kalkini',
    'Madaripur Sadar',
    'Rajoir',
    'Shibchar'
  ],

  'Magura': [
    'Magura Sadar',
    'Mohammadpur',
    'Shalikha',
    'Sreepur'
  ],

  'Manikganj': [
    'Daulatpur',
    'Ghior',
    'Harirampur',
    'Manikganj Sadar',
    'Saturia',
    'Shibalaya',
    'Singair'
  ],

  'Meherpur': [
    'Gangni',
    'Meherpur Sadar',
    'Mujibnagar'
  ],

  'Moulvibazar': [
    'Barlekha',
    'Juri',
    'Kamalganj',
    'Kulaura',
    'Moulvibazar Sadar',
    'Rajnagar',
    'Sreemangal'
  ],

  'Munshiganj': [
    'Gazaria',
    'Lohajang',
    'Munshiganj Sadar',
    'Sirajdikhan',
    'Sreenagar',
    'Tongibari'
  ],

  'Mymensingh': [
    'Bhaluka',
    'Dhobaura',
    'Fulbaria',
    'Gafargaon',
    'Gauripur',
    'Haluaghat',
    'Ishwarganj',
    'Muktagachha',
    'Mymensingh Sadar',
    'Nandail',
    'Phulpur',
    'Tarakanda',
    'Trishal'
  ],

  'Naogaon': [
    'Atrai',
    'Badalgachhi',
    'Dhamoirhat',
    'Manda',
    'Mohadevpur',
    'Naogaon Sadar',
    'Niamatpur',
    'Patnitala',
    'Porsha',
    'Raninagar',
    'Sapahar'
  ],

  'Narail': [
    'Kalia',
    'Lohagara',
    'Narail Sadar'
  ],

  'Narayanganj': [
    'Araihazar',
    'Bandar',
    'Fatullah',
    'Narayanganj Sadar',
    'Rupganj',
    'Siddhirganj',
    'Sonargaon'
  ],

  'Narsingdi': [
    'Belabo',
    'Monohardi',
    'Narsingdi Sadar',
    'Palash',
    'Raipura',
    'Shibpur'
  ],

  'Natore': [
    'Bagatipara',
    'Baraigram',
    'Gurudaspur',
    'Lalpur',
    'Naldanga',
    'Natore Sadar',
    'Singra'
  ],

  'Netrokona': [
    'Atpara',
    'Barhatta',
    'Durgapur',
    'Kalmakanda',
    'Kendua',
    'Khaliajuri',
    'Madan',
    'Mohanganj',
    'Netrokona Sadar',
    'Purbadhala'
  ],

  'Nilphamari': [
    'Dimla',
    'Domar',
    'Jaldhaka',
    'Kishoreganj',
    'Nilphamari Sadar',
    'Saidpur'
  ],

  'Noakhali': [
    'Begumganj',
    'Chatkhil',
    'Companiganj',
    'Hatiya',
    'Kabirhat',
    'Noakhali Sadar',
    'Senbagh',
    'Sonaimuri',
    'Subarnachar'
  ],

  'Pabna': [
    'Atgharia',
    'Bera',
    'Bhangura',
    'Chatmohar',
    'Faridpur',
    'Ishwardi',
    'Pabna Sadar',
    'Santhia',
    'Sujanagar'
  ],

  'Panchagarh': [
    'Atwari',
    'Boda',
    'Debiganj',
    'Panchagarh Sadar',
    'Tetulia'
  ],

  'Patuakhali': [
    'Bauphal',
    'Dashmina',
    'Dumki',
    'Galachipa',
    'Kalapara',
    'Mirzaganj',
    'Patuakhali Sadar',
    'Rangabali'
  ],

  'Pirojpur': [
    'Bhandaria',
    'Indurkani',
    'Kawkhali',
    'Mathbaria',
    'Nazirpur',
    'Nesarabad',
    'Pirojpur Sadar'
  ],

  'Rajbari': [
    'Baliakandi',
    'Goalanda',
    'Kalukhali',
    'Pangsha',
    'Rajbari Sadar'
  ],

  'Rajshahi': [
    'Bagha',
    'Bagmara',
    'Boalia',
    'Charghat',
    'Durgapur',
    'Godagari',
    'Matihar',
    'Mohanpur',
    'Paba',
    'Puthia',
    'Rajpara',
    'Shah Makhdum',
    'Tanore'
  ],

  'Rangamati': [
    'Baghaichhari',
    'Barkal',
    'Belaichhari',
    'Juraichhari',
    'Kaptai',
    'Kawkhali',
    'Langadu',
    'Naniarchar',
    'Rajsthali',
    'Rangamati Sadar'
  ],

  'Rangpur': [
    'Badarganj',
    'Gangachara',
    'Kaunia',
    'Mithapukur',
    'Pirgachha',
    'Pirganj',
    'Rangpur Sadar',
    'Taraganj'
  ],

  'Satkhira': [
    'Assasuni',
    'Debhata',
    'Kalaroa',
    'Kaliganj',
    'Satkhira Sadar',
    'Shyamnagar',
    'Tala'
  ],

  'Shariatpur': [
    'Bhedarganj',
    'Damudya',
    'Gosairhat',
    'Naria',
    'Shariatpur Sadar',
    'Zajira'
  ],

  'Sherpur': [
    'Jhenaigati',
    'Nakla',
    'Nalitabari',
    'Sherpur Sadar',
    'Sreebardi'
  ],

  'Sirajganj': [
    'Belkuchi',
    'Chauhali',
    'Kamarkhanda',
    'Kazipur',
    'Raiganj',
    'Shahjadpur',
    'Sirajganj Sadar',
    'Tarash',
    'Ullahpara'
  ],

  'Sunamganj': [
    'Bishwamvarpur',
    'Chhatak',
    'Derai',
    'Dharamapasha',
    'Dowarabazar',
    'Jagannathpur',
    'Jamalganj',
    'Madhyanagar',
    'Shantiganj',
    'Sulla',
    'Sunamganj Sadar',
    'Tahirpur'
  ],

  'Sylhet': [
    'Balaganj',
    'Beanibazar',
    'Bishwanath',
    'Companiganj',
    'Dakshin Surma',
    'Fenchuganj',
    'Golapganj',
    'Gowainghat',
    'Jaintiapur',
    'Kanaighat',
    'Osmani Nagar',
    'Sylhet Sadar',
    'Zakiganj'
  ],

  'Tangail': [
    'Basail',
    'Bhuapur',
    'Delduar',
    'Dhanbari',
    'Ghatail',
    'Gopalpur',
    'Kalihati',
    'Madhupur',
    'Mirzapur',
    'Nagarpur',
    'Sakhipur',
    'Tangail Sadar'
  ],

  'Thakurgaon': [
    'Baliadangi',
    'Haripur',
    'Pirganj',
    'Ranishankail',
    'Thakurgaon Sadar'
  ]
}
};

/* ================================================================
   HELPERS
   ================================================================ */
function genEventId() {
  return `ev_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function genOrderId() {
  const now = new Date();
  const d  = String(now.getDate()).padStart(2, '0');
  const mo = String(now.getMonth() + 1).padStart(2, '0');
  const y  = now.getFullYear();
  const h  = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const s  = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  const perf = String(performance.now()).replace('.', '').slice(0, 9).padEnd(9, '0');
  return `KR-${d}${mo}${y}-${h}${mi}${s}${ms}${perf}`;
}

function normalizePhone(raw) {
  if (!raw) return '';
  let p = raw.trim().replace(/[\s\-()]/g, '');
  if (p.startsWith('0088')) p = p.slice(4);
  else if (p.startsWith('+880')) p = p.slice(4);
  else if (p.startsWith('880'))  p = p.slice(3);
  if (!p.startsWith('0')) p = '0' + p;
  return p;
}

function isValidBDPhone(raw) {
  const p = normalizePhone(raw);
  return /^01[3-9]\d{8}$/.test(p);
}

function getCookie(name) {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : '';
}

function getUrlParam(p) {
  try { return new URLSearchParams(window.location.search).get(p) || ''; }
  catch (e) { return ''; }
}

function getUtmParams() {
  return {
    utm_source:   getUrlParam('utm_source'),
    utm_medium:   getUrlParam('utm_medium'),
    utm_campaign: getUrlParam('utm_campaign'),
    utm_content:  getUrlParam('utm_content'),
    utm_term:     getUrlParam('utm_term')
  };
}

function getFbclidFromUrl() {
  const fbclid = getUrlParam('fbclid');
  return fbclid ? `fb.1.${Date.now()}.${fbclid}` : '';
}

function getOrCreateUserId() {
  let uid = localStorage.getItem('kr_user_id');
  if (!uid) {
    uid = 'kru_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('kr_user_id', uid);
  }
  return uid;
}

/* ================================================================
   USER PROFILE MANAGER (Permanent History)
   ================================================================ */
const UserProfile = {
  data: null,

  init() {
    this.data = this.load();
    this.data.visitCount = (this.data.visitCount || 0) + 1;
    this.data.lastSeen = Date.now();
    this.save();
    console.log('[UserProfile] Visit #', this.data.visitCount, '| User:', this.data.userId);
  },

  load() {
    try {
      const raw = localStorage.getItem('kr_user_profile');
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return {
      userId: getOrCreateUserId(),
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      visitCount: 0,
      allNames: [],
      allPhones: [],
      allEmails: [],
      allAddresses: [],
      allDistricts: [],
      orders: [],
      sessions: []
    };
  },

  save() {
    try { localStorage.setItem('kr_user_profile', JSON.stringify(this.data)); }
    catch(e) { console.warn('[UserProfile] Save failed', e); }
  },

  recordSession(session) {
    const summary = {
      sessionId: session.sessionId,
      startTime: session.startTime,
      endTime: session.endTime || Date.now(),
      stage: session.stage,
      landingPage: session.landingPage,
      utm: session.utm,
      timeOnSite: Math.floor((Date.now() - session.startTime) / 1000),
      events: session.events,
      formData: { ...session.formData },
      productsViewed: session.productsViewed.map(p => ({ id: p.id, name: p.name, price: p.price })),
      cartActions: session.cartActions.map(a => ({ pid: a.pid, name: a.name, size: a.size, color: a.color, qty: a.qty }))
    };
    this.data.sessions.unshift(summary);
    if (this.data.sessions.length > 20) this.data.sessions = this.data.sessions.slice(0, 20);
    this.save();
  },

  recordOrder(orderData) {
    const order = {
      orderId: orderData.orderId,
      date: Date.now(),
      total: orderData.totalPayable || (orderData.totals && orderData.totals.totalPayable) || 0,
      items: (orderData.items || []).map(i => i.productName || i.item_name || 'Unknown')
    };
    this.data.orders.unshift(order);
    if (this.data.orders.length > 20) this.data.orders = this.data.orders.slice(0, 20);
    try { localStorage.setItem('kr_has_ordered', '1'); } catch(e) {}
    this.save();
  },

  mergeFormData({ name, phone, email, address, district }) {
    if (name && name.trim() && !this.data.allNames.includes(name.trim())) {
      this.data.allNames.unshift(name.trim());
    }
    if (phone && phone.trim() && !this.data.allPhones.includes(phone.trim())) {
      this.data.allPhones.unshift(phone.trim());
    }
    if (email && email.trim() && !this.data.allEmails.includes(email.trim())) {
      this.data.allEmails.unshift(email.trim());
    }
    if (address && address.trim() && !this.data.allAddresses.includes(address.trim())) {
      this.data.allAddresses.unshift(address.trim());
    }
    if (district && district.trim() && !this.data.allDistricts.includes(district.trim())) {
      this.data.allDistricts.unshift(district.trim());
    }
    this.save();
  }
};

/* ================================================================
   SESSION TRACKER (Current Visit)
   ================================================================ */
const SessionTracker = {
  session: null,

  init() {
    this.session = {
      sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      startTime: Date.now(),
      landingPage: window.location.href,
      utm: getUtmParams(),
      events: ['landing'],
      productsViewed: [],
      cartActions: [],
      formData: { name: '', phone: '', email: '', address: '', district: '' },
      stage: 'landing',
      maxScroll: 0
    };
  },

  recordEvent(name) {
    if (!this.session.events.includes(name)) {
      this.session.events.push(name);
    }
  },

  recordProductView(product) {
    const exists = this.session.productsViewed.find(p => p.id === product.id);
    if (!exists) {
      this.session.productsViewed.push({
        id: product.id,
        name: product.name_en,
        price: product.price
      });
    }
    this.setStage('product_viewed');
  },

  recordCartAction({ pid, name, size, color, qty, price }) {
    this.session.cartActions = this.session.cartActions.filter(
      a => !(a.pid === pid && a.size === size && a.color === color)
    );
    this.session.cartActions.push({ pid, name, size, color, qty, price });
    this.setStage('added_to_cart');
  },

  recordFormField(field, value) {
    this.session.formData[field] = value;
    this.recordEvent('form_touched');
    this.setStage('form_touched');
    UserProfile.mergeFormData(this.session.formData);
  },

  setStage(stage) {
    const stages = ['landing','product_viewed','size_selected','color_selected','added_to_cart','form_touched','checkout_started','payment_selected','purchased'];
    const currentIdx = stages.indexOf(this.session.stage);
    const newIdx = stages.indexOf(stage);
    if (newIdx > currentIdx) this.session.stage = stage;
  },

  getTimeOnSite() {
    const sec = Math.floor((Date.now() - this.session.startTime) / 1000);
    return { m: Math.floor(sec / 60), s: sec % 60, totalSec: sec };
  },

  finalize() {
    this.session.endTime = Date.now();
    return { ...this.session };
  }
};

/* ================================================================
   LEAD MESSENGER (via Cloudflare Worker)
   🔒 No more direct Telegram/Sheets calls from frontend
   ================================================================ */
const LeadMessenger = {
  sent: false,
  cartTimer: null,

  init() {
    this.bindPageLeave();
  },

  bindPageLeave() {
    const trySend = (reason) => {
      if (this.sent) return;
      const session = SessionTracker.finalize();
      const time = SessionTracker.getTimeOnSite();

      const meaningful = time.totalSec > 5 ||
                         session.events.length > 1 ||
                         session.formData.phone ||
                         session.cartActions.length > 0;
      if (!meaningful) {
        console.log('[LeadMessenger] Visit too short, skipping');
        return;
      }

      this.sent = true;
      UserProfile.recordSession(session);
      this.sendViaWorker(reason, session);
    };

    window.addEventListener('beforeunload', () => trySend('Page Leave'));
    window.addEventListener('pagehide',     () => trySend('Page Hide'));

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        setTimeout(() => {
          if (document.visibilityState === 'hidden' && !this.sent) {
            trySend('Tab Hidden');
          }
        }, 15000);
      }
    });
  },

  startCartAbandonmentTimer(minutes) {
    if (this.cartTimer) clearTimeout(this.cartTimer);
    console.log(`[LeadMessenger] Cart timer: ${minutes} min`);
    this.cartTimer = setTimeout(() => {
      if (this.sent) return;
      const session = SessionTracker.finalize();
      if (session.cartActions.length === 0) return;

      this.sent = true;
      UserProfile.recordSession(session);
      this.sendViaWorker('Cart Abandoned', session);
    }, minutes * 60 * 1000);
  },

  /* Build compact Telegram message (under 4096 chars) — UNCHANGED */
  buildMessage(reason, session) {
    const p = UserProfile.data;
    const time = SessionTracker.getTimeOnSite();
    const fd = session.formData;

    let msg = '';

    msg += `🆔 ${p.userId} | #${p.visitCount} | ${time.m}m${time.s}s | 🎯${session.stage}\n`;
    msg += `🔗 ${session.utm.utm_source || 'Direct'}${session.utm.utm_campaign ? '/' + session.utm.utm_campaign : ''}\n`;
    msg += `📄 ${session.landingPage.substring(0, 70)}\n\n`;

    msg += `👤 CURRENT\n`;
    if (fd.name)  msg += `Name: ${fd.name}\n`;
    if (fd.phone) msg += `Phone: ${fd.phone}\n`;
    if (fd.email) msg += `Email: ${fd.email}\n`;
    if (fd.address) msg += `Addr: ${fd.address}\n`;
    if (fd.district) msg += `Dist: ${fd.district}\n`;
    if (!fd.name && !fd.phone) msg += `(Anonymous)\n`;

    if (session.productsViewed.length) {
      msg += `\n👁 ${session.productsViewed.map(x => x.name + '(৳' + x.price + ')').join(', ')}\n`;
    }
    if (session.cartActions.length) {
      msg += `🛒 ${session.cartActions.map(x => x.name + '-' + x.size + '/' + x.color + '×' + x.qty).join(', ')}\n`;
    }
    msg += `📊 ${session.events.join('→')}\n`;

    const visits = p.sessions.slice(0, 3);
    if (visits.length) {
      msg += `\n📜 HISTORY(last${visits.length})\n`;
      visits.forEach((v, i) => {
        const ago = this.formatAgo(v.endTime || v.startTime);
        const vSec = Math.floor(((v.endTime || v.startTime) - v.startTime) / 1000);
        const vFd = v.formData || {};
        msg += `#${i+1} ${ago} ${Math.floor(vSec/60)}m${vSec%60}s ${v.stage} ${v.utm?.utm_source || 'Direct'}`;
        if (vFd.name || vFd.phone) {
          const parts = [];
          if (vFd.name) parts.push(vFd.name);
          if (vFd.phone) parts.push(vFd.phone);
          if (vFd.district) parts.push(vFd.district);
          msg += ` (${parts.join(', ')})`;
        }
        msg += '\n';
      });
    }

    const orders = p.orders.slice(0, 3);
    if (orders.length) {
      msg += `\n💰 ORDERS(last${orders.length})\n`;
      orders.forEach(o => {
        msg += `${o.orderId} ৳${o.total} ${o.items.length}items ${this.formatAgo(o.date)}\n`;
      });
    }

    msg += `\n🗂️ ALL\n`;
    if (p.allNames.length) msg += `Names: ${p.allNames.slice(0, 5).join(', ')}\n`;
    if (p.allPhones.length) msg += `Phones: ${p.allPhones.slice(0, 5).join(', ')}\n`;
    if (p.allEmails.length) msg += `Emails: ${p.allEmails.slice(0, 3).join(', ')}\n`;
    if (p.allAddresses.length) msg += `Addrs: ${p.allAddresses.slice(0, 3).join(', ')}\n`;
    if (p.allDistricts.length) msg += `Dists: ${p.allDistricts.slice(0, 3).join(', ')}\n`;

    return msg;
  },

  formatAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return 'now';
    if (sec < 3600) return Math.floor(sec/60) + 'm';
    if (sec < 86400) return Math.floor(sec/3600) + 'h';
    return Math.floor(sec/86400) + 'd';
  },

  /* 🔒 NEW: Send via Cloudflare Worker (replaces direct Telegram + Sheets calls) */
  async sendViaWorker(reason, session) {
    const telegramMessage = this.buildMessage(reason, session);

    const p  = UserProfile.data;
    const fd = session.formData;
    const time = SessionTracker.getTimeOnSite();

    const sheetsPayload = {
      date:           new Date().toLocaleString('en-BD'),
      userId:         p.userId,
      visitCount:     p.visitCount,
      sessionId:      session.sessionId,
      stage:          session.stage,
      name:           fd.name,
      phone:          fd.phone,
      email:          fd.email,
      address:        fd.address,
      district:       fd.district,
      source:         session.utm.utm_source   || 'Direct',
      campaign:       session.utm.utm_campaign || '',
      landingPage:    session.landingPage,
      timeOnSite:     time.m + 'm' + time.s + 's',
      productsViewed: session.productsViewed.map(x => x.name).join(', '),
      cartItems:      session.cartActions.map(
                        x => x.name + '(' + x.size + '/' + x.color + ')x' + x.qty
                      ).join('; '),
      events:         session.events.join('→'),
      orderCount:     p.orders.length,
      totalSpent:     p.orders.reduce((s, o) => s + (o.total || 0), 0)
    };

    if (typeof window.sendLeadToWorker === 'function') {
      try {
        await window.sendLeadToWorker(telegramMessage, sheetsPayload);
        console.log('[LeadMessenger] ✅ Sent via Worker');
      } catch(e) {
        console.error('[LeadMessenger] ❌ Worker failed:', e.message);
      }
    } else {
      console.warn('[LeadMessenger] sendLeadToWorker not available (api.js loaded?)');
    }
  }
};

/* ================================================================
   DATALAYER PUSH (GTM/GA4) — UNCHANGED
   ================================================================ */
window.dataLayer = window.dataLayer || [];

function krPush(eventName, data) {
  const eventId = genEventId();
  const payload = {
    event: eventName,
    event_id: eventId,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: window.location.href,
    page_title: document.title,
    user_id: UserProfile.data ? UserProfile.data.userId : getOrCreateUserId(),
    fbp: getCookie('_fbp'),
    fbc: getCookie('_fbc') || getFbclidFromUrl(),
    user_agent: navigator.userAgent,
    ...getUtmParams(),
    ...data
  };
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push(payload);
  console.log(`[krPush] ${eventName}`, payload);
  return eventId;
}

/* ================================================================
   ECOMMERCE EVENTS — UNCHANGED
   ================================================================ */
const trackedEvents = { viewItem: new Set(), addToCart: new Map() };

function trackViewItemOnce(product) {
  if (!product) return;
  const key = String(product.id);
  if (trackedEvents.viewItem.has(key)) return;
  trackedEvents.viewItem.add(key);
  if (typeof pushViewItem === 'function') pushViewItem(product);
}

function trackAddToCartThrottled(product, qty, size, color) {
  if (!product || !qty) return;
  const variantLabel = [size,color].filter(Boolean).join(' / ') || 'Default';
  const key = `${product.id}_${variantLabel}_${qty}`;
  const now = Date.now();
  const last = trackedEvents.addToCart.get(key) || 0;
  if (now - last < 1500) return;
  trackedEvents.addToCart.set(key, now);
  if (typeof pushAddToCart === 'function') pushAddToCart(product, qty, variantLabel, '');
}

function pushViewItem(product) {
  krPush('view_item', {
    ecommerce: {
      currency: 'BDT', value: product.price,
      items: [{ item_id: String(product.id), item_name: product.name_en, category: product.category, price: product.price, quantity: 1 }],
      detail: { products: [{ id: String(product.id), name: product.name_en, category: product.category, price: product.price }] }
    }
  });
}

function pushAddToCart(product, qty, size, color) {
  const variantLabel = [size,color].filter(Boolean).join(' / ') || 'Default';
  const value = product.price * qty;
  krPush('add_to_cart', {
    ecommerce: {
      currency: 'BDT', value: value,
      items: [{ item_id: String(product.id), item_name: product.name_en, category: product.category, price: product.price, quantity: qty, item_variant: variantLabel }],
      detail: { products: [{ id: String(product.id), name: product.name_en, category: product.category, price: product.price }] }
    }
  });
}

function pushBeginCheckout(items, total) {
  krPush('begin_checkout', {
    ecommerce: {
      currency: 'BDT', currencyCode: 'BDT', value: total, items: items,
      detail: { products: items.map(i => ({ id: i.item_id, name: i.item_name, category: i.category || 'Exclusive', price: i.price })) }
    }
  });
}

function pushAddPaymentInfo(value, paymentMethod) {
  krPush('add_payment_info', { ecommerce: { currency: 'BDT', value: value, payment_method: paymentMethod } });
}

function pushWhatsappOrder(value, numItems) {
  krPush('whatsapp_order', { ecommerce: { currency: 'BDT', value: value, num_items: numItems } });
}

function pushPurchase(orderData) {
  const orderId        = orderData.orderId;
  const totalPayable   = orderData.totalPayable || (orderData.totals && orderData.totals.totalPayable) || 0;
  const deliveryCharge = orderData.deliveryCharge || (orderData.totals && orderData.totals.delivery) || 0;
  const items          = orderData.items || [];
  const customer       = orderData.customer || {};
  const couponCode     = orderData.couponCode || '';

  const nameParts = (customer.name || '').trim().split(' ');
  const firstName = nameParts[0] || '';
  const lastName  = nameParts.slice(1).join(' ') || '';

  krPush('purchase', {
    ecommerce: {
      transaction_id: orderId, value: totalPayable, currency: 'BDT', shipping: deliveryCharge,
      items: items.map(i => ({ item_id: String(i.productId ?? i.item_id ?? ''), item_name: i.productName ?? i.item_name ?? '', category: i.category || 'Exclusive', price: Number(i.unitPrice ?? i.price ?? 0), quantity: Number(i.quantity || 0), product_id: String(i.productId ?? i.item_id ?? ''), item_variant: (i.options||[]).map(o=>o.value_en||o.value||'').filter(Boolean).join(' / ') }))
    },
    orderData: {
      customer: {
        billing: {
          email: customer.email || '', phone: normalizePhone(customer.phone),
          first_name: firstName, last_name: lastName, country: 'BD',
          city: customer.district || '', postal_code: '', coupon: couponCode || ''
        }
      }
    }
  });

  if (window.UserProfile) {
    window.UserProfile.recordOrder(orderData);
  }
}

/* ================================================================
   DELIVERY & TOTALS — UNCHANGED
   ================================================================ */
function calcDelivery(district, subtotal) {
  if (subtotal >= KR.DELIVERY.FREE_AT) return 0;
  const isDhaka = KR.DHAKA_DISTRICTS.some(d => d.toLowerCase() === (district || '').toLowerCase());
  return isDhaka ? KR.DELIVERY.DHAKA : KR.DELIVERY.OUTSIDE;
}

function getCommerceUnitPrice(inst) {
  const product=KR.PRODUCTS[inst.pid];if(!product)return 0;
  const variant=(product.variants||[]).find(v=>Number(v.id)===Number(inst.variantId));
  return Number(inst.unitPrice ?? variant?.priceOverride ?? product.price ?? 0);
}
function getCommerceOptionText(product,inst,lang) {
  const selections=inst.selections||{};
  return (product.options||[]).map(o=>{
    const selected=selections[o.code];if(!selected)return null;
    const v=(o.values||[]).find(x=>String(x.code)===String(selected));
    const label=lang==='bn'?(o.label_bn||o.label_en):o.label_en;
    const value=v?(lang==='bn'?(v.value_bn||v.value_en):v.value_en):selected;
    return `${label}: ${value}`;
  }).filter(Boolean).join(' / ');
}
function calcTotals(instances, district, couponCode, advancePaid) {
  let subtotal=0;instances.forEach(inst=>{if(inst.qty>0)subtotal+=getCommerceUnitPrice(inst)*inst.qty;});
  /* কুপন সংখ্যা আসে সার্ভার কোট থেকে (main.js → /api/coupons/validate),
     কোনো হার্ডকোডেড ফ্রন্টএন্ড তালিকা নেই। অর্ডারে Worker আবার হিসাব করে। */
  const quote=(couponCode&&window.KR_COUPON_QUOTE&&window.KR_COUPON_QUOTE.code===String(couponCode).toUpperCase())?window.KR_COUPON_QUOTE:null;
  const discountAmt=quote?Math.min(subtotal,Math.round(Number(quote.discountAmt)||0)):0;
  const subtotalAfterDiscount=subtotal-discountAmt;
  let delivery=calcDelivery(district,subtotalAfterDiscount);
  if(quote&&quote.freeDelivery)delivery=0;
  const totalPayable=subtotalAfterDiscount+delivery,codRemaining=Math.max(0,totalPayable-(advancePaid||0));
  const discountPct=quote&&quote.type==='percent'?Number(quote.value)||0:0;
  return {subtotal,discountPct,discountAmt,subtotalAfterDiscount,delivery,totalPayable,codRemaining};
}

/* ================================================================
   WHATSAPP MESSAGE BUILDER — UNCHANGED
   ================================================================ */
function buildOrderMessage(orderId, instances, customer, payment, couponCode, totals) {
  const lang=document.documentElement.getAttribute('data-lang')||'en',line='━━━━━━━━━━━━━━━━━━━━━━',active=instances.filter(i=>i.qty>0),totalQty=active.reduce((sum,i)=>sum+i.qty,0);
  const productLines=active.map(i=>{const p=KR.PRODUCTS[i.pid];if(!p)return'';const name=lang==='bn'?p.name_bn:p.name_en,opts=getCommerceOptionText(p,i,lang)||'Default',price=getCommerceUnitPrice(i);return `🔹 ${name}\n      ${opts} × ${i.qty} = ৳${(price*i.qty).toLocaleString()}`;}).filter(Boolean).join('\n');
  let msg=`🛒 NEW ORDER — KORA ROYAL\n${line}\n🆔 Order ID: ${orderId}\n📅 Date: ${new Date().toLocaleString('en-BD',{hour12:true})}\n${line}\n\n👤 CUSTOMER INFO\n${line}\n👨‍💼 Name ${customer.name}\n📞 Phone ${normalizePhone(customer.phone)}\n`;
  if(customer.email)msg+=`📧 Email ${customer.email}\n`;msg+=`📍 District ${customer.district}${customer.thana?' / '+customer.thana:''}\n🏠 Address ${customer.address}\n${line}\n\n📦 PRODUCTS (Total Qty: ${totalQty})\n${line}\n${productLines}\n${line}\n\n💳 PAYMENT SUMMARY\n${line}\n🧾 Subtotal ৳${totals.subtotal.toLocaleString()}\n🚚 Delivery ৳${totals.delivery.toLocaleString()}\n`;
  if(totals.discountAmt>0)msg+=`🎟️ Discount -৳${totals.discountAmt.toLocaleString()} (${couponCode})\n`;msg+=`💰 Total ৳${totals.totalPayable.toLocaleString()}\n\n`;
  if(payment.method==='COD')msg+='💵 Payment Cash on Delivery\n';else{msg+=`📲 Method ${payment.method}\n`;if(payment.trxId)msg+=`🔑 Trx ID ${payment.trxId}\n`;msg+=`✅ Advance ৳${(payment.advance||0).toLocaleString()}\n🚪 COD Due ৳${totals.codRemaining.toLocaleString()}\n`;}
  if(customer.note)msg+=`\n📝 Note: ${customer.note}\n`;return msg+`\n${line}\n✅ Powered by KORA ROYAL`;
}

function updateWALink(orderId, instances, customer, payment, couponCode, totals) {
  const btn = document.getElementById('waOrderBtn');
  if (!btn) return;
  const msg = buildOrderMessage(orderId, instances, customer, payment, couponCode, totals);
  const num = KR.WHATSAPP.replace(/[^0-9]/g, '');
  btn.href = `https://wa.me/${num}?text=${encodeURIComponent(msg)}`;
}

/* ================================================================
   GOOGLE SHEETS (Orders) — NOW VIA WORKER
   🔒 Sheet URL is hidden in Cloudflare Worker
   ================================================================ */
async function sendToSheets(orderData) {
  if (typeof window.sendOrderToWorker === 'function') {
    const result = await window.sendOrderToWorker(orderData);
    return result.sheets;
  }
  console.error('[KR] sendOrderToWorker not found — is api.js loaded?');
  return false;
}

/* ================================================================
   TELEGRAM ORDER BOT — NOW VIA WORKER
   🔒 Bot Token is hidden in Cloudflare Worker
   ================================================================ */
async function sendToTelegram(orderData) {
  if (typeof window.sendOrderToWorker === 'function') {
    const result = await window.sendOrderToWorker(orderData);
    return result.telegram;
  }
  console.error('[KR] sendOrderToWorker not found — is api.js loaded?');
  return false;
}

/* ================================================================
   INITIALIZATION — UNCHANGED
   ================================================================ */
function initTracking() {
  UserProfile.init();
  SessionTracker.init();
  LeadMessenger.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTracking);
} else {
  initTracking();
}








/* ================================================================
   EXPORTS — UNCHANGED
   ================================================================ */
window.KR = KR;
window.krPush = krPush;
window.pushViewItem = pushViewItem;
window.pushAddToCart = pushAddToCart;
window.pushBeginCheckout = pushBeginCheckout;
window.pushAddPaymentInfo = pushAddPaymentInfo;
window.pushWhatsappOrder = pushWhatsappOrder;
window.pushPurchase = pushPurchase;
window.UserProfile = UserProfile;
window.SessionTracker = SessionTracker;
window.LeadMessenger = LeadMessenger;
window.genEventId = genEventId;
window.genOrderId = genOrderId;
window.normalizePhone = normalizePhone;
window.isValidBDPhone = isValidBDPhone;
window.calcDelivery = calcDelivery;
window.calcTotals = calcTotals;
window.buildOrderMessage = buildOrderMessage;
window.updateWALink = updateWALink;
window.sendToSheets = sendToSheets;
window.sendToTelegram = sendToTelegram;
window.trackViewItemOnce = trackViewItemOnce;
window.trackAddToCartThrottled = trackAddToCartThrottled;
window.getOrCreateUserId = getOrCreateUserId;