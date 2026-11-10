/* Dashboard views. Each view receives the app context and returns HTML. */
import {
  esc, attr, icon, money, fmtDate, fmtDateTime, timeAgo, pct, initials, avatarHTML,
  statusChip, lineChart, emptyState, platformFromUrl, hostLabel, PLATFORM_ICONS,
  CURRENCIES
} from './ui.js';
import * as api from './api.js';
import { DESIGN_THEMES } from './api.js';

export const VIEW_META = {
  overview: { title: 'نظرة عامة', sub: 'ملخص أداء متجرك اليوم' },
  store: { title: 'المتجر والنشر', sub: 'رابطك العام وحالة النشر' },
  links: { title: 'الروابط', sub: 'كل روابطك في مكان واحد' },
  products: { title: 'المنتجات', sub: 'منتجات رقمية، روابط وملفات' },
  orders: { title: 'الطلبات', sub: 'تابع المبيعات وسلّم المنتجات' },
  customers: { title: 'العملاء', sub: 'قائمة زبائنك وقيمة مشترياتهم' },
  discounts: { title: 'أكواد الخصم', sub: 'حملات وعروض لمتجرك' },
  payments: { title: 'المدفوعات', sub: 'YouCan Pay والطرق اليدوية' },
  design: { title: 'التصميم', sub: 'هوية متجرك وشكله العام' },
  analytics: { title: 'التحليلات', sub: 'الزيارات والتحويل والمبيعات' },
  settings: { title: 'الإعدادات', sub: 'بيانات المتجر والحساب' }
};

const cur = (d) => d.shop.currency || 'MAD';
export const price = (p, d) => {
  const n = Number(String(p.pr ?? '').replace(',', '.'));
  if (!n) return `<span class="s-free" style="font-size:12px">مجاني</span>`;
  return `${money(Math.round(n * 100), p.cur || cur(d))}`;
};
export const modeChip = (p) => {
  if (p.mode === 'paid') return '<span class="chip teal">مدفوع</span>';
  if (p.mode === 'link') return '<span class="chip blue">رابط مجاني</span>';
  if (p.mode === 'file') return '<span class="chip violet">ملف مجاني</span>';
  return '<span class="chip">عرض فقط</span>';
};
const imgOf = (p) => p.imgs?.[0] || '';
const thumb = (p, ic = 'box') => `<span class="thumb">${imgOf(p) ? `<img src="${attr(imgOf(p))}" alt="">` : icon(ic, 'sm')}</span>`;
const pctTrend = (now, prev) => {
  if (!prev) return now ? '<span class="trend up">جديد</span>' : '<span class="muted">—</span>';
  const x = Math.round(((now - prev) / prev) * 100);
  return `<span class="trend ${x >= 0 ? 'up' : 'down'}">${x >= 0 ? '↑' : '↓'} ${Math.abs(x)}%</span>`;
};
const checklist = (d, published) => {
  const items = [
    { ok: !!d.profile.name, t: 'اسم المتجر والصورة', s: 'أضف هوية واضحة لصفحتك.', act: 'settings' },
    { ok: (d.products || []).length > 0, t: 'أضف أول منتج', s: 'منتج رقمي أو رابط مجاني.', act: 'products' },
    { ok: (d.pay || []).some((m) => m.on) || d.checkout?.youcanpay?.enabled, t: 'فعّل طريقة دفع', s: 'تحويل بنكي، CashPlus أو YouCan Pay.', act: 'payments' },
    { ok: (d.links || []).length > 0, t: 'أضف روابطك', s: 'واتساب، إنستغرام، موقعك…', act: 'links' },
    { ok: published, t: 'انشر متجرك', s: 'شارك الرابط مع زبائنك.', act: 'store' }
  ];
  const done = items.filter((i) => i.ok).length;
  return `<div class="card"><div class="card-head"><div><h3>جهّز متجرك</h3><p>${done} من ${items.length} خطوات مكتملة</p></div><span class="chip ${done === items.length ? 'green' : 'amber'}">${Math.round((done / items.length) * 100)}%</span></div><div class="card-body"><div class="checklist">${items.map((i) => `<button class="check" data-act="go" data-view="${i.act}" style="text-align:start;background:none;cursor:pointer"><span class="${i.ok ? 'ok' : 'no'}">${icon(i.ok ? 'check' : 'arrow-left', 'sm')}</span><span style="flex:1"><b>${i.t}</b><span>${i.s}</span></span>${i.ok ? '' : icon('chevron-left', 'sm')}</button>`).join('')}</div></div></div>`;
};

