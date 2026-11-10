/* Shared UI helpers for the Rabiti dashboard and storefront. */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const attr = (v) => esc(v).replace(/`/g, '&#96;');
export const uid = (p = '') => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
export const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
export const debounce = (fn, ms = 300) => { let t; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.cancel = () => clearTimeout(t); return d; };
export const slugify = (s) => String(s || '').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const safeUrl = (u) => /^https:\/\/[^\s]+$/i.test(String(u || '').trim()) ? String(u).trim() : '';
export const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(String(v || '').trim());
export const initials = (name, email = '') => {
  const s = String(name || email || '?').trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
};
export const timeAgo = (iso, lang = 'ar') => {
  if (!iso) return '—';
  const d = new Date(iso).getTime(); if (!Number.isFinite(d)) return '—';
  const s = Math.round((Date.now() - d) / 1000);
  const ar = lang === 'ar', fr = lang === 'fr';
  if (s < 60) return ar ? 'الآن' : fr ? "à l'instant" : 'just now';
  const m = Math.round(s / 60), h = Math.round(m / 60), days = Math.round(h / 24);
  if (m < 60) return ar ? `قبل ${m} د` : fr ? `il y a ${m} min` : `${m}m ago`;
  if (h < 24) return ar ? `قبل ${h} س` : fr ? `il y a ${h} h` : `${h}h ago`;
  if (days < 30) return ar ? `قبل ${days} يوم` : fr ? `il y a ${days} j` : `${days}d ago`;
  return fmtDate(iso, lang);
};
export const fmtDate = (iso, lang = 'ar') => {
  if (!iso) return '—';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
};
export const fmtDateTime = (iso, lang = 'ar') => {
  if (!iso) return '—';
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d);
};
export const CURRENCIES = [
  ['MAD', 'درهم مغربي', 'MAD'], ['USD', 'دولار أمريكي', 'USD'], ['EUR', 'يورو', 'EUR'],
  ['GBP', 'جنيه إسترليني', 'GBP'], ['SAR', 'ريال سعودي', 'SAR'], ['AED', 'درهم إماراتي', 'AED'],
  ['EGP', 'جنيه مصري', 'EGP'], ['DZD', 'دينار جزائري', 'DZD'], ['TND', 'دينار تونسي', 'TND'],
  ['QAR', 'ريال قطري', 'QAR'], ['KWD', 'دينار كويتي', 'KWD'], ['BHD', 'دينار بحريني', 'BHD'],
  ['OMR', 'ريال عماني', 'OMR'], ['JOD', 'دينار أردني', 'JOD'], ['TRY', 'ليرة تركية', 'TRY'],
  ['CAD', 'دولار كندي', 'CAD'], ['CHF', 'فرنك سويسري', 'CHF']
];
export const currencySymbol = (cur) => ({ MAD: 'DH', USD: '$', EUR: '€', GBP: '£', SAR: 'SAR', AED: 'AED', EGP: 'EGP', DZD: 'DZ', TND: 'TN', QAR: 'QAR', KWD: 'KWD', BHD: 'BHD', OMR: 'OMR', JOD: 'JOD', TRY: '₺', CAD: 'CA$', CHF: 'CHF' }[String(cur || 'MAD').toUpperCase()] || cur);
export const money = (minor, currency = 'MAD', lang = 'ar') => {
  const n = Number(minor || 0) / 100;
  try { return new Intl.NumberFormat(lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-FR' : 'en-US', { style: 'currency', currency: String(currency || 'MAD').toUpperCase(), maximumFractionDigits: n % 1 ? 2 : 0 }).format(n); }
  catch { return `${n.toFixed(2)} ${currency}`; }
};
export const moneyInput = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
export const priceToMinor = (v) => Math.round(moneyInput(v) * 100);
export const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

/* ---------- icons ---------- */
const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  box: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>',
  receipt: '<path d="M5 3v18l2-1.5L9 21l2-1.5L13 21l2-1.5L17 21l2-1.5V3l-2 1.5L15 3l-2 1.5L11 3 9 4.5 7 3 5 4.5Z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/><path d="M16 3.1a4 4 0 0 1 0 7.8"/>',
  tag: '<path d="M20.6 13.4 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.6 7.6a2 2 0 0 1 0 2.8Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
  wallet: '<path d="M20 12V8a2 2 0 0 0-2-2H5a2 2 0 0 1 0-4h13a2 2 0 0 1 2 2v2"/><path d="M3 6v12a2 2 0 0 0 2 2h15a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5a2 2 0 0 1-2-2Z"/><circle cx="16" cy="14" r="1"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".8"/><circle cx="17.5" cy="10.5" r=".8"/><circle cx="8.5" cy="7.5" r=".8"/><circle cx="6.5" cy="12.5" r=".8"/><path d="M12 2a10 10 0 1 0 0 20 2.5 2.5 0 0 0 0-5 2 2 0 0 1 0-4h4a4 4 0 0 0 4-4 7 7 0 0 0-8-7Z"/>',
  chart: '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  'arrow-left': '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  'arrow-up-right': '<path d="M7 17 17 7M7 7h10v10"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  trash: '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m3 3 18 18"/><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.4 3.4"/><path d="M6.6 6.6C3.6 8.6 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.4-1.4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
  whatsapp: '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.4A8.5 8.5 0 1 1 21 11.5Z"/><path d="M8.5 8.5c0 4 3 7 7 7l1.2-1.8-2.4-1.2-.8 1a5.3 5.3 0 0 1-2.8-2.8l1-.8-1.2-2.4Z"/>',
  telegram: '<path d="m21 3-9 18-3-7-7-3Z"/><path d="M21 3 9 14"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".7"/>',
  facebook: '<path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3Z"/>',
  tiktok: '<path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/>',
  youtube: '<path d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5 31 31 0 0 0 2 12a31 31 0 0 0 .1 3.5 3 3 0 0 0 2.1 2.1C6 18 12 18 12 18s6 0 7.9-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 22 12a31 31 0 0 0-.1-3.5Z"/><path d="m10 9 5 3-5 3Z"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 7 10 7 10-7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.8 2Z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  sparkles: '<path d="m12 3 1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9Z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9Z"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  bank: '<path d="m3 10 9-6 9 6"/><path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
  cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.01M18 15v.01"/>',
  paypal: '<path d="M7 21 9 3h6.5a4.5 4.5 0 0 1 0 9H11"/><path d="M13 21H8l1-6h4a4.5 4.5 0 0 0 0-9"/>',
  zap: '<path d="M13 2 3 14h8l-1 8 10-12h-8Z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 21v-5h5M21 3v5h-5"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  filter: '<path d="M3 4h18l-7 8v6l-4 2v-8Z"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  cart: '<circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M3 3h2l2.4 11.4a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 7H6"/>',
  bag: '<path d="M6 7h12l1 14H5Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m11 12 9-9M15 8l3 3M17 6l3 3"/>',
  qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM21 14v.01M14 21v.01M21 21v.01M18 18v3M21 18h.01"/>',
  star: '<path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.8 1-6.1L3.2 9.4l6.1-.9Z"/>',
  package: '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8M7.5 5.5l9 5"/>',
  layers: '<path d="m12 2 9 5-9 5-9-5Z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>',
  trending: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  activity: '<path d="M3 12h4l3 8 4-16 3 8h4"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  message: '<path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2 0-2.8-.8-.7-2-.7-3-.2Z"/><path d="m12 15-3-3a22 22 0 0 1 2-4.5A12.5 12.5 0 0 1 22 2c0 3-.5 7-5.5 11a22 22 0 0 1-4.5 2Z"/><path d="M9 12H4l3-5h4M12 15v5l5-3v-4"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M5 12v9h14v-9"/><path d="M12 8C10 8 7 7 7 5a2 2 0 0 1 4-1c1 1 1 4 1 4ZM12 8c2 0 5-1 5-3a2 2 0 0 0-4-1c-1 1-1 4-1 4Z"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="17" r="2"/>',
  truck: '<path d="M3 6h11v11H3z"/><path d="M14 9h4l3 3v5h-7"/><circle cx="7" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  video: '<rect x="2" y="5" width="14" height="14" rx="2"/><path d="m22 7-6 5 6 5Z"/>',
  play: '<path d="m7 4 13 8-13 8Z"/>',
  home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><path d="M9 22V12h6v10"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  hash: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4M12 17h.01"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.7 3L3 13"/>',
  coins: '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7"/>',
  wand: '<path d="m15 4 5 5M13 6l5 5M3 21 17 7l-4-4L3 17Z"/>',
  type: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  translate: '<path d="M4 5h8M8 3v2c0 4-2 7-5 9"/><path d="M6 9c0 3 3 5 6 6"/><path d="m13 21 4-10 4 10M14.5 17h5"/>',
  mouse: '<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  cloud: '<path d="M17.5 19H6a4 4 0 0 1-.7-7.9A7 7 0 0 1 19 9a5 5 0 0 1-1.5 10Z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  'message-circle': '<path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.2-5.4A8.5 8.5 0 1 1 21 11.5Z"/>',
  'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  infinity: '<path d="M18.2 6.8a4 4 0 0 1 0 10.4c-2 2-4 1.4-6.2-1.2s-4.2-3.2-6.2-1.2a4 4 0 0 0 0 5.4c2 2 4 1.4 6.2-1.2"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  'map': '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Z"/><path d="M9 3v15M15 6v15"/>',
  'shopping-bag': '<path d="M6 7h12l1 14H5Z"/><path d="M9 7V5a3 3 0 0 1 6 0v2"/>',
  'credit-card': '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  'toggle-left': '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="8" cy="12" r="2.5"/>',
  'toggle-right': '<rect x="2" y="6" width="20" height="12" rx="6"/><circle cx="16" cy="12" r="2.5"/>',
  'more-horizontal': '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M16 21h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>',
  'loader': '<path d="M12 2v4M12 18v4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M2 12h4M18 12h4M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  'circle': '<circle cx="12" cy="12" r="9"/>',
  'dot': '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
};
export function icon(name, cls = '') {
  const body = ICONS[name] || ICONS.circle;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
}

/* ---------- toasts, modals, drawers ---------- */
let toastWrap;
export function toast(msg, type = '', ms = 3200) {
  if (!toastWrap) { toastWrap = document.createElement('div'); toastWrap.className = 'toast-wrap'; document.body.appendChild(toastWrap); }
  const t = document.createElement('div');
  t.className = 'toast ' + (type === 'ok' ? 'ok' : type === 'err' ? 'err' : '');
  t.innerHTML = `${type === 'ok' ? icon('check-circle') : type === 'err' ? icon('alert') : icon('info')}<span>${esc(msg)}</span>`;
  toastWrap.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; t.style.transition = '.25s'; setTimeout(() => t.remove(), 260); }, ms);
}
let activeOverlay = null, activeModal = null;
export function closeOverlay() {
  if (activeModal?.onClose) { try { activeModal.onClose(); } catch { /* ignore */ } }
  activeOverlay?.remove(); activeOverlay = null; activeModal = null;
  document.body.classList.remove('no-scroll');
}
export function modal({ title = '', sub = '', body = '', foot = '', wide = false, onMount, onClose, closable = true }) {
  closeOverlay();
  const ov = document.createElement('div'); ov.className = 'overlay';
  const box = document.createElement('div'); box.className = 'modal';
  box.innerHTML = `<div class="modal-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
    <div class="modal-head"><div><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div>${closable ? `<button class="close-x" data-close aria-label="إغلاق">${icon('x')}</button>` : ''}</div>
    <div class="modal-body">${body}</div>${foot ? `<div class="modal-foot">${foot}</div>` : ''}</div>`;
  ov.appendChild(box); document.body.appendChild(ov); document.body.classList.add('no-scroll');
  activeOverlay = ov; activeModal = { onClose };
  ov.addEventListener('click', (e) => { if (e.target === ov && closable) closeOverlay(); });
  box.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
  onMount?.(box, ov);
  const focusable = box.querySelector('input,textarea,select,button:not([data-close])');
  setTimeout(() => focusable?.focus(), 40);
  return { box, ov, close: closeOverlay };
}
export function drawer({ title = '', sub = '', body = '', foot = '', onMount, onClose }) {
  closeOverlay();
  const ov = document.createElement('div'); ov.className = 'overlay';
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<div class="drawer-head"><div style="flex:1"><h3>${esc(title)}</h3>${sub ? `<p>${esc(sub)}</p>` : ''}</div><button class="close-x" data-close aria-label="إغلاق">${icon('x')}</button></div>
    <div class="drawer-body">${body}</div>${foot ? `<div class="drawer-foot">${foot}</div>` : ''}`;
  ov.appendChild(d); document.body.appendChild(ov); document.body.classList.add('no-scroll');
  activeOverlay = ov; activeModal = { onClose };
  ov.addEventListener('click', (e) => { if (e.target === ov) closeOverlay(); });
  d.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeOverlay));
  onMount?.(d, ov);
  return { box: d, ov, close: closeOverlay };
}
export function confirmDialog({ title = 'تأكيد', text = '', confirm = 'تأكيد', cancel = 'إلغاء', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    modal({
      title, body: `<p style="margin:0;color:var(--muted);font-size:14px;line-height:1.8">${esc(text)}</p>`,
      foot: `<button class="btn" data-cancel>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(confirm)}</button>`,
      onMount: (box) => {
        box.querySelector('[data-cancel]').onclick = () => { finish(false); closeOverlay(); };
        box.querySelector('[data-ok]').onclick = () => { finish(true); closeOverlay(); };
      },
      onClose: () => finish(false)
    });
  });
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ', 'ok'); return true; }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); toast('تم النسخ', 'ok'); return true; } catch { toast('تعذّر النسخ', 'err'); return false; }
    finally { ta.remove(); }
  }
}
export function downloadBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
export function downloadText(text, name, type = 'application/json') { downloadBlob(new Blob([text], { type }), name); }
export function csv(rows) {
  return rows.map((r) => r.map((v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[",\n\r]/.test(s) ? `"${s}"` : s;
  }).join(',')).join('\r\n');
}
export function downloadCsv(name, rows) { downloadBlob(new Blob(['\uFEFF' + csv(rows)], { type: 'text/csv;charset=utf-8' }), name); }

/* ---------- files ---------- */
export function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file);
  });
}
export function compressImage(file, max = 1200, quality = 0.82) {
  return new Promise(async (resolve) => {
    try {
      const src = await readAsDataURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        if (k === 1 && src.length < 420000) return resolve(src);
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve('');
      img.src = src;
    } catch { resolve(''); }
  });
}

