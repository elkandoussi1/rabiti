/*
 * Unit tests for the shared browser modules. Node treats the browser .js files
 * as ES modules because package.json declares "type": "module".
 */
import assert from 'node:assert/strict';

globalThis.window = {
  RABITI_CONFIG: {
    supabaseUrl: 'https://example.supabase.co',
    supabasePublishableKey: 'sb_publishable_test'
  }
};
globalThis.location = {
  href: 'https://example.com/rabiti/index.html',
  search: ''
};

const ui = await import('../ui.js');
const api = await import('../api.js');
const views = await import('../views.js');

/* ---------------- defaults and normalization ---------------- */
const defaults = api.defaultDraft();
assert.equal(defaults.v, 4);
assert.equal(defaults.lang, 'ar');
assert.equal(defaults.checkout.mode, 'manual');
assert.equal(defaults.checkout.youcanpay.enabled, false);
assert.deepEqual(defaults.products, []);
assert.deepEqual(defaults.links, []);
assert.deepEqual(defaults.pay, []);
assert.equal(defaults.shop.currency, 'MAD');

const empty = api.normalizeDraft(null);
assert.equal(empty.design.theme, 'sand');
assert.equal(empty.lang, 'ar');
assert.equal(empty.profile.name, '');
assert.equal(empty.checkout.youcanpay.publicKey, '');

const repaired = api.normalizeDraft({
  lang: 'de',
  design: { theme: 'unknown-theme', accent: '#123456' },
  profile: { name: 'Ahmed' },
  pay: [
    { id: 'bank', t: 'Bank', on: 0 },
    { t: 'Cash', on: '0' },
    { t: 'PayPal' }
  ],
  links: [{ id: 'site', t: 'Site', u: 'https://example.com', on: 1 }],
  products: [{ id: 'book', t: 'Book', mode: 'paid', src: { type: 'url', url: 'https://example.com/book.pdf' } }]
});
assert.equal(repaired.lang, 'ar');
assert.equal(repaired.design.theme, 'sand');
assert.equal(repaired.design.accent, '#123456');
assert.equal(repaired.profile.name, 'Ahmed');
assert.equal(repaired.pay[0].on, 0);
assert.equal(repaired.pay[1].on, 0);
assert.equal(repaired.pay[2].on, 1);
assert.match(repaired.pay[1].id, /^pay_/);
assert.equal(repaired.links[0].u, 'https://example.com');
assert.equal(repaired.products[0].mode, 'paid');
assert.equal(repaired.products[0].src.url, 'https://example.com/book.pdf');

/* ---------------- product modes ---------------- */
const checkoutLink = api.normalizeProduct({ mode: 'checkout', link: 'https://example.com/pay' });
assert.equal(checkoutLink.mode, 'link');
assert.equal(checkoutLink.link, 'https://example.com/pay');

assert.equal(api.normalizeProduct({ mode: 'checkout', link: 'javascript:alert(1)' }).mode, 'none');
assert.equal(api.normalizeProduct({ mode: 'checkout', link: 'http://example.com/pay' }).mode, 'none');
assert.equal(api.normalizeProduct({ mode: 'paid', lm: { codes: [{ c: 'OLD' }] } }).mode, 'none');
assert.equal(JSON.stringify(api.normalizeProduct({ mode: 'paid', lm: { codes: [] } })).includes('lm'), false);

const paid = api.normalizeProduct({
  mode: 'paid',
  pr: '49',
  src: { type: 'url', url: 'https://example.com/private.pdf', fn: 'book.pdf' },
  imgs: ['a', 'b', 'c', 'd', 'e', 'f', 'g']
});
assert.equal(paid.mode, 'paid');
assert.equal(paid.src.type, 'url');
assert.equal(paid.src.url, 'https://example.com/private.pdf');
assert.equal(paid.imgs.length, 6);
assert.equal(paid.link, '');

const file = api.normalizeProduct({
  mode: 'file',
  fn: 'sample.txt',
  data: 'data:text/plain;base64,SGk=',
  link: 'https://example.com/ignored'
});
assert.equal(file.mode, 'file');
assert.equal(file.data, 'data:text/plain;base64,SGk=');
assert.equal(file.link, '');
assert.equal(file.src, null);

const hidden = api.normalizeProduct({ mode: 'none', on: '0' });
assert.equal(hidden.on, 0);
assert.equal(hidden.src, null);

const createdPaid = api.newProduct('paid');
assert.equal(createdPaid.mode, 'paid');
assert.equal(createdPaid.src.type, 'url');
assert.equal(createdPaid.on, 1);
assert.equal(api.newProduct('link').src, null);
assert.match(api.newLink().id, /^lnk_/);
assert.match(api.newPayMethod().id, /^pay_/);
assert.equal(api.newPayMethod().on, 1);