/* ============================== overview ============================== */
export async function overview(ctx) {
  const d = ctx.draft;
  const s = ctx.stats || await api.stats().catch(() => ({}));
  const name = d.profile.name || 'متجرك';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'صباح الخير' : hour < 18 ? 'مساء الخير' : 'مساء النور';
  let recent = [];
  try { recent = (await api.listOrders({ limit: 5 })).rows; } catch { /* empty */ }
  const daily = (s.daily || []).map((x) => ({ label: x.day.slice(5), value: Number(x.revenue_minor || 0) }));
  const conv = s.visitors_30d ? Math.round(((s.orders_30d || 0) / s.visitors_30d) * 1000) / 10 : 0;
  return `
  <div class="hero">
    <div><div class="row" style="gap:8px;margin-bottom:10px"><span class="chip" style="background:rgba(255,255,255,.1);color:#5eead4">${ctx.published ? '● منشور' : '● مسودة'}</span><span class="tiny" style="color:#94a3b8">${esc(new Intl.DateTimeFormat('ar-MA', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()))}</span></div>
      <h2>${greet}، ${esc(name)} 👋</h2>
      <p>${ctx.published ? 'متجرك متاح لزبائنك. تابع الطلبات الجديدة وحدّث منتجاتك.' : 'متجرك جاهز كمسودة. أضف منتجاتك ثم انشره ليصل إلى زبائنك.'}</p>
      <div class="actions"><button class="btn primary" data-act="publish">${icon('rocket', 'sm')} ${ctx.published ? 'نشر التعديلات' : 'نشر المتجر'}</button><button class="btn ghost" data-act="preview">${icon('eye', 'sm')} معاينة</button><button class="btn ghost" data-act="copy-store">${icon('copy', 'sm')} نسخ الرابط</button></div></div>
    <div class="hero-art">${icon('rocket')}</div>
  </div>
  <div class="grid c4" style="margin-top:18px">
    <div class="card stat"><div class="ico teal">${icon('coins')}</div><div class="label">إيرادات 30 يومًا</div><div class="value">${money(s.revenue_30d_minor || 0, cur(d))}</div><div class="foot">${pctTrend(s.revenue_30d_minor || 0, s.revenue_prev_30d_minor || 0)} <span>مقارنة بالفترة السابقة</span></div></div>
    <div class="card stat"><div class="ico violet">${icon('receipt')}</div><div class="label">طلبات 30 يومًا</div><div class="value">${s.orders_30d || 0}</div><div class="foot">${pctTrend(s.orders_30d || 0, s.orders_prev_30d || 0)} <span>${s.orders_pending || 0} بانتظار الدفع</span></div></div>
    <div class="card stat"><div class="ico amber">${icon('eye')}</div><div class="label">زيارات 30 يومًا</div><div class="value">${s.views_30d || 0}</div><div class="foot">${pctTrend(s.views_30d || 0, s.views_prev_30d || 0)} <span>${s.visitors_30d || 0} زائرًا</span></div></div>
    <div class="card stat"><div class="ico blue">${icon('trending')}</div><div class="label">معدل التحويل</div><div class="value">${conv}%</div><div class="foot"><span>${s.checkout_starts_30d || 0} بدء دفع</span></div></div>
  </div>
  <div class="grid" style="grid-template-columns:1.55fr 1fr;margin-top:18px">
    <div class="card"><div class="card-head"><div><h3>الإيرادات</h3><p>آخر 30 يومًا</p></div><span class="chip teal">${money(s.revenue_30d_minor || 0, cur(d))}</span></div><div class="card-body">${lineChart(daily, { money: true, currency: cur(d) })}<div class="chart-legend"><span><i style="background:#0d9488"></i>الإيرادات اليومية</span></div></div></div>
    ${checklist(d, ctx.published)}
  </div>
  <div class="grid c2" style="margin-top:18px">
    <div class="card"><div class="card-head"><div><h3>أحدث الطلبات</h3><p>آخر 5 طلبات</p></div><a class="btn sm" href="#/orders">الكل ${icon('arrow-left', 'sm')}</a></div>
      ${recent.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>الزبون</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${recent.map((o) => `<tr data-act="order-open" data-id="${attr(o.id)}" style="cursor:pointer"><td><span class="order-link">${esc(o.order_no)}</span><div class="tiny muted">${esc(timeAgo(o.created_at))}</div></td><td><div class="cell-main"><b>${esc(o.buyer_name)}</b><span>${esc(o.buyer_email)}</span></div></td><td class="money">${money(o.total_minor, o.currency)}</td><td>${statusChip(o.status)}</td></tr>`).join('')}</tbody></table></div>` : emptyState({ icon: 'receipt', title: 'لا طلبات بعد', text: 'عندما يشتري أحد منتجاتك سيظهر الطلب هنا.', action: `<a class="btn primary" href="#/products">${icon('box', 'sm')} أضف منتجًا</a>` })}
    </div>
    <div class="card"><div class="card-head"><div><h3>الأكثر مبيعًا</h3><p>آخر 30 يومًا</p></div><a class="btn sm" href="#/analytics">التحليلات ${icon('arrow-left', 'sm')}</a></div><div class="card-body">${(s.top_products || []).length ? `<div class="bars">${s.top_products.map((p) => `<div class="bar-row"><span class="truncate" title="${attr(p.title)}">${esc(p.title || p.id)}</span><span class="bar-track"><span class="bar-fill" style="width:${pct(p.revenue_minor, Math.max(1, s.top_products[0].revenue_minor))}%"></span></span><b>${money(p.revenue_minor, cur(d))}</b></div>`).join('')}</div>` : emptyState({ icon: 'chart', title: 'لا مبيعات بعد', text: 'ستظهر هنا المنتجات الأكثر مبيعًا.' })}</div></div>
  </div>
  <div class="card pad" style="margin-top:18px;display:flex;align-items:center;gap:16px;flex-wrap:wrap"><div class="ic-tile" style="width:42px;height:42px;border-radius:12px;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center">${icon('link')}</div><div style="flex:1;min-width:200px"><b style="font-size:13px">رابط متجرك</b><div class="mono tiny muted" style="direction:ltr;text-align:start">${esc(ctx.storeUrl())}</div></div><button class="btn sm" data-act="copy-store">${icon('copy', 'sm')} نسخ</button><a class="btn sm" href="${attr(ctx.storeUrl())}" target="_blank" rel="noopener">${icon('external', 'sm')} فتح</a></div>`;
}

/* ============================== store / publish ============================== */
export async function store(ctx) {
  const d = ctx.draft;
  const url = ctx.storeUrl();
  const previewUrl = new URL('public.html', location.href);
  previewUrl.searchParams.set('store', ctx.store.slug); previewUrl.searchParams.set('preview', '1');
  const checks = [
    { ok: !!d.profile.name, t: 'اسم المتجر', s: 'يظهر في أعلى الصفحة وفي محركات البحث.', go: 'settings' },
    { ok: (d.products || []).some((p) => p.on), t: 'منتج واحد على الأقل', s: 'أضف منتجًا أو رابطًا مجانيًا.', go: 'products' },
    { ok: (d.pay || []).some((m) => m.on) || d.checkout?.youcanpay?.enabled, t: 'طريقة دفع مفعّلة', s: 'ضرورية لبيع المنتجات المدفوعة.', go: 'payments' },
    { ok: !!d.profile.bio, t: 'نبذة تعريفية', s: 'أخبر الزائر من أنت وماذا تقدم.', go: 'design' },
    { ok: !!d.profile.avatar, t: 'صورة شخصية', s: 'تبني الثقة وتجعل الصفحة أجمل.', go: 'design' }
  ];
  const done = checks.filter((c) => c.ok).length;
  return `<div class="page-head"><div><h2>${ctx.published ? 'متجرك منشور' : 'متجرك كمسودة'}</h2><p>${ctx.published ? 'أي تعديل تحفظه يبقى مسودة حتى تضغط «نشر التعديلات».' : 'انشر متجرك عندما تكون جاهزًا، ويمكنك إيقاف النشر في أي وقت.'}</p></div><div class="actions"><button class="btn" data-act="preview">${icon('eye', 'sm')} معاينة</button>${ctx.published ? `<button class="btn" data-act="unpublish">${icon('ban', 'sm')} إيقاف النشر</button>` : ''}<button class="btn primary" data-act="publish">${icon('rocket', 'sm')} ${ctx.published ? 'نشر التعديلات' : 'نشر المتجر'}</button></div></div>
  <div class="grid" style="grid-template-columns:1.5fr 1fr">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>الرابط العام</h3><p>شارك هذا الرابط مع زبائنك</p></div><span class="chip ${ctx.published ? 'green' : 'amber'}"><span class="dot"></span>${ctx.published ? 'منشور' : 'غير منشور'}</span></div><div class="card-body"><div class="share-link"><input value="${attr(url)}" readonly id="store-url"><button class="btn primary sm" data-act="copy-store">${icon('copy', 'sm')} نسخ</button></div><div class="row wrap" style="margin-top:12px"><a class="btn sm" href="${attr(url)}" target="_blank" rel="noopener">${icon('external', 'sm')} فتح المتجر</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('تفضل بزيارة متجري: ' + url)}">${icon('whatsapp', 'sm')} واتساب</a><a class="btn sm" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}">${icon('telegram', 'sm')} تيليجرام</a><button class="btn sm" data-act="share-native">${icon('share', 'sm')} مشاركة</button></div>${ctx.publishedAt ? `<p class="tiny muted" style="margin:12px 0 0">آخر نشر: ${esc(fmtDateTime(ctx.publishedAt))}</p>` : ''}</div></div>
      <div class="card"><div class="card-head"><div><h3>معاينة مباشرة</h3><p>تظهر المسودة الحالية بعد الحفظ التلقائي</p></div><button class="btn sm" data-act="refresh-preview">${icon('refresh', 'sm')} تحديث</button></div><div class="card-body"><iframe class="preview-frame" id="store-preview" src="${attr(previewUrl.href)}" title="معاينة المتجر" loading="lazy"></iframe></div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>قبل النشر</h3><p>${done} من ${checks.length} جاهز</p></div><span class="chip ${done === checks.length ? 'green' : 'amber'}">${Math.round((done / checks.length) * 100)}%</span></div><div class="card-body"><div class="checklist">${checks.map((c) => `<button class="check" data-act="go" data-view="${c.go}" style="text-align:start;background:none"><span class="${c.ok ? 'ok' : 'no'}">${icon(c.ok ? 'check' : 'arrow-left', 'sm')}</span><span style="flex:1"><b>${c.t}</b><span>${c.s}</span></span></button>`).join('')}</div></div></div>
      <div class="card pad"><h3 style="margin:0 0 9px;font-size:14px">نصائح للمشاركة</h3><div class="stack" style="gap:10px"><div class="row" style="align-items:flex-start"><span class="chip teal">1</span><p class="small muted" style="margin:0">ضع الرابط في بايو إنستغرام وتيك توك.</p></div><div class="row" style="align-items:flex-start"><span class="chip teal">2</span><p class="small muted" style="margin:0">شاركه في مجموعات واتساب مع صورة المنتج.</p></div><div class="row" style="align-items:flex-start"><span class="chip teal">3</span><p class="small muted" style="margin:0">أضف كود خصم لأول 10 طلبات لتحفيز البيع.</p></div></div></div>
      <div class="card pad"><div class="row between"><div><b class="small">إعدادات سريعة</b><p class="tiny muted" style="margin:2px 0 0">الاسم، النبذة، العملة والمزيد.</p></div><button class="btn sm" data-act="go" data-view="settings">${icon('settings', 'sm')} فتح</button></div></div>
    </div>
  </div>`;
}

/* ============================== links ============================== */
export async function links(ctx) {
  const d = ctx.draft;
  const list = d.links || [];
  return `<div class="page-head"><div><h2>الروابط</h2><p>أضف روابطك الاجتماعية وموقعك. تظهر أسفل المنتجات في صفحتك.</p></div><div class="actions"><button class="btn primary" data-act="add-link">${icon('plus', 'sm')} إضافة رابط</button></div></div>
  ${list.length ? `<div class="list-stack">${list.map((l, i) => `<div class="item-card"><span class="handle">${icon('grip', 'sm')}</span><span class="ic-tile">${icon(PLATFORM_ICONS[l.icon] || PLATFORM_ICONS[platformFromUrl(l.u)] || 'globe')}</span><span class="body"><b>${esc(l.t || 'رابط بدون عنوان')}</b><span dir="ltr" style="text-align:start">${esc(hostLabel(l.u))}</span></span><span class="tools"><button class="btn icon sm" data-act="link-move" data-id="${attr(l.id)}" data-dir="-1" title="أعلى" ${i === 0 ? 'disabled' : ''}>${icon('chevron', 'sm')}</button><button class="btn icon sm" data-act="link-move" data-id="${attr(l.id)}" data-dir="1" title="أسفل" ${i === list.length - 1 ? 'disabled' : ''} style="transform:rotate(180deg)">${icon('chevron', 'sm')}</button><label class="switch"><input type="checkbox" data-toggle-kind="link:${attr(l.id)}" ${l.on ? 'checked' : ''}><i></i></label><button class="btn icon sm" data-act="edit-link" data-id="${attr(l.id)}">${icon('edit', 'sm')}</button><button class="btn icon sm danger" data-act="del-link" data-id="${attr(l.id)}">${icon('trash', 'sm')}</button></span></div>`).join('')}</div>` : emptyState({ icon: 'link', title: 'لا روابط بعد', text: 'أضف رابط واتساب أو إنستغرام أو موقعك ليصل إليك الزوار.', action: `<button class="btn primary" data-act="add-link">${icon('plus', 'sm')} إضافة أول رابط</button>` })}
  <div class="callout" style="margin-top:18px">${icon('info')}<div><b>ترتيب الروابط</b><span>استخدم الأسهم لتغيير الترتيب. الرابط المخفي لا يظهر في الصفحة العامة لكنه يبقى محفوظًا.</span></div></div>`;
}

/* ============================== products ============================== */
export async function products(ctx) {
  const d = ctx.draft;
  const all = d.products || [];
  const q = String(ctx.query.q || '').trim();
  const list = q ? all.filter((p) => (p.t + ' ' + p.d + ' ' + p.category).toLowerCase().includes(q.toLowerCase())) : all;
  return `<div class="page-head"><div><h2>المنتجات</h2><p>${all.length} منتجًا · ${all.filter((p) => p.on).length} ظاهر في المتجر</p></div><div class="actions"><button class="btn primary" data-act="add-product">${icon('plus', 'sm')} إضافة منتج</button></div></div>
  <div class="filters"><div class="searchbox" style="flex:1;max-width:320px">${icon('search', 'sm')}<input id="products-q" placeholder="ابحث في المنتجات…" value="${attr(q)}"></div><button class="btn sm" data-act="products-search">${icon('search', 'sm')} بحث</button>${q ? `<a class="btn sm" href="#/products">مسح</a>` : ''}<span class="spacer"></span><span class="chip">${list.length} نتيجة</span></div>
  ${list.length ? `<div class="list-stack">${list.map((p, i) => `<div class="item-card"><span class="handle">${icon('grip', 'sm')}</span>${thumb(p)}<span class="body"><b>${esc(p.t || 'منتج بدون اسم')} ${p.badge ? `<span class="chip violet" style="font-size:9px;padding:1px 6px">${esc(p.badge)}</span>` : ''}</b><span>${p.category ? esc(p.category) + ' · ' : ''}${price(p, d)} ${p.mode === 'paid' ? '· تسليم رقمي' : ''}</span></span><span class="tools">${modeChip(p)}<button class="btn icon sm" data-act="product-preview" data-id="${attr(p.id)}" title="معاينة">${icon('eye', 'sm')}</button><label class="switch"><input type="checkbox" data-toggle-kind="product:${attr(p.id)}" ${p.on ? 'checked' : ''}><i></i></label><button class="btn icon sm" data-act="edit-product" data-id="${attr(p.id)}">${icon('edit', 'sm')}</button><button class="btn icon sm" data-act="dup-product" data-id="${attr(p.id)}" title="نسخ">${icon('copy', 'sm')}</button><button class="btn icon sm danger" data-act="del-product" data-id="${attr(p.id)}">${icon('trash', 'sm')}</button></span></div>`).join('')}</div>` : emptyState({ icon: 'box', title: q ? 'لا نتائج' : 'لا منتجات بعد', text: q ? 'جرّب كلمة بحث أخرى.' : 'أضف منتجك الأول: دليل، قالب، كتاب أو خدمة رقمية.', action: q ? '' : `<button class="btn primary" data-act="add-product">${icon('plus', 'sm')} إضافة أول منتج</button>` })}
  ${all.some((p) => p.mode === 'paid') ? `<div class="callout" style="margin-top:18px">${icon('shield')}<div><b>التسليم الآمن مفعّل</b><span>روابط وملفات المنتجات المدفوعة لا تظهر في الصفحة العامة، وتُفتح فقط للطلبات المدفوعة.</span></div></div>` : ''}`;
}

/* ============================== orders ============================== */
export async function orders(ctx) {
  const d = ctx.draft;
  const status = String(ctx.query.status || '');
  const search = String(ctx.query.q || '');
  const page = Math.max(0, Number(ctx.query.page || 0));
  const limit = 20;
  let rows = [], count = 0, err = '';
  try { const r = await api.listOrders({ status, search, limit, offset: page * limit }); rows = r.rows; count = r.count; }
  catch (e) { err = api.errorText(e); }
  const s = ctx.stats || {};
  const tabs = [['', 'الكل'], ['pending', 'بانتظار الدفع'], ['paid', 'مدفوع'], ['delivered', 'تم التسليم'], ['cancelled', 'ملغى'], ['refunded', 'مسترجع']];
  const qs = (over = {}) => { const p = { ...(status ? { status } : {}), ...(search ? { q: search } : {}), ...(page ? { page } : {}), ...over }; return Object.entries(p).filter(([, v]) => v !== '' && v != null).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&'); };
  return `<div class="page-head"><div><h2>الطلبات</h2><p>${s.orders_pending || 0} طلبًا بانتظار الدفع · ${s.orders_total || 0} إجمالًا</p></div><div class="actions"><button class="btn" data-act="export-orders">${icon('download', 'sm')} تصدير CSV</button></div></div>
  <div class="grid c4" style="margin-bottom:18px"><div class="card stat" style="padding:13px 15px"><div class="label">بانتظار الدفع</div><div class="value" style="font-size:21px">${s.orders_pending || 0}</div></div><div class="card stat" style="padding:13px 15px"><div class="label">مدفوع / مسلّم</div><div class="value" style="font-size:21px">${s.orders_paid || 0}</div></div><div class="card stat" style="padding:13px 15px"><div class="label">إيرادات</div><div class="value" style="font-size:21px">${money(s.revenue_minor || 0, cur(d))}</div></div><div class="card stat" style="padding:13px 15px"><div class="label">آخر 30 يومًا</div><div class="value" style="font-size:21px">${s.orders_30d || 0}</div></div></div>
  <div class="card"><div class="card-head" style="padding-bottom:0;border-bottom:0"><div class="tabs" style="margin:0;border:0">${tabs.map(([v, t]) => `<a href="#/orders${v ? '?status=' + v : ''}${search ? (v ? '&' : '?') + 'q=' + encodeURIComponent(search) : ''}" class="${status === v ? 'on' : ''}" style="text-decoration:none">${t}</a>`).join('')}</div></div>
    <div style="padding:12px 16px"><div class="filters" style="margin:0"><div class="searchbox">${icon('search', 'sm')}<input id="orders-q" placeholder="اسم، بريد أو رقم طلب…" value="${attr(search)}"></div><select class="select" id="orders-status"><option value="">كل الحالات</option>${tabs.slice(1).map(([v, t]) => `<option value="${v}" ${status === v ? 'selected' : ''}>${t}</option>`).join('')}</select><button class="btn sm primary" data-act="orders-apply">${icon('filter', 'sm')} تطبيق</button>${status || search ? `<a class="btn sm" href="#/orders">مسح</a>` : ''}</div></div>
    ${err ? `<div class="callout rose" style="margin:0 16px 16px">${icon('alert')}<div>${esc(err)}</div></div>` : rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>الطلب</th><th>الزبون</th><th>المنتجات</th><th>المبلغ</th><th>الدفع</th><th>الحالة</th><th></th></tr></thead><tbody>${rows.map((o) => `<tr><td><span class="order-link">${esc(o.order_no)}</span><div class="tiny muted">${esc(fmtDate(o.created_at))}</div></td><td><div class="cell-main"><b>${esc(o.buyer_name)}</b><span>${esc(o.buyer_email)}</span></div></td><td><span class="small">${(o.items || []).length} منتج</span><div class="tiny muted truncate" style="max-width:180px">${esc((o.items || []).map((i) => i.title).join('، '))}</div></td><td class="money">${money(o.total_minor, o.currency)}</td><td><span class="chip">${esc(methodLabel(o.payment_method, d))}</span></td><td>${statusChip(o.status)}</td><td><div class="actions"><button class="btn sm" data-act="order-open" data-id="${attr(o.id)}">تفاصيل ${icon('chevron-left', 'sm')}</button></div></td></tr>`).join('')}</tbody></table></div><div class="pager"><span>عرض ${page * limit + 1}–${Math.min(count, page * limit + rows.length)} من ${count}</span><div class="row">${page > 0 ? `<a class="btn sm" href="#/orders?${qs({ page: page - 1 })}">${icon('chevron-right', 'sm')} السابق</a>` : ''}${(page + 1) * limit < count ? `<a class="btn sm" href="#/orders?${qs({ page: page + 1 })}">التالي ${icon('chevron-left', 'sm')}</a>` : ''}</div></div>` : emptyState({ icon: 'receipt', title: status || search ? 'لا نتائج' : 'لا طلبات بعد', text: status || search ? 'جرّب تغيير الفلاتر.' : 'عندما يشتري زبون من متجرك سيظهر الطلب هنا مع تفاصيل الدفع.', action: status || search ? `<a class="btn" href="#/orders">مسح الفلاتر</a>` : `<a class="btn primary" href="#/products">${icon('box', 'sm')} أضف منتجًا</a>` })}
  </div>`;
}
const methodLabel = (id, d) => {
  if (!id) return '—';
  if (id === 'youcanpay') return 'YouCan Pay';
  if (id === 'manual') return 'يدوي';
  return (d.pay || []).find((m) => m.id === id)?.t || id;
};

