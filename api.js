/* Rabiti data layer: Supabase auth, store drafts, orders, payments. */
import { slugify, uid, safeUrl } from './ui.js';

const cfg = window.RABITI_CONFIG || {};
export const configured = !!(cfg.supabaseUrl && cfg.supabasePublishableKey);
export let client = null;
export let user = null;

export function initClient() {
  if (client) return client;
  if (!configured) throw new Error('لم يتم ضبط اتصال Supabase في config.js');
  if (!window.supabase?.createClient) throw new Error('تعذّر تحميل مكتبة Supabase');
  client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return client;
}

/* ---------- friendly errors ---------- */
const ERRORS = {
  AUTH_REQUIRED: 'انتهت الجلسة. سجّل الدخول من جديد.',
  STORE_REQUIRED: 'أنشئ متجرك أولًا.',
  REVISION_CONFLICT: 'هناك تعديلات أحدث من جهاز آخر. أعد تحميل الصفحة قبل الحفظ.',
  PAID_SOURCE_REQUIRED: 'كل منتج مدفوع يحتاج رابط تسليم أو ملفًا قبل النشر.',
  INVALID_LINK_URL: 'رابط المنتج المجاني يجب أن يبدأ بـ https://',
  PAYMENT_METHOD_REQUIRED: 'أضف طريقة دفع واحدة على الأقل قبل بيع منتج مدفوع.',
  PAYMENT_NOT_CONFIGURED: 'فعّل YouCan Pay أو أضف طريقة دفع يدوية أولًا.',
  PAYMENT_KEYS_REQUIRED: 'أدخل المفتاح العام والخاص لـ YouCan Pay.',
  INVALID_PUBLIC_KEY: 'المفتاح العام لـ YouCan Pay غير صالح.',
  INVALID_PRIVATE_KEY: 'المفتاح الخاص لـ YouCan Pay غير صالح.',
  INVALID_SLUG: 'رابط المتجر غير صالح: 3 إلى 40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة.',
  SLUG_TAKEN: 'هذا الرابط محجوز. اختر رابطًا آخر.',
  STORE_NOT_PUBLISHED: 'المتجر غير منشور بعد.',
  INVALID_ITEMS: 'السلة فارغة أو غير صالحة.',
  INVALID_NAME: 'اكتب اسمك الكامل.',
  INVALID_EMAIL: 'البريد الإلكتروني غير صالح.',
  INVALID_PHONE: 'رقم الهاتف طويل جدًا.',
  TOO_MANY_ORDERS: 'طلبات كثيرة من نفس البريد. انتظر قليلًا ثم أعد المحاولة.',
  PRODUCT_NOT_FOUND: 'أحد المنتجات لم يعد متاحًا. أعد تحميل الصفحة.',
  PRODUCT_NOT_PAID: 'هذا المنتج ليس للبيع.',
  CURRENCY_MISMATCH: 'عملة المنتج لا تطابق عملة المتجر.',
  INVALID_PRICE: 'سعر المنتج غير صالح.',
  INVALID_QTY: 'الكمية غير صالحة.',
  INVALID_COUPON: 'كود الخصم غير صالح أو منتهي.',
  INVALID_PAYMENT_METHOD: 'طريقة الدفع غير متاحة.',
  ORDER_NOT_FOUND: 'لم نجد هذا الطلب.',
  ORDER_CLOSED: 'هذا الطلب مغلق.',
  ORDER_PAID: 'لا يمكن إلغاء طلب مدفوع. استرجعه بدلًا من ذلك.',
  PAYMENT_MISMATCH: 'المبلغ أو العملة لا يطابقان الطلب.',
  '23505': 'هذه القيمة مستخدمة بالفعل.',
  '42501': 'ليست لديك صلاحية لهذا الإجراء.',
  'Failed to fetch': 'تعذّر الاتصال. تحقق من الإنترنت ثم أعد المحاولة.'
};
export function errorText(e) {
  const raw = e?.message || String(e || '');
  if (raw.includes('duplicate key')) return ERRORS['23505'];
  const key = Object.keys(ERRORS).find((k) => raw.includes(k));
  if (key) return ERRORS[key];
  if (e?.code && ERRORS[e.code]) return ERRORS[e.code];
  return raw || 'حدث خطأ غير متوقع';
}