/* ---------------- friendly errors ---------------- */
assert.match(api.errorText(new Error('REVISION_CONFLICT')), /أحدث/);
assert.match(api.errorText({ code: '42501' }), /صلاحية/);
assert.match(api.errorText(new Error('duplicate key value violates unique constraint')), /مستخدمة/);
assert.equal(api.errorText(new Error('Something specific')), 'Something specific');
assert.equal(api.errorText(null), 'حدث خطأ غير متوقع');

/* ---------------- URL and text helpers ---------------- */
assert.equal(ui.slugify('  Hello World!!  '), 'hello-world');
assert.equal(ui.slugify('---'), '');
assert.equal(ui.slugify('رابطي'), '');
assert.equal(ui.safeUrl(' https://example.com/a '), 'https://example.com/a');
assert.equal(ui.safeUrl('http://example.com'), '');
assert.equal(ui.safeUrl('javascript:alert(1)'), '');
assert.equal(ui.safeUrl('ftp://example.com'), '');
assert.equal(ui.isEmail('buyer@example.com'), true);
assert.equal(ui.isEmail('buyer@example'), false);
assert.equal(ui.isEmail(''), false);
assert.equal(ui.initials('Ahmed El Kandoussi'), 'AE');
assert.equal(ui.hostLabel('https://www.example.com/path'), 'example.com/path');
assert.equal(ui.hostLabel('not a url'), 'not a url');
assert.equal(ui.platformFromUrl('https://wa.me/212600000000'), 'whatsapp');
assert.equal(ui.platformFromUrl('https://t.me/teacher'), 'telegram');
assert.equal(ui.platformFromUrl('mailto:teacher@example.com'), 'email');
assert.equal(ui.platformFromUrl('tel:+212600000000'), 'phone');
assert.equal(ui.platformFromUrl('https://example.com'), 'website');
assert.equal(ui.currencySymbol('MAD'), 'DH');
assert.equal(ui.currencySymbol('USD'), '$');
assert.equal(ui.currencySymbol('XYZ'), 'XYZ');
assert.equal(ui.priceToMinor('49,50'), 4950);
assert.equal(ui.priceToMinor('49'), 4900);
assert.equal(ui.priceToMinor(''), 0);
assert.equal(ui.priceToMinor('abc'), 0);
assert.equal(ui.pct(25, 100), 25);
assert.equal(ui.pct(1, 0), 0);
assert.equal(ui.clamp(12, 0, 10), 10);
assert.equal(ui.clamp(-2, 0, 10), 0);

assert.equal(
  ui.csv([['a', 'b"c'], ['d,e', 'f\n']]),
  'a,"b""c"\r\n"d,e","f\n"'
);

/* ---------------- order status and charts ---------------- */
assert.match(ui.statusChip('paid', 'ar'), /مدفوع/);
assert.match(ui.statusChip('paid', 'ar'), /chip teal/);
assert.equal(ui.statusLabel('delivered', 'en'), 'Delivered');
assert.equal(ui.statusLabel('unknown', 'ar'), 'بانتظار الدفع');
const chart = ui.lineChart([{ label: 'a', value: 1 }, { label: 'b', value: 2 }]);
assert.match(chart, /<svg/);
assert.match(chart, /<path class="line"/);
assert.match(ui.lineChart([]), /empty/);

/* ---------------- dashboard view helpers ---------------- */
const shop = { shop: { currency: 'MAD' } };
assert.match(views.price({ pr: '' }, shop), /مجاني/);
assert.match(views.price({ pr: '49', cur: 'MAD' }, shop), /49/);
assert.match(views.modeChip({ mode: 'paid' }), /مدفوع/);
assert.match(views.modeChip({ mode: 'link' }), /رابط مجاني/);
assert.match(views.modeChip({ mode: 'file' }), /ملف مجاني/);
assert.match(views.modeChip({ mode: 'none' }), /عرض فقط/);
assert.equal(Object.keys(views.VIEWS).length, 11);
assert.equal(views.VIEW_META.orders.title, 'الطلبات');
assert.equal(api.DESIGN_THEMES.length, 7);
assert.equal(api.DESIGN_THEMES.some((theme) => theme.id === 'sand'), true);

/* ---------------- store URLs ---------------- */
assert.equal(api.storeUrl('teacher'), 'https://example.com/rabiti/public.html?store=teacher');
assert.equal(
  api.checkoutUrl('teacher', 'RB-ABC', 'a'.repeat(64)),
  `https://example.com/rabiti/public.html?store=teacher&order=RB-ABC&t=${'a'.repeat(64)}`
);

/* ---------------- static configuration guard ---------------- */
assert.equal(api.configured, true);

console.log('PASS units: draft normalization, product modes, pricing, URLs, errors, CSV and view helpers');