/* ============================== customers ============================== */
export async function customers(ctx) {
  const search = String(ctx.query.q || '');
  let rows = [], err = '';
  try { rows = await api.customers({ search, limit: 500 }); } catch (e) { err = api.errorText(e); }
  const d = ctx.draft;
  const total = rows.reduce((a, c) => a + c.total_minor, 0);
  return `<div class="page-head"><div><h2>العملاء</h2><p>${rows.length} عميلًا · ${money(total, cur(d))} إجمالي المشتريات</p></div><div class="actions"><button class="btn" data-act="export-customers">${icon('download', 'sm')} تصدير CSV</button></div></div>
  <div class="filters"><div class="searchbox" style="flex:1;max-width:340px">${icon('search', 'sm')}<input id="customers-q" placeholder="ابحث بالاسم أو البريد…" value="${attr(search)}"></div><button class="btn sm" data-act="customers-search">${icon('search', 'sm')} بحث</button>${search ? `<a class="btn sm" href="#/customers">مسح</a>` : ''}</div>
  ${err ? `<div class="callout rose">${icon('alert')}<div>${esc(err)}</div></div>` : rows.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>العميل</th><th>الطلبات</th><th>المشتريات</th><th>آخر طلب</th><th></th></tr></thead><tbody>${rows.map((c) => `<tr><td><div class="cell-main"><span class="thumb">${esc(initials(c.name, c.email))}</span><div style="min-width:0"><b>${esc(c.name)}</b><span style="direction:ltr;text-align:start">${esc(c.email)}</span></div></div></td><td><b>${c.orders}</b> <span class="tiny muted">(${c.paid_orders} مدفوع)</span></td><td class="money">${money(c.total_minor, c.currency)}</td><td><div class="small">${esc(timeAgo(c.last))}</div><div class="tiny muted">${esc(c.last_order || '')}</div></td><td><div class="actions"><button class="btn sm" data-act="customer-open" data-email="${attr(c.email)}">ملف ${icon('chevron-left', 'sm')}</button></div></td></tr>`).join('')}</tbody></table></div></div>` : emptyState({ icon: 'users', title: 'لا عملاء بعد', text: 'سيظهر كل من يشتري من متجرك هنا مع سجل طلباته.', action: `<a class="btn primary" href="#/products">${icon('box', 'sm')} أضف منتجًا</a>` })}`;
}

/* ============================== discounts ============================== */
export async function discounts(ctx) {
  let rows = [], err = '';
  try { rows = await api.listDiscounts(); ctx.state.discounts = rows; } catch (e) { err = api.errorText(e); }
  const d = ctx.draft;
  return `<div class="page-head"><div><h2>أكواد الخصم</h2><p>أنشئ عروضًا تزيد المبيعات وتكافئ زبائنك.</p></div><div class="actions"><button class="btn primary" data-act="add-discount">${icon('plus', 'sm')} كود جديد</button></div></div>
  ${err ? `<div class="callout rose">${icon('alert')}<div>${esc(err)}</div></div>` : rows.length ? `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>الكود</th><th>الخصم</th><th>الاستخدام</th><th>الحد الأدنى</th><th>الصلاحية</th><th>مفعّل</th><th></th></tr></thead><tbody>${rows.map((x) => `<tr><td><span class="order-link" style="font-size:13px">${esc(x.code)}</span></td><td><b>${x.kind === 'percent' ? x.value + '%' : money(x.value, cur(d))}</b></td><td><b>${x.uses}</b>${x.max_uses ? `<span class="tiny muted"> / ${x.max_uses}</span>` : ''}</td><td>${x.min_subtotal ? money(x.min_subtotal, cur(d)) : '—'}</td><td class="small">${x.expires_at ? esc(fmtDate(x.expires_at)) : 'بلا نهاية'}${x.starts_at && new Date(x.starts_at) > new Date() ? '<div class="tiny muted">يبدأ لاحقًا</div>' : ''}</td><td><label class="switch"><input type="checkbox" data-discount-toggle="${attr(x.id)}" ${x.active ? 'checked' : ''}><i></i></label></td><td><div class="actions"><button class="btn icon sm" data-act="edit-discount" data-id="${attr(x.id)}">${icon('edit', 'sm')}</button><button class="btn icon sm danger" data-act="del-discount" data-id="${attr(x.id)}">${icon('trash', 'sm')}</button></div></td></tr>`).join('')}</tbody></table></div></div>` : emptyState({ icon: 'tag', title: 'لا أكواد خصم', text: 'أنشئ كودًا مثل WELCOME10 وشاركه مع متابعيك.', action: `<button class="btn primary" data-act="add-discount">${icon('plus', 'sm')} إنشاء كود</button>` })}
  <div class="grid c2" style="margin-top:18px"><div class="card pad"><div class="row" style="margin-bottom:7px"><span class="chip teal">${icon('percent', 'sm')}</span><b class="small">كود النسبة</b></div><p class="small muted" style="margin:0">مثال: خصم 15% على كل المنتجات. حدد حدًا أدنى أو أقصى استخدامات للتحكم في التكلفة.</p></div><div class="card pad"><div class="row" style="margin-bottom:7px"><span class="chip violet">${icon('gift', 'sm')}</span><b class="small">كود المبلغ</b></div><p class="small muted" style="margin:0">مثال: خصم 50 درهمًا على الطلبات فوق 300 درهم. يظهر الخصم تلقائيًا في صفحة الدفع.</p></div></div>`;
}

/* ============================== payments ============================== */
export async function payments(ctx) {
  const d = ctx.draft;
  let ycp = { enabled: false, publicKey: '', sandbox: false, hasPrivateKey: false }, err = '';
  try { ycp = await api.paymentStatus(); } catch (e) { err = api.errorText(e); }
  const methods = d.pay || [];
  const paidCount = (d.products || []).filter((p) => p.mode === 'paid' && p.on).length;
  return `<div class="page-head"><div><h2>المدفوعات</h2><p>اختر كيف يدفع زبائنك. يمكنك الجمع بين أكثر من طريقة.</p></div><div class="actions"><button class="btn" data-act="payment-guide">${icon('help', 'sm')} دليل YouCan Pay</button></div></div>
  ${err ? `<div class="callout rose" style="margin-bottom:16px">${icon('alert')}<div>${esc(err)}</div></div>` : ''}
  ${paidCount && !ycp.enabled && !methods.some((m) => m.on) ? `<div class="callout warn" style="margin-bottom:16px">${icon('alert')}<div><b>لديك ${paidCount} منتجًا مدفوعًا بدون طريقة دفع</b><span>أضف طريقة يدوية أو فعّل YouCan Pay لتتمكن من النشر.</span></div></div>` : ''}
  <div class="grid" style="grid-template-columns:1.05fr .95fr">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>YouCan Pay</h3><p>بطاقات بنكية وCashPlus · بدون رسوم شهرية</p></div><span class="chip ${ycp.enabled ? 'green' : 'amber'}"><span class="dot"></span>${ycp.enabled ? 'مفعّل' : ycp.publicKey ? 'غير مفعّل' : 'غير مربوط'}</span></div><div class="card-body">
        <div class="callout" style="margin-bottom:14px">${icon('shield')}<div><b>مفاتيحك محمية</b><span>المفتاح الخاص يُخزَّن في قاعدة البيانات ولا يظهر أبدًا في صفحة المتجر. لا تشاركه مع أي شخص.</span></div></div>
        <div class="field"><label>المفتاح العام (Public Key)</label><input class="input" id="ycp-pub" dir="ltr" value="${attr(ycp.publicKey || '')}" placeholder="pub_…"></div>
        <div class="field"><label>المفتاح الخاص (Private Key)</label><input class="input" id="ycp-priv" dir="ltr" type="password" placeholder="${ycp.hasPrivateKey ? 'محفوظ — اتركه فارغًا للإبقاء عليه' : 'pri_…'}"><p class="hint" style="margin-top:5px">لا يظهر المفتاح المحفوظ لأسباب أمنية.</p></div>
        <div class="row wrap" style="gap:18px;margin:4px 0 14px"><label class="row small" style="gap:7px"><input type="checkbox" id="ycp-sandbox" ${ycp.sandbox ? 'checked' : ''} style="accent-color:var(--accent)"> وضع التجربة (Sandbox)</label><label class="row small" style="gap:7px"><input type="checkbox" id="ycp-enabled" ${ycp.enabled ? 'checked' : ''} style="accent-color:var(--accent)"> تفعيل الدفع بالبطاقة</label></div>
        <div class="row"><button class="btn primary" data-act="save-ycp">${icon('save', 'sm')} حفظ الاتصال</button>${ycp.publicKey ? `<button class="btn danger" data-act="clear-ycp">${icon('trash', 'sm')} حذف المفاتيح</button>` : ''}</div>
        ${ycp.sandbox ? `<div class="callout warn" style="margin-top:12px">${icon('info')}<div><b>وضع التجربة</b><span>استخدم بطاقة 4242 4242 4242 4242 للنجاح و4000 0000 0000 0077 للرفض. لن تُحصَّل أموال حقيقية.</span></div></div>` : ''}
      </div></div>
      <div class="card"><div class="card-head"><div><h3>ملاحظة الدفع</h3><p>تظهر أسفل طرق الدفع في صفحة الطلب</p></div></div><div class="card-body"><textarea class="textarea" data-field="checkout.note" rows="3" placeholder="مثال: بعد الدفع أرسل صورة التحويل على واتساب لتأكيد الطلب.">${esc(d.checkout.note || '')}</textarea></div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>الطرق اليدوية</h3><p>تحويل بنكي، CashPlus، PayPal…</p></div><button class="btn sm primary" data-act="add-payment">${icon('plus', 'sm')} إضافة</button></div><div class="card-body">${methods.length ? `<div class="list-stack">${methods.map((m) => `<div class="item-card"><span class="ic-tile">${icon(m.kind === 'bank' ? 'bank' : m.kind === 'cashplus' ? 'cash' : m.kind === 'paypal' ? 'paypal' : 'wallet')}</span><span class="body"><b>${esc(m.t)}</b><span>${esc((m.d || '').slice(0, 80) || 'بدون تعليمات')}</span></span><span class="tools"><label class="switch"><input type="checkbox" data-toggle-kind="pay:${attr(m.id)}" ${m.on ? 'checked' : ''}><i></i></label><button class="btn icon sm" data-act="edit-payment" data-id="${attr(m.id)}">${icon('edit', 'sm')}</button><button class="btn icon sm danger" data-act="del-payment" data-id="${attr(m.id)}">${icon('trash', 'sm')}</button></span></div>`).join('')}</div>` : emptyState({ icon: 'wallet', title: 'لا طرق يدوية', text: 'أضف تحويلًا بنكيًا أو CashPlus لتبدأ البيع فورًا بدون مفاتيح API.', action: `<button class="btn primary" data-act="add-payment">${icon('plus', 'sm')} إضافة طريقة</button>` })}</div></div>
      <div class="card pad"><div class="row" style="margin-bottom:9px"><span class="ic-tile" style="width:36px;height:36px;border-radius:10px;background:var(--accent-soft);color:var(--accent-ink);display:grid;place-items:center">${icon('zap', 'sm')}</span><div><b class="small">كيف يعمل الدفع؟</b><p class="tiny muted" style="margin:0">اختر الطريقة في صفحة الدفع</p></div></div><div class="stack" style="gap:8px"><div class="row small" style="align-items:flex-start"><span class="chip teal">1</span><span class="muted">ينشئ الزبون الطلب ويظهر له رقم الطلب وتعليمات الدفع.</span></div><div class="row small" style="align-items:flex-start"><span class="chip teal">2</span><span class="muted">يدفع عبر البطاقة (تلقائي) أو يحوّل يدويًا ثم يضغط «أبلغت عن الدفع».</span></div><div class="row small" style="align-items:flex-start"><span class="chip teal">3</span><span class="muted">تؤكد أنت الدفع من «الطلبات» فيُفتح رابط التحميل للزبون.</span></div></div></div>
    </div>
  </div>`;
}

/* ============================== design ============================== */
export async function design(ctx) {
  const d = ctx.draft;
  const previewUrl = new URL('public.html', location.href);
  previewUrl.searchParams.set('store', ctx.store.slug); previewUrl.searchParams.set('preview', '1');
  return `<div class="page-head"><div><h2>التصميم</h2><p>اختر هوية متجرك. كل التغييرات تُحفظ تلقائيًا وتظهر بعد النشر.</p></div><div class="actions"><button class="btn" data-act="refresh-preview">${icon('refresh', 'sm')} تحديث المعاينة</button><button class="btn primary" data-act="publish">${icon('rocket', 'sm')} نشر التصميم</button></div></div>
  <div class="grid" style="grid-template-columns:1.35fr 1fr">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>الهوية</h3><p>الصورة والاسم والنبذة</p></div></div><div class="card-body">
        <div class="row" style="gap:14px;margin-bottom:16px"><span class="thumb" style="width:62px;height:62px;border-radius:18px;overflow:hidden;font-size:19px">${d.profile.avatar ? `<img src="${attr(d.profile.avatar)}" alt="">` : esc(initials(d.profile.name))}</span><div style="flex:1"><b class="small">الصورة الشخصية</b><p class="tiny muted" style="margin:2px 0 7px">مربعة أو دائرية، تُقصّ تلقائيًا.</p><label class="btn sm" style="display:inline-flex">${icon('upload', 'sm')} رفع صورة<input type="file" accept="image/*" id="avatar-input" hidden></label>${d.profile.avatar ? ` <button class="btn sm danger" data-act="remove-avatar">${icon('trash', 'sm')}</button>` : ''}</div></div>
        <div class="field"><label>اسم المتجر</label><input class="input" data-field="profile.name" value="${attr(d.profile.name)}" maxlength="60"></div>
        <div class="field"><label>النبذة</label><textarea class="textarea" data-field="profile.bio" rows="3" maxlength="300" placeholder="اكتب سطرين عنك وعن ما تقدمه…">${esc(d.profile.bio)}</textarea></div>
        <div class="field"><label>الموقع <span class="hint">اختياري</span></label><input class="input" data-field="profile.location" value="${attr(d.profile.location)}" placeholder="الدار البيضاء، المغرب"></div>
      </div></div>
      <div class="card"><div class="card-head"><div><h3>الثيم</h3><p>اختر لوحة ألوان تناسب علامتك</p></div></div><div class="card-body"><div class="theme-grid">${DESIGN_THEMES.map((t) => `<button class="theme-card ${d.design.theme === t.id ? 'on' : ''}" data-act="theme" data-theme="${t.id}"><span class="theme-swatch" style="background:linear-gradient(135deg,${t.bg},${t.accent})"></span><b>${t.name}</b></button>`).join('')}</div>
        <div class="row" style="margin-top:16px;gap:14px;flex-wrap:wrap"><div class="field" style="margin:0;flex:1;min-width:140px"><label>لون التمييز</label><div class="row"><span class="color-dot"><input type="color" data-field="design.accent" value="${attr(d.design.accent || '#0d9488')}"></span><span class="mono small">${esc(d.design.accent || 'تلقائي')}</span>${d.design.accent ? `<button class="btn sm ghost" data-act="accent-reset">إعادة</button>` : ''}</div></div><div class="field" style="margin:0;flex:1;min-width:160px"><label>الخط</label><select class="select" data-field="design.font"><option value="cairo" ${d.design.font === 'cairo' ? 'selected' : ''}>Cairo — حديث</option><option value="tajawal" ${d.design.font === 'tajawal' ? 'selected' : ''}>Tajawal — أنيق</option><option value="ibm" ${d.design.font === 'ibm' ? 'selected' : ''}>IBM Plex Arabic — تقني</option><option value="system" ${d.design.font === 'system' ? 'selected' : ''}>خط النظام — سريع</option></select></div></div>
      </div></div>
      <div class="card"><div class="card-head"><div><h3>شكل المنتجات</h3><p>الشبكة والصور والتفاصيل</p></div></div><div class="card-body"><div class="grid c2" style="gap:14px">
        <div class="field" style="margin:0"><label>طريقة العرض</label><div class="seg"><button class="${d.design.layout !== 'list' ? 'on' : ''}" data-act="design-set" data-key="layout" data-value="grid">شبكة</button><button class="${d.design.layout === 'list' ? 'on' : ''}" data-act="design-set" data-key="layout" data-value="list">قائمة</button></div></div>
        <div class="field" style="margin:0"><label>أبعاد الصورة</label><select class="select" data-field="design.ratio"><option value="1/1" ${d.design.ratio === '1/1' ? 'selected' : ''}>مربعة</option><option value="4/3" ${d.design.ratio === '4/3' ? 'selected' : ''}>4:3</option><option value="16/9" ${d.design.ratio === '16/9' ? 'selected' : ''}>16:9</option><option value="3/4" ${d.design.ratio === '3/4' ? 'selected' : ''}>طولية</option></select></div>
        <div class="field" style="margin:0"><label>أسلوب الهيرو</label><div class="seg"><button class="${d.design.hero !== 'centered' ? 'on' : ''}" data-act="design-set" data-key="hero" data-value="split">جانبي</button><button class="${d.design.hero === 'centered' ? 'on' : ''}" data-act="design-set" data-key="hero" data-value="centered">وسط</button></div></div>
        <div class="field" style="margin:0"><label>الوصف والسعر</label><div class="stack" style="gap:7px"><label class="row small" style="gap:7px"><input type="checkbox" data-check="design.desc" ${d.design.desc ? 'checked' : ''} style="accent-color:var(--accent)"> إظهار الوصف</label><label class="row small" style="gap:7px"><input type="checkbox" data-check="design.price" ${d.design.price ? 'checked' : ''} style="accent-color:var(--accent)"> إظهار السعر</label></div></div>
      </div></div></div>
      <div class="card"><div class="card-head"><div><h3>التذييل</h3><p>نص أسفل الصفحة</p></div></div><div class="card-body"><div class="field" style="margin:0"><input class="input" data-field="design.footer" value="${attr(d.design.footer)}" placeholder="© 2026 متجري — جميع الحقوق محفوظة" maxlength="140"></div></div></div>
    </div>
    <div class="stack"><div class="card" style="position:sticky;top:86px"><div class="card-head"><div><h3>معاينة</h3><p>تحديث تلقائي بعد الحفظ</p></div><button class="btn sm icon" data-act="refresh-preview" title="تحديث">${icon('refresh', 'sm')}</button></div><div class="card-body"><iframe class="preview-frame" id="store-preview" src="${attr(previewUrl.href)}" title="معاينة المتجر"></iframe></div></div><div class="callout">${icon('info')}<div><b>نصيحة</b><span>استخدم صورة واضحة واسمًا قصيرًا. الألوان الداكنة تعطي إحساسًا فاخرًا، والفاتحة تبدو أقرب للقراءة.</span></div></div></div>
  </div>`;
}

/* ============================== analytics ============================== */
export async function analytics(ctx) {
  const d = ctx.draft;
  const s = ctx.stats || await api.stats().catch(() => ({}));
  const daily = s.daily || [];
  const views = daily.map((x) => ({ label: x.day.slice(5), value: Number(x.views || 0) }));
  const revenue = daily.map((x) => ({ label: x.day.slice(5), value: Number(x.revenue_minor || 0) }));
  const conv = s.visitors_30d ? Math.round(((s.orders_30d || 0) / s.visitors_30d) * 1000) / 10 : 0;
  const maxF = Math.max(1, s.views_30d || 0, s.product_views_30d || 0, s.checkout_starts_30d || 0, s.orders_30d || 0);
  const funnel = [
    ['زيارات', s.views_30d || 0, 'eye'], ['مشاهدة منتج', s.product_views_30d || 0, 'box'],
    ['بدء دفع', s.checkout_starts_30d || 0, 'cart'], ['طلبات', s.orders_30d || 0, 'receipt']
  ];
  return `<div class="page-head"><div><h2>التحليلات</h2><p>آخر 30 يومًا · ${s.visitors_30d || 0} زائرًا · ${s.views_30d || 0} زيارة</p></div><div class="actions"><button class="btn" data-act="export-analytics">${icon('download', 'sm')} تصدير CSV</button></div></div>
  <div class="grid c4"><div class="card stat"><div class="ico amber">${icon('eye')}</div><div class="label">الزيارات</div><div class="value">${s.views_30d || 0}</div><div class="foot">${pctTrend(s.views_30d || 0, s.views_prev_30d || 0)}</div></div><div class="card stat"><div class="ico blue">${icon('users')}</div><div class="label">الزوار الفريدون</div><div class="value">${s.visitors_30d || 0}</div><div class="foot"><span>${pct(s.visitors_30d || 0, s.views_30d || 1)}% من الزيارات</span></div></div><div class="card stat"><div class="ico violet">${icon('box')}</div><div class="label">مشاهدات المنتجات</div><div class="value">${s.product_views_30d || 0}</div><div class="foot"><span>${s.checkout_starts_30d || 0} بدء دفع</span></div></div><div class="card stat"><div class="ico teal">${icon('trending')}</div><div class="label">التحويل</div><div class="value">${conv}%</div><div class="foot"><span>${s.orders_30d || 0} طلبًا</span></div></div></div>
  <div class="grid" style="grid-template-columns:1.5fr 1fr;margin-top:18px">
    <div class="card"><div class="card-head"><div><h3>الزيارات اليومية</h3><p>آخر 30 يومًا</p></div><span class="chip amber">${s.views_30d || 0}</span></div><div class="card-body">${lineChart(views, { money: false })}<div class="chart-legend"><span><i style="background:#0d9488"></i>زيارات الصفحة</span></div></div></div>
    <div class="card"><div class="card-head"><div><h3>مسار الشراء</h3><p>من الزيارة إلى الطلب</p></div></div><div class="card-body"><div class="funnel">${funnel.map(([t, v], i) => `<div class="funnel-step"><span style="width:82px" class="small muted">${t}</span><span class="bar"><i style="width:${Math.max(3, (v / maxF) * 100)}%"></i><span>${v}</span></span><em>${i === 0 ? '100%' : pct(v, funnel[0][1]) + '%'}</em></div>`).join('')}</div></div></div>
  </div>
  <div class="grid c2" style="margin-top:18px"><div class="card"><div class="card-head"><div><h3>الإيرادات اليومية</h3><p>آخر 30 يومًا</p></div><span class="chip teal">${money(s.revenue_30d_minor || 0, cur(d))}</span></div><div class="card-body">${lineChart(revenue, { money: true, currency: cur(d) })}</div></div>
    <div class="card"><div class="card-head"><div><h3>المنتجات الأكثر مبيعًا</h3><p>حسب الإيرادات</p></div></div><div class="card-body">${(s.top_products || []).length ? `<div class="bars">${s.top_products.map((p) => `<div class="bar-row"><span class="truncate">${esc(p.title || p.id)}</span><span class="bar-track"><span class="bar-fill" style="width:${pct(p.revenue_minor, Math.max(1, s.top_products[0].revenue_minor))}%"></span></span><b>${money(p.revenue_minor, cur(d))}</b></div>`).join('')}</div>` : emptyState({ icon: 'chart', title: 'لا بيانات بعد', text: 'ستظهر هنا المنتجات التي تبيع أكثر.' })}</div></div>
  </div>
  <div class="callout" style="margin-top:18px">${icon('shield')}<div><b>خصوصية الزوار</b><span>نستخدم معرّف زائر عشوائيًا قصير العمر فقط لحساب الزيارات. لا نستخدم كوكيز تتبع إعلانية.</span></div></div>`;
}

/* ============================== settings ============================== */
export async function settings(ctx) {
  const d = ctx.draft;
  const slug = ctx.store.slug;
  return `<div class="page-head"><div><h2>الإعدادات</h2><p>بيانات المتجر والحساب. الحفظ تلقائي بعد كل تعديل.</p></div><div class="actions"><button class="btn" data-act="export">${icon('download', 'sm')} تصدير البيانات</button></div></div>
  <div class="grid" style="grid-template-columns:1.2fr .8fr">
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>بيانات المتجر</h3><p>تظهر في صفحتك العامة ومحركات البحث</p></div></div><div class="card-body">
        <div class="field"><label>اسم المتجر</label><input class="input" data-field="profile.name" value="${attr(d.profile.name)}" maxlength="60"></div>
        <div class="field"><label>نبذة</label><textarea class="textarea" data-field="profile.bio" rows="3" maxlength="300">${esc(d.profile.bio)}</textarea></div>
        <div class="grid c2" style="gap:12px"><div class="field"><label>البريد للتواصل</label><input class="input" data-field="shop.email" type="email" dir="ltr" value="${attr(d.shop.email)}"></div><div class="field"><label>الهاتف</label><input class="input" data-field="shop.phone" dir="ltr" value="${attr(d.shop.phone)}" placeholder="+212…"></div></div>
        <div class="grid c2" style="gap:12px"><div class="field"><label>واتساب</label><input class="input" data-field="shop.whatsapp" dir="ltr" value="${attr(d.shop.whatsapp)}" placeholder="+212…"></div><div class="field"><label>تيليجرام</label><input class="input" data-field="shop.telegram" dir="ltr" value="${attr(d.shop.telegram)}" placeholder="@username"></div></div>
        <div class="grid c2" style="gap:12px"><div class="field"><label>المدينة</label><input class="input" data-field="shop.city" value="${attr(d.shop.city)}"></div><div class="field"><label>العملة</label><select class="select" data-field="shop.currency">${CURRENCIES.map(([c, n]) => `<option value="${c}" ${d.shop.currency === c ? 'selected' : ''}>${c} — ${n}</option>`).join('')}</select></div></div>
        <div class="field"><label>لغة المتجر الافتراضية</label><select class="select" data-field="lang"><option value="ar" ${d.lang === 'ar' ? 'selected' : ''}>العربية</option><option value="fr" ${d.lang === 'fr' ? 'selected' : ''}>الفرنسية</option><option value="en" ${d.lang === 'en' ? 'selected' : ''}>الإنجليزية</option></select></div>
      </div></div>
      <div class="card"><div class="card-head"><div><h3>السياسات والتسليم</h3><p>تظهر للزبون قبل الشراء</p></div></div><div class="card-body"><div class="field"><label>شروط البيع <span class="hint">اختياري</span></label><textarea class="textarea" data-field="shop.terms" rows="3" placeholder="سياسة الاسترجاع، مدة التسليم…">${esc(d.shop.terms)}</textarea></div><div class="field" style="margin:0"><label>ملاحظة التسليم العامة</label><input class="input" data-field="shop.deliveryNote" value="${attr(d.shop.deliveryNote)}" placeholder="مثال: تصلك المنتجات الرقمية فور تأكيد الدفع."></div></div></div>
      <div class="card"><div class="card-head"><div><h3>SEO ومشاركة الروابط</h3><p>عنوان ووصف ظهور متجرك في البحث</p></div></div><div class="card-body"><div class="field"><label>عنوان الصفحة</label><input class="input" data-field="seo.title" value="${attr(d.seo.title)}" maxlength="70" placeholder="${attr(d.profile.name)} — متجر رقمي"></div><div class="field"><label>الوصف</label><textarea class="textarea" data-field="seo.description" rows="2" maxlength="160">${esc(d.seo.description)}</textarea></div><div class="field" style="margin:0"><label>صورة المشاركة <span class="hint">رابط https</span></label><input class="input" data-field="seo.image" dir="ltr" value="${attr(d.seo.image)}" placeholder="https://…"></div></div></div>
    </div>
    <div class="stack">
      <div class="card"><div class="card-head"><div><h3>رابط المتجر</h3><p>العنوان الذي يشاركه زبائنك</p></div></div><div class="card-body"><div class="field"><label>الرابط الحالي</label><div class="share-link"><input value="${attr(ctx.storeUrl())}" readonly><button class="btn sm" data-act="copy-store">${icon('copy', 'sm')}</button></div></div><div class="field" style="margin:0"><label>تغيير الرابط</label><div class="input-group"><span class="prefix">/</span><input class="input" id="slug-input" dir="ltr" value="${attr(slug)}" pattern="[a-z0-9][a-z0-9-]{2,39}"><button class="btn" data-act="check-slug">تحقق</button></div><p class="hint" id="slug-hint" style="margin-top:5px">3–40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة. تغيير الرابط يبقي الطلبات القديمة.</p><button class="btn primary sm" style="margin-top:8px" data-act="save-slug">${icon('save', 'sm')} حفظ الرابط</button></div></div></div>
      <div class="card"><div class="card-head"><div><h3>الحساب</h3><p>${esc(ctx.user?.email || '')}</p></div></div><div class="card-body"><div class="row between" style="margin-bottom:10px"><span class="small muted">تغيير كلمة المرور</span><button class="btn sm" data-act="reset-password">${icon('mail', 'sm')} إرسال رابط</button></div><div class="row between"><span class="small muted">تسجيل الخروج</span><button class="btn sm danger" data-act="logout">${icon('logout', 'sm')} خروج</button></div></div></div>
      <div class="card"><div class="card-head"><div><h3>النسخ الاحتياطي</h3><p>صدّر أو استورد مسودتك</p></div></div><div class="card-body"><div class="row wrap"><button class="btn" data-act="export">${icon('download', 'sm')} تصدير JSON</button><button class="btn" data-act="import">${icon('upload', 'sm')} استيراد</button></div><p class="tiny muted" style="margin:10px 0 0">يحتوي التصدير على المنتجات والروابط والإعدادات، وليس الطلبات.</p></div></div>
      <div class="card" style="border-color:#fecdd3"><div class="card-head" style="border-color:#ffe4e6"><div><h3 style="color:#be123c">منطقة الخطر</h3><p>إجراءات لا يمكن التراجع عنها</p></div></div><div class="card-body"><div class="row between" style="margin-bottom:12px"><div><b class="small">إيقاف نشر المتجر</b><p class="tiny muted" style="margin:2px 0 0">يبقى المحتوى محفوظًا.</p></div><button class="btn sm" data-act="unpublish">${icon('ban', 'sm')} إيقاف</button></div><div class="row between"><div><b class="small" style="color:#be123c">حذف المتجر</b><p class="tiny muted" style="margin:2px 0 0">المنتجات والطلبات والروابط نهائيًا.</p></div><button class="btn sm danger" data-act="delete-store">${icon('trash', 'sm')} حذف</button></div></div></div>
    </div>
  </div>`;
}

export const VIEWS = { overview, store, links, products, orders, customers, discounts, payments, design, analytics, settings };