/* ---------- draft shape ---------- */
export const DESIGN_THEMES = [
  { id: 'sand', name: 'رملي', accent: '#0d9488', bg: '#fbf7f0', ink: '#1c1917' },
  { id: 'midnight', name: 'ليلي', accent: '#2dd4bf', bg: '#0b1220', ink: '#f8fafc' },
  { id: 'ocean', name: 'محيط', accent: '#0284c7', bg: '#f0f9ff', ink: '#0c4a6e' },
  { id: 'rose', name: 'وردي', accent: '#e11d48', bg: '#fff7f7', ink: '#3f1d2e' },
  { id: 'forest', name: 'غابة', accent: '#15803d', bg: '#f4f8f3', ink: '#14261b' },
  { id: 'violet', name: 'بنفسجي', accent: '#7c3aed', bg: '#faf5ff', ink: '#2e1065' },
  { id: 'mono', name: 'أحادي', accent: '#1c1917', bg: '#f5f5f4', ink: '#1c1917' }
];
export const defaultDraft = () => ({
  v: 4,
  lang: 'ar',
  profile: { name: '', bio: '', avatar: '', location: '' },
  design: {
    theme: 'sand', accent: '', bg: '', font: 'cairo', mode: 'auto', shape: 'round', fill: 'solid',
    social: 'buttons', divider: 'line', title: '', cols: 'auto', ratio: '1/1', fit: 'cover',
    price: 1, desc: 1, font2: '', footerOn: 1, footer: '', hero: 'split', layout: 'grid', showSearch: 1
  },
  shop: { currency: 'MAD', whatsapp: '', telegram: '', email: '', phone: '', city: '', terms: '', deliveryNote: '' },
  seo: { title: '', description: '', image: '' },
  sub: { mode: '', feed: '', endpoint: '', field: 'email', extra: '', email: '', title: '' },
  texts: { sub: '', dl: '', more: '' },
  checkout: { mode: 'manual', note: '', youcanpay: { enabled: false, publicKey: '', sandbox: false } },
  pay: [],
  links: [],
  products: []
});