/* ---------- status helpers ---------- */
export const ORDER_STATUS = {
  pending: { ar: 'بانتظار الدفع', en: 'Pending', fr: 'En attente', cls: 'amber', icon: 'clock' },
  paid: { ar: 'مدفوع', en: 'Paid', fr: 'Payé', cls: 'teal', icon: 'check-circle' },
  delivered: { ar: 'تم التسليم', en: 'Delivered', fr: 'Livré', cls: 'green', icon: 'package' },
  cancelled: { ar: 'ملغى', en: 'Cancelled', fr: 'Annulé', cls: 'rose', icon: 'ban' },
  refunded: { ar: 'مسترجع', en: 'Refunded', fr: 'Remboursé', cls: 'rose', icon: 'undo' },
  failed: { ar: 'فشل', en: 'Failed', fr: 'Échoué', cls: 'rose', icon: 'x-circle' }
};
export const statusChip = (status, lang = 'ar') => {
  const s = ORDER_STATUS[status] || ORDER_STATUS.pending;
  return `<span class="chip ${s.cls}"><span class="dot"></span>${esc(s[lang] || s.ar)}</span>`;
};
export const statusLabel = (status, lang = 'ar') => (ORDER_STATUS[status] || ORDER_STATUS.pending)[lang] || status;