const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizeDraft(raw) {
  const d = defaultDraft();
  const j = obj(raw);
  const out = {
    ...d, ...j,
    profile: { ...d.profile, ...obj(j.profile) },
    design: { ...d.design, ...obj(j.design) },
    shop: { ...d.shop, ...obj(j.shop) },
    seo: { ...d.seo, ...obj(j.seo) },
    sub: { ...d.sub, ...obj(j.sub) },
    texts: { ...d.texts, ...obj(j.texts) },
    checkout: { ...d.checkout, ...obj(j.checkout), youcanpay: { ...d.checkout.youcanpay, ...obj(obj(j.checkout).youcanpay) } },
    pay: arr(j.pay).map((m) => ({ id: m.id || uid('pay_'), t: m.t || '', d: m.d || '', u: m.u || '', kind: m.kind || 'manual', on: m.on === 0 || m.on === '0' ? 0 : 1 })),
    links: arr(j.links).map((l) => ({ id: l.id || uid('lnk_'), t: l.t || '', u: l.u || '', kind: l.kind || '', on: l.on === 0 || l.on === '0' ? 0 : 1, icon: l.icon || '' })),
    products: arr(j.products).map((p) => normalizeProduct(p))
  };
  if (!DESIGN_THEMES.some((t) => t.id === out.design.theme)) out.design.theme = 'sand';
  if (!['ar', 'en', 'fr'].includes(out.lang)) out.lang = 'ar';
  return out;
}
export function normalizeProduct(p) {
  const x = obj(p);
  let mode = x.mode || 'none';
  let link = x.link || '';
  if (mode === 'checkout') { mode = safeUrl(link) ? 'link' : 'none'; }
  if (mode === 'paid' && !x.src && x.lm) mode = 'none';
  if (!['link', 'file', 'paid', 'none'].includes(mode)) mode = 'none';
  return {
    id: x.id || uid('prd_'),
    t: x.t || '',
    d: x.d || '',
    pr: x.pr ?? '',
    cur: x.cur || '',
    imgs: arr(x.imgs).filter((s) => typeof s === 'string').slice(0, 6),
    on: x.on === 0 || x.on === '0' ? 0 : 1,
    mode,
    link: mode === 'link' ? link : '',
    fn: mode === 'file' ? (x.fn || '') : '',
    data: mode === 'file' ? (x.data || '') : '',
    src: mode === 'paid' ? {
      type: x.src?.type === 'file' ? 'file' : 'url',
      url: x.src?.url || '',
      data: x.src?.data || '',
      fn: x.src?.fn || ''
    } : null,
    badge: x.badge || '',
    compareAt: x.compareAt ?? '',
    category: x.category || '',
    deliveryNote: x.deliveryNote || '',
    stock: x.stock ?? ''
  };
}
export const newProduct = (mode = 'paid') => normalizeProduct({ id: uid('prd_'), t: '', d: '', pr: '', mode, on: 1, src: mode === 'paid' ? { type: 'url', url: '', data: '', fn: '' } : null });
export const newLink = () => ({ id: uid('lnk_'), t: '', u: '', kind: 'website', on: 1, icon: '' });
export const newPayMethod = () => ({ id: uid('pay_'), t: 'تحويل بنكي', d: '', u: '', kind: 'bank', on: 1 });

export const storeUrl = (slug) => {
  const u = new URL('public.html', location.href);
  u.searchParams.set('store', slug);
  return u.href;
};
export const checkoutUrl = (slug, order, token) => {
  const u = new URL('public.html', location.href);
  u.searchParams.set('store', slug);
  u.searchParams.set('order', order);
  u.searchParams.set('t', token);
  return u.href;
};

/* ---------- auth ---------- */
export async function getSession() {
  initClient();
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  user = data.session?.user || null;
  return data.session || null;
}
export async function getUser() {
  initClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  user = data.user || null;
  return data.user;
}
export function onAuth(cb) {
  initClient();
  return client.auth.onAuthStateChange((event, session) => { user = session?.user || null; cb(event, session); });
}
export async function signIn(email, password) {
  initClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  user = data.user;
  return data;
}
export async function signUp(email, password, name = '') {
  initClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim(), password,
    options: { emailRedirectTo: new URL('index.html', location.href).href, data: { name } }
  });
  if (error) throw error;
  return data;
}
export async function magicLink(email) {
  initClient();
  const { error } = await client.auth.signInWithOtp({
    email: email.trim(), options: { emailRedirectTo: new URL('index.html', location.href).href }
  });
  if (error) throw error;
}
export async function resetPassword(email) {
  initClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: new URL('index.html', location.href).href });
  if (error) throw error;
}
export async function updatePassword(password) {
  initClient();
  const { error } = await client.auth.updateUser({ password });
  if (error) throw error;
}
export async function signOut() {
  initClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  user = null;
}

/* ---------- store ---------- */
export async function loadStore() {
  initClient();
  if (!user) await getUser();
  if (!user) throw new Error('AUTH_REQUIRED');
  const { data, error } = await client.from('rabiti_stores').select('slug,draft,revision,updated_at').eq('owner_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, draft: normalizeDraft(data.draft) };
}
export async function createStore(slug, draft) {
  initClient();
  if (!user) await getUser();
  const { error } = await client.from('rabiti_stores').insert({ owner_id: user.id, slug, draft, revision: 0 });
  if (error) throw error;
  return loadStore();
}
export async function saveDraft(draft, revision) {
  initClient();
  const { data, error } = await client.rpc('rabiti_save', { p_draft: draft, p_revision: revision });
  if (error) throw error;
  return data;
}
export async function publish(revision) {
  initClient();
  const { data, error } = await client.rpc('rabiti_publish', { p_revision: revision });
  if (error) throw error;
  return data;
}
export async function unpublish() {
  initClient();
  const { error } = await client.rpc('rabiti_unpublish');
  if (error) throw error;
}
export async function preview() {
  initClient();
  const { data, error } = await client.rpc('rabiti_preview');
  if (error) throw error;
  return data;
}
export async function slugAvailable(slug) {
  initClient();
  const { data, error } = await client.rpc('rabiti_slug_available', { p_slug: slug });
  if (error) throw error;
  return !!data;
}
export async function changeSlug(slug) {
  initClient();
  const { data, error } = await client.rpc('rabiti_change_slug', { p_slug: slug });
  if (error) throw error;
  return data;
}
export async function deleteStore() {
  initClient();
  if (!user) await getUser();
  const { error } = await client.from('rabiti_stores').delete().eq('owner_id', user.id);
  if (error) throw error;
}

/* ---------- payments ---------- */
export async function paymentStatus() {
  initClient();
  const { data, error } = await client.rpc('rabiti_youcanpay_status');
  if (error) throw error;
  return data || { enabled: false, publicKey: '', sandbox: false, hasPrivateKey: false };
}
export async function setYoucanpay(publicKey, privateKey, sandbox, enabled) {
  initClient();
  const { data, error } = await client.rpc('rabiti_set_youcanpay', {
    p_public_key: publicKey, p_private_key: privateKey, p_sandbox: !!sandbox, p_enabled: !!enabled
  });
  if (error) throw error;
  return data;
}
export async function clearYoucanpay() {
  initClient();
  const { error } = await client.rpc('rabiti_clear_youcanpay');
  if (error) throw error;
}

/* ---------- stats ---------- */
export async function stats() {
  initClient();
  const { data, error } = await client.rpc('rabiti_stats');
  if (error) throw error;
  return data;
}

/* ---------- orders ---------- */
const safeSearch = (q) => String(q || '').replace(/[%(),"\\]/g, ' ').trim().slice(0, 60);
export async function listOrders({ status = '', search = '', limit = 20, offset = 0, from = '', to = '' } = {}) {
  initClient();
  let q = client.from('rabiti_orders').select('*', { count: 'exact' });
  if (status) q = q.eq('status', status);
  const s = safeSearch(search);
  if (s) q = q.or(`buyer_name.ilike.%${s}%,buyer_email.ilike.%${s}%,order_no.ilike.%${s}%`);
  if (from) q = q.gte('created_at', from);
  if (to) q = q.lte('created_at', to);
  q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
  const { data, error, count } = await q;
  if (error) throw error;
  return { rows: data || [], count: count || 0 };
}
export async function getOrder(id) {
  initClient();
  const { data, error } = await client.from('rabiti_orders').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}
export async function orderEvents(id) {
  initClient();
  const { data, error } = await client.from('rabiti_order_events').select('*').eq('order_id', id).order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}
export async function markPaid(id) { initClient(); const { data, error } = await client.rpc('rabiti_order_mark_paid', { p_order_id: id }); if (error) throw error; return data; }
export async function refundOrder(id) { initClient(); const { data, error } = await client.rpc('rabiti_order_refund', { p_order_id: id }); if (error) throw error; return data; }
export async function cancelOrder(id) { initClient(); const { data, error } = await client.rpc('rabiti_order_cancel', { p_order_id: id }); if (error) throw error; return data; }
export async function noteOrder(id, note) { initClient(); const { data, error } = await client.rpc('rabiti_order_note', { p_order_id: id, p_note: note }); if (error) throw error; return data; }

export async function customers({ search = '', limit = 100 } = {}) {
  initClient();
  let q = client.from('rabiti_orders').select('buyer_name,buyer_email,buyer_phone,total_minor,currency,status,created_at,order_no,id');
  const s = safeSearch(search);
  if (s) q = q.or(`buyer_name.ilike.%${s}%,buyer_email.ilike.%${s}%`);
  q = q.order('created_at', { ascending: false }).limit(2000);
  const { data, error } = await q;
  if (error) throw error;
  const map = new Map();
  for (const o of data || []) {
    const key = String(o.buyer_email || '').toLowerCase();
    if (!key) continue;
    const c = map.get(key) || { name: o.buyer_name, email: o.buyer_email, phone: o.buyer_phone, orders: 0, paid_orders: 0, total_minor: 0, currency: o.currency, last: o.created_at, first: o.created_at, last_order: o.order_no, id: o.id };
    c.orders++; c.last = o.created_at > c.last ? o.created_at : c.last; c.first = o.created_at < c.first ? o.created_at : c.first;
    if (o.status === 'paid' || o.status === 'delivered') { c.paid_orders++; c.total_minor += Number(o.total_minor || 0); }
    if (o.buyer_phone) c.phone = o.buyer_phone;
    map.set(key, c);
  }
  return Array.from(map.values()).sort((a, b) => String(b.last).localeCompare(String(a.last))).slice(0, limit);
}

/* ---------- discounts ---------- */
export async function listDiscounts() {
  initClient();
  const { data, error } = await client.from('rabiti_discounts').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
export async function createDiscount(d) {
  initClient();
  const { data, error } = await client.from('rabiti_discounts').insert(d).select().single();
  if (error) throw error;
  return data;
}
export async function updateDiscount(id, d) {
  initClient();
  const { data, error } = await client.from('rabiti_discounts').update(d).eq('id', id).select().single();
  if (error) throw error;
  return data;
}
export async function deleteDiscount(id) {
  initClient();
  const { error } = await client.from('rabiti_discounts').delete().eq('id', id);
  if (error) throw error;
}

/* ---------- public storefront ---------- */
export async function publicPage(slug) {
  initClient();
  const { data, error } = await client.from('rabiti_pages').select('payload,published_at').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data || null;
}
export async function track(slug, type, productId = '', path = '', visitor = '', referrer = '') {
  if (!client) return;
  try {
    await client.rpc('rabiti_track', { p_slug: slug, p_type: type, p_product_id: productId, p_path: path, p_visitor: visitor, p_referrer: referrer });
  } catch { /* analytics must never block */ }
}
export async function validateCoupon(slug, code, subtotalMinor) {
  initClient();
  const { data, error } = await client.rpc('rabiti_validate_coupon', { p_slug: slug, p_code: code, p_subtotal_minor: subtotalMinor });
  if (error) throw error;
  return data || { valid: false, discount_minor: 0 };
}
export async function createOrder(slug, items, buyer, coupon, method) {
  initClient();
  const { data, error } = await client.rpc('rabiti_create_order', { p_slug: slug, p_items: items, p_buyer: buyer, p_coupon: coupon, p_payment_method: method });
  if (error) throw error;
  return data;
}
export async function orderStatus(slug, orderNo, token) {
  initClient();
  const { data, error } = await client.rpc('rabiti_order_status', { p_slug: slug, p_order_no: orderNo, p_token: token });
  if (error) throw error;
  return data;
}
export async function orderDownload(slug, orderNo, token, productId) {
  initClient();
  const { data, error } = await client.rpc('rabiti_order_download', { p_slug: slug, p_order_no: orderNo, p_token: token, p_product_id: productId });
  if (error) throw error;
  return data;
}
export async function claimPaid(slug, orderNo, token, ref) {
  initClient();
  const { data, error } = await client.rpc('rabiti_order_claim_paid', { p_slug: slug, p_order_no: orderNo, p_token: token, p_ref: ref });
  if (error) throw error;
  return !!data;
}