/* ---------- chart ---------- */
export function lineChart(points, { width = 720, height = 220, money: isMoney = false, currency = 'MAD', lang = 'ar' } = {}) {
  if (!points?.length) return '<div class="empty" style="padding:30px"><p class="muted small">لا توجد بيانات بعد</p></div>';
  const pad = { t: 16, r: 8, b: 26, l: 8 };
  const w = width - pad.l - pad.r, h = height - pad.t - pad.b;
  const max = Math.max(1, ...points.map((p) => p.value));
  const step = points.length > 1 ? w / (points.length - 1) : w;
  const x = (i) => pad.l + i * step;
  const y = (v) => pad.t + h - (v / max) * h;
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(points.length - 1).toFixed(1)},${pad.t + h} L${pad.l},${pad.t + h} Z`;
  const grid = [0, 1, 2, 3].map((i) => `<line class="grid-line" x1="${pad.l}" x2="${width - pad.r}" y1="${(pad.t + (h / 3) * i).toFixed(1)}" y2="${(pad.t + (h / 3) * i).toFixed(1)}"/>`).join('');
  const labels = points.map((p, i) => {
    if (points.length > 10 && i % Math.ceil(points.length / 7) !== 0 && i !== points.length - 1) return '';
    return `<text x="${x(i).toFixed(1)}" y="${height - 6}" font-size="9" fill="#98a2b3" text-anchor="middle">${esc(p.label || '')}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img">
    <defs><linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#0d9488" stop-opacity=".32"/><stop offset="100%" stop-color="#0d9488" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path class="area" d="${area}"/><path class="line" d="${line}"/>${labels}
    ${points.map((p, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="2.6"><title>${esc(p.label)}: ${isMoney ? esc(money(p.value, currency, lang)) : p.value}</title></circle>`).join('')}
  </svg>`;
}

/* ---------- misc renderers ---------- */
export const avatarHTML = (name, email, url = '', cls = '') => {
  if (url) return `<span class="av ${cls}"><img src="${attr(url)}" alt=""></span>`;
  return `<span class="av ${cls}">${esc(initials(name, email))}</span>`;
};
export const emptyState = ({ icon: ic = 'box', title = 'لا شيء هنا بعد', text = '', action = '' }) => `
  <div class="empty"><div class="ill">${icon(ic, 'lg')}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
export const spinner = (label = 'جارٍ التحميل…') => `<div style="display:flex;align-items:center;justify-content:center;gap:9px;padding:30px;color:var(--muted);font-size:13px"><span class="ic spin">${icon('loader')}</span>${esc(label)}</div>`;
export const PLATFORM_ICONS = { whatsapp: 'whatsapp', telegram: 'telegram', instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok', youtube: 'youtube', email: 'mail', phone: 'phone', website: 'globe', store: 'bag' };
export const platformFromUrl = (u) => {
  const s = String(u || '').toLowerCase();
  if (s.includes('wa.me') || s.includes('whatsapp')) return 'whatsapp';
  if (s.includes('t.me') || s.includes('telegram')) return 'telegram';
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('facebook') || s.includes('fb.me')) return 'facebook';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('youtube') || s.includes('youtu.be')) return 'youtube';
  if (s.startsWith('mailto:')) return 'email';
  if (s.startsWith('tel:')) return 'phone';
  return 'website';
};
export const hostLabel = (u) => {
  try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname !== '/' ? x.pathname : ''); }
  catch { return String(u || ''); }
};
export const qs = (key) => new URLSearchParams(location.search).get(key);
