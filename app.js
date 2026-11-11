/* Rabiti dashboard application shell. */
import {
  $, $$, esc, attr, uid, debounce, slugify, isEmail, initials, icon, toast, modal, drawer,
  confirmDialog, copyText, downloadText, timeAgo, money, avatarHTML, qs, spinner, closeOverlay, downloadCsv
} from './ui.js';
import * as api from './api.js';
import { normalizeDraft, defaultDraft, storeUrl, newLink, newProduct, newPayMethod } from './api.js';
import { VIEWS, VIEW_META, price, modeChip } from './views.js';

const state = {
  session: null, user: null, store: null, view: 'overview', query: {},
  dirty: false, saving: false, saveError: '', renderToken: 0, editVersion: 0,
  stats: null, discounts: [], authMode: 'login', recovery: false, booted: false, publishing: false,
  storePublished: false, publishedAt: null
};

let saveTimer = null;
let saveChain = Promise.resolve();
const uiClose = closeOverlay;
const viewEl = () => $('#view');
const draft = () => state.store?.draft;

/* ============================== boot ============================== */
async function boot() {
  if (!api.configured) { renderConfigError(); return; }
  try { api.initClient(); } catch (e) { renderConfigError(e.message); return; }
  api.onAuth(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') { state.recovery = true; renderAuth('reset'); return; }
    if (event === 'SIGNED_OUT') { state.session = null; state.user = null; state.store = null; renderAuth('login'); return; }
    if (event === 'SIGNED_IN' && session && !state.booted) { state.session = session; state.user = session.user; await enterApp(); }
  });
  try {
    const session = await api.getSession();
    if (state.recovery) { renderAuth('reset'); return; }
    if (session) { state.session = session; state.user = session.user; await enterApp(); }
    else renderAuth('login');
  } catch (e) { renderAuth('login', api.errorText(e)); }
  window.addEventListener('hashchange', route);
  window.addEventListener('beforeunload', (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openCommand(); }
    if (e.key === 'Escape') { closeUserMenu(); if (sidebarOpen()) closeSidebar(); }
  });
  window.addEventListener('resize', () => { if (window.innerWidth > 980 && sidebarOpen()) closeSidebar(); });
}

function renderConfigError(msg = '') {
  document.body.innerHTML = `<div class="auth"><div class="auth-art">${artPanel()}</div><div class="auth-panel"><div class="auth-card"><div class="brand-sm"><span class="logo-mark">${icon('link')}</span>رابطي</div><h2>إعداد ناقص</h2><p class="sub">لم يتم ضبط اتصال Supabase. أضف عنوان المشروع والمفتاح العام في <b>config.js</b> ثم أعد تحميل الصفحة.</p>${msg ? `<div class="form-error">${esc(msg)}</div>` : ''}<a class="btn primary block" href="SETUP-AR.md">دليل الإعداد</a></div></div></div>`;
}

/* ============================== auth ============================== */
function artPanel() {
  return `<div class="auth-brand"><span class="logo-mark">${icon('link')}</span>رابطي</div>
    <div><h1>صفحتك،<br>متجرك،<br><em>هوية واحدة.</em></h1>
    <p>ابنِ صفحة روابط أنيقة وبِع منتجاتك الرقمية بطرق دفع تناسب المغرب والعالم، من لوحة تحكم واحدة.</p>
    <ul>
      <li><span>${icon('check', 'sm')}</span>روابط ومنتجات بلا حدود</li>
      <li><span>${icon('check', 'sm')}</span>طلبات وتسليم رقمي آمن</li>
      <li><span>${icon('check', 'sm')}</span>YouCan Pay والتحويل البنكي وCashPlus</li>
      <li><span>${icon('check', 'sm')}</span>تحليلات وأكواد خصم وعملاء</li>
    </ul></div>
    <div class="auth-quote"><b>«رابطي»</b> — كل ما تحتاجه لتحويل متابيعك إلى متجر حقيقي، بدون اشتراك شهري وبدون تعقيد.</div>`;
}

function renderAuth(mode = 'login', msg = '') {
  state.authMode = mode;
  document.body.innerHTML = `<div class="auth" dir="rtl">
    <div class="auth-art">${artPanel()}</div>
    <div class="auth-panel"><div class="auth-card">
      <div class="brand-sm"><span class="logo-mark">${icon('link')}</span>رابطي</div>
      ${authForm(mode, msg)}
      <p class="auth-foot">بالمتابعة أنت توافق على استخدام حسابك فقط لإنشاء متجرك. <a href="README.md">ما هو رابطي؟</a></p>
    </div></div></div>`;
  bindAuth(mode);
}

function authForm(mode, msg) {
  if (mode === 'reset') return `<h2>كلمة مرور جديدة</h2><p class="sub">اختر كلمة مرور قوية لحسابك.</p>
    <form id="auth-form"><div class="field"><label>كلمة المرور الجديدة</label><input class="input" id="au-pass" type="password" minlength="8" autocomplete="new-password" required></div>
    <div class="field"><label>تأكيد كلمة المرور</label><input class="input" id="au-pass2" type="password" minlength="8" autocomplete="new-password" required></div>
    ${msg ? `<div class="form-error">${esc(msg)}</div>` : ''}<button class="btn primary block lg" id="au-submit">حفظ كلمة المرور</button></form>`;
  const reg = mode === 'register', magic = mode === 'magic', forgot = mode === 'forgot';
  return `<h2>${reg ? 'أنشئ متجرك' : forgot ? 'استرجاع كلمة المرور' : magic ? 'دخول برابط سحري' : 'مرحبًا بعودتك'}</h2>
    <p class="sub">${reg ? 'حساب واحد، ومتجرك متاح من أي جهاز.' : forgot ? 'سنرسل لك رابطًا لإعادة تعيين كلمة المرور.' : magic ? 'سنرسل رابط دخول مباشر إلى بريدك.' : 'سجّل الدخول لإدارة متجرك وطلباتك.'}</p>
    ${!forgot && !magic ? `<div class="auth-tabs"><button type="button" class="${!reg ? 'on' : ''}" data-auth-tab="login">دخول</button><button type="button" class="${reg ? 'on' : ''}" data-auth-tab="register">حساب جديد</button></div>` : ''}
    <form id="auth-form">
      ${reg ? `<div class="field"><label>الاسم الكامل</label><input class="input" id="au-name" autocomplete="name" placeholder="اسمك أو اسم متجرك" required></div>` : ''}
      <div class="field"><label>البريد الإلكتروني</label><input class="input" id="au-email" type="email" autocomplete="email" placeholder="you@example.com" required></div>
      ${!magic && !forgot ? `<div class="field"><label>كلمة المرور <button type="button" class="hint" style="border:0;background:none;color:var(--accent-ink);font-weight:800;cursor:pointer" data-auth-tab="forgot">نسيت كلمة المرور؟</button></label><input class="input" id="au-pass" type="password" minlength="8" autocomplete="${reg ? 'new-password' : 'current-password'}" required></div>` : ''}
      ${reg ? `<div class="field"><label>تأكيد كلمة المرور</label><input class="input" id="au-pass2" type="password" minlength="8" autocomplete="new-password" required></div>` : ''}
      ${msg ? `<div class="form-error">${esc(msg)}</div>` : ''}
      <button class="btn primary block lg" id="au-submit">${reg ? 'إنشاء الحساب' : forgot ? 'إرسال رابط الاسترجاع' : magic ? 'أرسل رابط الدخول' : 'دخول'}</button>
    </form>
    <div class="auth-alt">${forgot || magic ? `<button type="button" data-auth-tab="login">العودة لتسجيل الدخول</button>` : `<button type="button" data-auth-tab="${magic ? 'login' : 'magic'}">${magic ? 'الدخول بكلمة المرور' : 'الدخول برابط سحري بدون كلمة مرور'}</button>`}</div>`;
}

function bindAuth(mode) {
  $$('[data-auth-tab]').forEach((b) => b.onclick = () => renderAuth(b.dataset.authTab));
  const form = $('#auth-form');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = $('#au-submit'); btn.disabled = true; const old = btn.innerHTML;
    btn.innerHTML = `<span class="ic spin">${icon('loader')}</span> لحظة…`;
    const email = $('#au-email')?.value.trim() || '';
    const pass = $('#au-pass')?.value || '';
    try {
      if (mode === 'reset') {
        const p2 = $('#au-pass2').value;
        if (pass.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
        if (pass !== p2) throw new Error('كلمتا المرور غير متطابقتين.');
        await api.updatePassword(pass); state.recovery = false;
        toast('تم تحديث كلمة المرور', 'ok'); await enterApp(); return;
      }
      if (!isEmail(email)) throw new Error('اكتب بريدًا إلكترونيًا صالحًا.');
      if (mode === 'forgot') { await api.resetPassword(email); renderAuth('login', 'إذا كان البريد مسجلًا فسيصلك رابط الاسترجاع.'); return; }
      if (mode === 'magic') { await api.magicLink(email); renderAuth('login', 'أرسلنا رابط الدخول. راجع بريدك.'); return; }
      if (mode === 'register') {
        if (pass.length < 8) throw new Error('كلمة المرور يجب أن تكون 8 أحرف على الأقل.');
        if (pass !== $('#au-pass2').value) throw new Error('كلمتا المرور غير متطابقتين.');
        const name = $('#au-name').value.trim();
        const data = await api.signUp(email, pass, name);
        if (!data.session) { renderAuth('login', 'تم إنشاء الحساب. راجع بريدك لتأكيد الحساب ثم سجّل الدخول.'); return; }
        state.user = data.user; state.session = data.session; await enterApp(); return;
      }
      await api.signIn(email, pass);
      const u = await api.getUser(); state.user = u; await enterApp();
    } catch (err) {
      const msg = api.errorText(err);
      const box = form.querySelector('.form-error') || document.createElement('div');
      box.className = 'form-error'; box.textContent = msg;
      if (!box.parentNode) form.insertBefore(box, btn);
    } finally { if (btn.isConnected) { btn.disabled = false; btn.innerHTML = old; } }
  };
}

/* ============================== onboarding ============================== */
async function enterApp() {
  state.booted = false;
  try {
    const store = await api.loadStore();
    if (!store) { renderOnboarding(); return; }
    state.store = store;
    await afterStoreLoaded();
  } catch (e) {
    if (String(e?.message || e).includes('AUTH_REQUIRED')) { renderAuth('login'); return; }
    renderAuth('login', api.errorText(e));
  }
}

function renderOnboarding(msg = '') {
  const suggested = safeSlug(state.user?.user_metadata?.name || state.user?.email?.split('@')[0] || '', 'mystore');
  document.body.innerHTML = `<div class="auth" dir="rtl"><div class="auth-art">${artPanel()}</div>
    <div class="auth-panel"><div class="auth-card" style="max-width:500px">
      <div class="brand-sm"><span class="logo-mark">${icon('link')}</span>رابطي</div>
      <h2>اختر رابط متجرك</h2>
      <p class="sub">هذا هو العنوان الذي سيشاركه زبائنك. يمكنك تغييره لاحقًا.</p>
      <form id="onboard-form">
        <div class="field"><label>اسم المتجر</label><input class="input" id="ob-name" value="${attr(state.user?.user_metadata?.name || '')}" placeholder="مثال: استوديو نور" required></div>
        <div class="field"><label>رابط المتجر</label><div class="input-group"><span class="prefix">/</span><input class="input" id="ob-slug" dir="ltr" value="${attr(suggested)}" pattern="[a-z0-9][a-z0-9-]{2,39}" required><button type="button" class="btn" id="ob-check">تحقق</button></div><p class="hint" id="ob-hint" style="margin-top:6px">3–40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة.</p></div>
        <div class="field"><label>العملة</label><select class="select" id="ob-currency">${['MAD', 'USD', 'EUR', 'SAR', 'AED', 'GBP', 'EGP', 'DZD', 'TND'].map((c) => `<option value="${c}">${c}</option>`).join('')}</select></div>
        ${msg ? `<div class="form-error">${esc(msg)}</div>` : ''}
        <button class="btn primary block lg" id="ob-submit">إنشاء المتجر</button>
      </form>
      <div class="auth-alt"><button type="button" id="ob-logout">تسجيل الخروج</button> · <button type="button" id="ob-import">استيراد مسودة JSON</button></div>
    </div></div></div>`;
  const slug = $('#ob-slug');
  slug.oninput = () => { slug.value = slugify(slug.value); $('#ob-hint').textContent = '3–40 حرفًا إنجليزيًا صغيرًا أو رقمًا أو شرطة.'; $('#ob-hint').style.color = ''; };
  $('#ob-name').oninput = () => { if (!$('#ob-slug').dataset.touched) { slug.value = slugify($('#ob-name').value) || suggested; } };
  slug.onfocus = () => { slug.dataset.touched = '1'; };
  const check = async () => {
    const v = slug.value.trim();
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(v)) { $('#ob-hint').textContent = 'الرابط غير صالح.'; $('#ob-hint').style.color = '#be123c'; return false; }
    $('#ob-check').disabled = true;
    try {
      const ok = await api.slugAvailable(v);
      $('#ob-hint').textContent = ok ? 'الرابط متاح ✓' : 'هذا الرابط محجوز، جرّب غيره.';
      $('#ob-hint').style.color = ok ? '#047857' : '#be123c';
      return ok;
    } catch (e) { $('#ob-hint').textContent = api.errorText(e); $('#ob-hint').style.color = '#be123c'; return false; }
    finally { $('#ob-check').disabled = false; }
  };
  $('#ob-check').onclick = check;
  $('#ob-logout').onclick = async () => { await api.signOut(); state.user = null; renderAuth('login'); };
  $('#ob-import').onclick = () => importDraftFile();
  $('#onboard-form').onsubmit = async (e) => {
    e.preventDefault();
    const name = $('#ob-name').value.trim();
    const s = slug.value.trim();
    if (!name) { toast('اكتب اسم المتجر', 'err'); return; }
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(s)) { toast('رابط المتجر غير صالح', 'err'); return; }
    const btn = $('#ob-submit'); btn.disabled = true; btn.textContent = 'جارٍ الإنشاء…';
    try {
      const d = defaultDraft();
      d.profile.name = name;
      d.shop.email = state.user?.email || '';
      d.shop.currency = $('#ob-currency').value;
      d.seo.title = name;
      d.seo.description = `متجر ${name} — روابط ومنتجات رقمية.`;
      state.store = await api.createStore(s, d);
      history.replaceState(null, '', '#/overview');
      localStorage.setItem('rabiti:lastView', 'overview');
      await afterStoreLoaded();
    } catch (err) { btn.disabled = false; btn.textContent = 'إنشاء المتجر'; toast(api.errorText(err), 'err'); }
  };
}

async function importDraftFile() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const d = normalizeDraft(data.draft || data);
      const name = d.profile.name || 'متجري';
      const slug = safeSlug(d.profile.name || file.name.replace(/\.json$/i, ''), 'store');
      if (!(await api.slugAvailable(slug))) { toast('الرابط المقترح محجوز. غيّر اسم المتجر ثم أعد الاستيراد.', 'err'); return; }
      d.profile.name = name;
      state.store = await api.createStore(slug, d);
      history.replaceState(null, '', '#/overview');
      localStorage.setItem('rabiti:lastView', 'overview');
      await afterStoreLoaded();
      toast('تم استيراد المسودة', 'ok');
    } catch (e) { toast('ملف غير صالح: ' + api.errorText(e), 'err'); }
  };
  input.click();
}

function safeSlug(value, fallback = 'mystore') {
  let s = slugify(value) || fallback;
  if (s.length < 3) s = `${s}-${fallback}`.replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s.slice(0, 40);
}

async function afterStoreLoaded() {
  state.booted = true;
  state.dirty = false;
  const saved = localStorage.getItem('rabiti:lastView');
  const hashView = location.hash.replace(/^#\/?/, '').split('?')[0];
  state.view = VIEW_META[hashView] ? hashView : (VIEW_META[saved] ? saved : 'overview');
  state.storePublished = await isPublished();
  renderShell();
  route();
  refreshStats();
}

async function isPublished() {
  try {
    const p = await api.publicPage(state.store.slug);
    state.publishedAt = p?.published_at || null;
    return !!p;
  } catch { return false; }
}

/* ============================== shell ============================== */
const NAV = [
  { group: 'الرئيسية', items: [['overview', 'نظرة عامة', 'dashboard'], ['store', 'المتجر والنشر', 'globe']] },
  { group: 'المتجر', items: [['links', 'الروابط', 'link'], ['products', 'المنتجات', 'box'], ['orders', 'الطلبات', 'receipt'], ['customers', 'العملاء', 'users'], ['discounts', 'أكواد الخصم', 'tag']] },
  { group: 'الإعدادات', items: [['payments', 'المدفوعات', 'wallet'], ['design', 'التصميم', 'palette'], ['analytics', 'التحليلات', 'chart'], ['settings', 'الإعدادات', 'settings']] }
];
const MOBILE_NAV = [['overview', 'الرئيسية', 'dashboard'], ['products', 'المنتجات', 'box'], ['orders', 'الطلبات', 'receipt'], ['store', 'المتجر', 'globe'], ['settings', 'الإعدادات', 'settings']];

function renderShell() {
  const d = draft();
  const name = d.profile.name || state.store.slug;
  document.body.innerHTML = `<div class="shell">
    <aside class="sidebar" id="sidebar">
      <div class="side-brand"><span class="logo-mark">${icon('link')}</span>رابطي<button class="side-close" data-act="menu-close" aria-label="إغلاق القائمة">${icon('x', 'sm')}</button></div>
      <div class="side-store"><span class="av">${d.profile.avatar ? `<img src="${attr(d.profile.avatar)}" alt="">` : esc(initials(name, state.user?.email))}</span><div style="min-width:0"><b>${esc(name)}</b><span>/${esc(state.store.slug)}</span></div></div>
      ${NAV.map((sec) => `<div class="side-label">${sec.group}</div><nav class="side-nav">${sec.items.map(([v, label, ic]) => `<a href="#/${v}" data-nav="${v}" class="${state.view === v ? 'on' : ''}">${icon(ic)}<span>${label}</span>${v === 'orders' ? `<span class="badge hidden" id="orders-badge">0</span>` : ''}</a>`).join('')}</nav>`).join('')}
      <div class="side-foot">
        <div class="side-tip"><b>هل تحتاج مساعدة؟</b><p>دليل سريع لإعداد الدفع والنشر خلال دقائق.</p><button class="btn sm" style="margin-top:9px;background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.14);color:#e2e8f0;width:100%" data-act="help">${icon('help', 'sm')} دليل الاستخدام</button></div>
        <div class="side-user" id="side-user"><span class="av">${esc(initials('', state.user?.email))}</span><div style="min-width:0"><b>${esc(state.user?.email?.split('@')[0] || 'حسابي')}</b><span>${esc(state.user?.email || '')}</span></div></div>
      </div>
    </aside>
    <div class="side-scrim" data-act="menu-close" aria-hidden="true"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn icon menu-btn" data-act="menu" aria-label="القائمة">${icon('menu')}</button>
        <div><h1 id="page-title">${VIEW_META[state.view]?.title || 'نظرة عامة'}</h1><div class="crumb" id="page-crumb">${VIEW_META[state.view]?.sub || ''}</div></div>
        <div class="spacer"></div>
        <div class="top-actions">
          <button class="searchbox" data-act="command" aria-label="بحث سريع"><span class="ic">${icon('search')}</span><input placeholder="بحث سريع…  ⌘K" readonly></button>
          <span class="chip hidden" id="save-state"></span>
          <a class="btn sm" href="${attr(storeUrl(state.store.slug))}" target="_blank" rel="noopener" data-act="open-store">${icon('external', 'sm')} <span class="hide-sm">المتجر</span></a>
          <button class="btn primary sm" data-act="publish" id="publish-btn">${icon('rocket', 'sm')} نشر</button>
          <button class="top-avatar" id="top-avatar" aria-label="الحساب">${esc(initials(d.profile.name, state.user?.email))}</button>
        </div>
      </header>
      <main class="content" id="view">${spinner()}</main>
    </div>
  </div>
  <nav class="mobile-nav">${MOBILE_NAV.map(([v, label, ic]) => `<a href="#/${v}" data-nav="${v}" class="${state.view === v ? 'on' : ''}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav>
  <div id="menu-root"></div>`;
  document.body.classList.remove('nav-open');
  $('#side-user').onclick = openUserMenu;
  $('#top-avatar').onclick = openUserMenu;
  updateSaveState();
}

function syncChrome() {
  if (!state.store) return;
  const d = state.store.draft;
  const name = d?.profile?.name || state.store.slug;
  const side = document.querySelector('.side-store');
  if (side) {
    const b = side.querySelector('b'); if (b) b.textContent = name;
    const slug = side.querySelector('b + span'); if (slug) slug.textContent = '/' + state.store.slug;
    const av = side.querySelector('.av');
    if (av) av.innerHTML = d?.profile?.avatar ? `<img src="${attr(d.profile.avatar)}" alt="">` : esc(initials(name, state.user?.email));
  }
  const topAvatar = $('#top-avatar'); if (topAvatar) topAvatar.textContent = initials(name, state.user?.email);
  const openStore = $('[data-act="open-store"]'); if (openStore) openStore.href = storeUrl(state.store.slug);
}

function updateShellActive() {
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === state.view));
  const meta = VIEW_META[state.view] || VIEW_META.overview;
  if ($('#page-title')) $('#page-title').textContent = meta.title;
  if ($('#page-crumb')) $('#page-crumb').textContent = meta.sub;
  localStorage.setItem('rabiti:lastView', state.view);
}

function openUserMenu() {
  closeUserMenu();
  const root = $('#menu-root'); if (!root) return;
  const menu = document.createElement('div'); menu.className = 'dropdown-menu'; menu.id = 'user-menu';
  menu.style.cssText = 'position:fixed;top:62px;inset-inline-end:18px;z-index:80';
  menu.innerHTML = `<button data-act="settings">${icon('settings', 'sm')} إعدادات المتجر</button>
    <button data-act="account">${icon('user', 'sm')} حسابي</button>
    <button data-act="help">${icon('help', 'sm')} دليل الاستخدام</button>
    <div class="sep"></div>
    <button data-act="open-store">${icon('external', 'sm')} فتح المتجر</button>
    <button data-act="logout" class="danger">${icon('logout', 'sm')} تسجيل الخروج</button>`;
  root.appendChild(menu);
  setTimeout(() => document.addEventListener('click', outsideUserMenu, { once: true }), 20);
}
function outsideUserMenu(e) { if (!e.target.closest('#user-menu') && !e.target.closest('#top-avatar') && !e.target.closest('#side-user')) closeUserMenu(); }
function closeUserMenu() { $('#user-menu')?.remove(); }

/* Mobile sidebar: the drawer slides over the page, so it needs its own way
 * out (close button, scrim, Escape, navigating) and must stop the page from
 * scrolling behind it. */
function sidebarOpen() { return $('#sidebar')?.classList.contains('open') === true; }
function closeSidebar() {
  $('#sidebar')?.classList.remove('open');
  $('.side-scrim')?.classList.remove('on');
  document.body.classList.remove('nav-open');
}
function toggleSidebar() {
  const side = $('#sidebar'); if (!side) return;
  const open = side.classList.toggle('open');
  $('.side-scrim')?.classList.toggle('on', open);
  document.body.classList.toggle('nav-open', open);
}

function openAccount() {
  modal({
    title: 'حسابي', sub: 'بيانات الدخول والأمان', body: `
      <div class="field"><label>البريد الإلكتروني</label><input class="input" value="${attr(state.user?.email || '')}" readonly></div>
      <div class="field"><label>كلمة المرور</label><p class="hint" style="margin:0 0 8px">سنرسل رابطًا إلى بريدك لتغيير كلمة المرور.</p><button class="btn" data-send-reset>${icon('mail', 'sm')} إرسال رابط تغيير كلمة المرور</button></div>
      <hr class="divider"><div class="row between"><div><b class="small">تسجيل الخروج</b><p class="tiny muted" style="margin:2px 0 0">سيتم حفظ أي تعديلات قبل الخروج.</p></div><button class="btn danger" data-logout>${icon('logout', 'sm')} خروج</button></div>`,
    onMount: (box) => {
      box.querySelector('[data-send-reset]').onclick = async () => { try { await api.resetPassword(state.user.email); toast('تم إرسال الرابط', 'ok'); } catch (e) { toast(api.errorText(e), 'err'); } };
      box.querySelector('[data-logout]').onclick = async () => { await doLogout(); };
    }
  });
}

async function doLogout() {
  try {
    if (state.dirty) await persist();
    await api.signOut();
  } catch (e) { toast(api.errorText(e), 'err'); return; }
  state.user = null; state.store = null; state.booted = false;
  renderAuth('login');
}

/* ============================== routing ============================== */
function route() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [v, query] = raw.split('?');
  state.view = VIEW_META[v] ? v : 'overview';
  state.query = Object.fromEntries(new URLSearchParams(query || ''));
  updateShellActive();
  renderView();
}
function go(view, query = {}) {
  closeSidebar();
  const q = new URLSearchParams(query).toString();
  location.hash = '#/' + view + (q ? '?' + q : '');
  if (state.view === view) { state.query = query; renderView(); }
}

async function renderView() {
  const token = ++state.renderToken;
  const fn = VIEWS[state.view] || VIEWS.overview;
  if (!viewEl()) return;
  viewEl().innerHTML = spinner();
  try {
    const html = await fn(ctx);
    if (token !== state.renderToken || !viewEl()) return;
    viewEl().innerHTML = html;
    updateShellActive();
    syncChrome();
    if (state.view === 'overview' || state.view === 'orders' || state.view === 'analytics') refreshStats();
  } catch (e) {
    if (token !== state.renderToken) return;
    viewEl().innerHTML = `<div class="card"><div class="empty"><div class="ill">${icon('alert', 'lg')}</div><h3>تعذّر تحميل الصفحة</h3><p>${esc(api.errorText(e))}</p><button class="btn" data-act="refresh">${icon('refresh', 'sm')} إعادة المحاولة</button></div></div>`;
  }
}

/* ============================== persistence ============================== */
function updateSaveState() {
  const el = $('#save-state'); if (!el) return;
  if (state.saving) { el.className = 'chip blue'; el.innerHTML = `<span class="dot"></span> جارٍ الحفظ…`; return; }
  if (state.dirty) { el.className = 'chip amber'; el.innerHTML = `<span class="dot"></span> غير محفوظ`; return; }
  if (state.saveError) { el.className = 'chip rose'; el.innerHTML = `<span class="dot"></span> تعذّر الحفظ`; return; }
  el.className = 'chip green'; el.innerHTML = `<span class="dot"></span> محفوظ`;
}
function touch() {
  if (!state.store) return;
  state.dirty = true;
  state.editVersion++;
  updateSaveState();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => persist(), 750);
}
function persist({ force = false } = {}) {
  clearTimeout(saveTimer);
  if (!state.store) return Promise.resolve(true);
  const run = saveChain.then(() => saveDraftNow({ force }));
  saveChain = run.then(() => {}, () => {});
  return run;
}
async function saveDraftNow({ force }) {
  if (!state.store) return true;
  if (!state.dirty && !force) return true;
  state.saving = true; state.saveError = '';
  updateSaveState();
  const version = state.editVersion;
  const snapshot = JSON.parse(JSON.stringify(state.store.draft));
  const revision = state.store.revision;
  try {
    const next = await api.saveDraft(snapshot, revision);
    if (state.store) { state.store.revision = next; }
    state.dirty = state.editVersion !== version;
    state.saving = false;
    updateSaveState();
    return true;
  } catch (e) {
    state.saving = false;
    const msg = api.errorText(e);
    if (String(e?.message || e).includes('REVISION_CONFLICT')) {
      state.saveError = msg;
      updateSaveState();
      conflictModal(snapshot);
    } else {
      state.saveError = msg;
      updateSaveState();
      toast(msg, 'err', 5000);
    }
    return false;
  }
}
function conflictModal(snapshot) {
  modal({
    title: 'تعارض في الحفظ', sub: 'هناك نسخة أحدث محفوظة من جهاز آخر.', body: `<p style="font-size:13.5px;color:var(--muted);line-height:1.8">لحماية تعديلاتك، صدّر نسختك الحالية أولًا ثم أعد تحميل الصفحة لدمجها يدويًا. أو أعد التحميل لتجاهل تعديلات هذا الجهاز.</p>`,
    foot: `<button class="btn" data-export>${icon('download', 'sm')} تصدير نسختي</button><button class="btn primary" data-reload>إعادة التحميل</button>`,
    onMount: (box) => {
      box.querySelector('[data-export]').onclick = () => { downloadText(JSON.stringify(snapshot, null, 2), `rabiti-draft-${Date.now()}.json`); };
      box.querySelector('[data-reload]').onclick = () => location.reload();
    }
  });
}

async function publishNow(trigger) {
  if (state.publishing) return;
  if (!(await persist())) { toast('احفظ التعديلات أولًا', 'err'); return; }
  state.publishing = true;
  const btn = trigger || $('#publish-btn'); const old = btn?.innerHTML;
  if (btn) { btn.disabled = true; btn.innerHTML = `<span class="ic spin">${icon('loader')}</span> نشر…`; }
  try {
    const slug = await api.publish(state.store.revision);
    state.storePublished = true; state.publishedAt = new Date().toISOString();
    updateSaveState();
    toast('تم نشر المتجر بنجاح', 'ok');
    publishModal(slug);
    refreshStats();
    if (state.view === 'store' || state.view === 'overview') renderView();
  } catch (e) {
    const msg = api.errorText(e);
    if (String(e?.message || e).includes('REVISION_CONFLICT')) { conflictModal(JSON.parse(JSON.stringify(state.store.draft))); }
    else {
      modal({
        title: 'تعذّر النشر', sub: 'أكمل الخطوات التالية ثم حاول مجددًا.', body: `<div class="callout warn">${icon('alert')}<div><b>${esc(msg)}</b><span>راجع المنتجات وطرق الدفع في لوحة التحكم.</span></div></div>`,
        foot: `<button class="btn primary" data-close>حسنًا</button>`
      });
    }
  } finally {
    state.publishing = false;
    if (btn?.isConnected) { btn.disabled = false; btn.innerHTML = old; }
  }
}

function publishModal(slug) {
  const url = storeUrl(slug);
  modal({
    title: 'متجرك منشور 🎉', sub: 'أصبح رابطك جاهزًا للمشاركة.', body: `
      <div class="share-box"><div class="share-link"><input id="pub-url" value="${attr(url)}" readonly><button class="btn primary sm" data-copy>${icon('copy', 'sm')} نسخ</button></div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><a class="btn sm" href="${attr(url)}" target="_blank" rel="noopener">${icon('external', 'sm')} فتح المتجر</a><a class="btn sm" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent('تفضل بزيارة متجري: ' + url)}">${icon('whatsapp', 'sm')} واتساب</a><a class="btn sm" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(url)}">${icon('telegram', 'sm')} تيليجرام</a></div></div>
      <div class="callout ok" style="margin-top:14px">${icon('shield')}<div><b>التسليم محمي</b><span>ملفات المنتجات المدفوعة لا تظهر إلا بعد تأكيد الدفع.</span></div></div>`,
    onMount: (box) => { box.querySelector('[data-copy]').onclick = () => copyText(url); },
    foot: `<button class="btn primary" data-close>تم</button>`
  });
}

async function refreshStats() {
  try {
    state.stats = await api.stats();
    const badge = $('#orders-badge');
    if (badge) {
      const n = state.stats.orders_pending || 0;
      badge.textContent = n > 99 ? '99+' : n;
      badge.classList.toggle('hidden', n === 0);
    }
  } catch { /* not fatal */ }
}

/* ============================== common actions ============================== */
const ctx = {
  get state() { return state; },
  get store() { return state.store; },
  get draft() { return state.store?.draft; },
  get user() { return state.user; },
  get stats() { return state.stats; },
  get published() { return state.storePublished; },
  get publishedAt() { return state.publishedAt; },
  get query() { return state.query; },
  touch, persist, publish: publishNow, refreshStats, refreshView: renderView, go,
  storeUrl: () => storeUrl(state.store.slug),
  toast, modal, drawer, confirmDialog, copyText, icon, esc, attr, money, timeAgo, avatarHTML,
  async unpublish() {
    if (!(await confirmDialog({ title: 'إيقاف النشر', text: 'سيتوقف رابط المتجر عن العمل، وتبقى مسودتك وطلباتك محفوظة.', confirm: 'إيقاف النشر', danger: true }))) return;
    try { await api.unpublish(); state.storePublished = false; state.publishedAt = null; toast('تم إيقاف النشر', 'ok'); renderView(); }
    catch (e) { toast(api.errorText(e), 'err'); }
  },
  async openStore() { window.open(storeUrl(state.store.slug), '_blank', 'noopener'); },
  async previewStore() { openPreview(); },
  async logout() { doLogout(); },
  openAccount,
  openHelp,
  openCommand,
  openProductEditor,
  openOrderDrawer,
  openPaymentGuide,
  openCustomerDrawer,
  openImport,
  async deleteStore() {
    if (!(await confirmDialog({ title: 'حذف المتجر نهائيًا', text: 'سيتم حذف المتجر والمنتجات والطلبات والروابط نهائيًا. لا يمكن التراجع. صدّر نسخة احتياطية أولًا.', confirm: 'حذف نهائي', danger: true }))) return;
    const word = await promptText('اكتب كلمة حذف للتأكيد', 'حذف');
    if (word !== 'حذف') { toast('أُلغي الحذف', 'err'); return; }
    try { await api.deleteStore(); state.store = null; state.user = null; await api.signOut(); renderAuth('login'); }
    catch (e) { toast(api.errorText(e), 'err'); }
  }
};

function promptText(title, expected) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; resolve(v); };
    modal({
      title, body: `<div class="field"><label>للتأكيد اكتب: <b>${esc(expected)}</b></label><input class="input" id="confirm-word" autocomplete="off"></div>`,
      foot: `<button class="btn" data-cancel>إلغاء</button><button class="btn danger" data-ok>تأكيد</button>`,
      onMount: (box) => {
        const input = box.querySelector('#confirm-word');
        box.querySelector('[data-cancel]').onclick = () => { finish(''); uiClose(); };
        box.querySelector('[data-ok]').onclick = () => { finish(input.value.trim()); uiClose(); };
      },
      onClose: () => finish('')
    });
  });
}
// late-bound close to avoid importing closeOverlay twice

function openPreview() {
  const url = new URL('public.html', location.href);
  url.searchParams.set('store', state.store.slug);
  url.searchParams.set('preview', '1');
  modal({
    title: 'معاينة المتجر', sub: 'هكذا سيراه الزبون بعد النشر.', wide: true,
    body: `<div class="preview-toolbar"><div class="dots"><i></i><i></i><i></i></div><div class="url">${esc(url.href)}</div><a class="btn sm" href="${attr(url.href)}" target="_blank" rel="noopener">${icon('external', 'sm')} فتح</a></div><iframe class="preview-frame" src="${attr(url.href)}" title="معاينة المتجر"></iframe>`,
    foot: `<button class="btn" data-close>إغلاق</button><button class="btn primary" data-publish>${icon('rocket', 'sm')} نشر الآن</button>`,
    onMount: (box) => { box.querySelector('[data-publish]').onclick = () => { uiClose(); publishNow(); }; }
  });
}

function openHelp() {
  modal({
    title: 'دليل سريع', sub: 'من الصفر إلى أول طلب', wide: true, body: `
      <div class="grid c2" style="gap:14px">
        <div class="card pad"><div class="row" style="margin-bottom:8px"><span class="chip teal">1</span><b>أضف منتجاتك</b></div><p class="small muted" style="margin:0;line-height:1.8">من «المنتجات» أضف منتجًا مدفوعًا مع رابط تسليم (Google Drive، Dropbox…) أو ارفع ملفًا صغيرًا. المنتجات المجانية تدعم رابطًا أو ملفًا.</p></div>
        <div class="card pad"><div class="row" style="margin-bottom:8px"><span class="chip teal">2</span><b>اختر طريقة الدفع</b></div><p class="small muted" style="margin:0;line-height:1.8">من «المدفوعات» أضف تحويلًا بنكيًا أو CashPlus أو PayPal. لتفعيل البطاقات البنكية، اربط YouCan Pay بمفاتيحك.</p></div>
        <div class="card pad"><div class="row" style="margin-bottom:8px"><span class="chip teal">3</span><b>انشر وشارك</b></div><p class="small muted" style="margin:0;line-height:1.8">اضغط «نشر» ثم انسخ رابط المتجر وشاركه على واتساب أو إنستغرام. كل طلب يظهر في «الطلبات».</p></div>
        <div class="card pad"><div class="row" style="margin-bottom:8px"><span class="chip teal">4</span><b>أكّد الدفع وسلّم</b></div><p class="small muted" style="margin:0;line-height:1.8">عند وصول الدفع، افتح الطلب واضغط «تأكيد الدفع». يصبح رابط التحميل متاحًا للزبون فورًا.</p></div>
      </div>
      <div class="callout" style="margin-top:14px">${icon('shield')}<div><b>نصيحة أمان</b><span>لا تشارك المفتاح الخاص لـ YouCan Pay مع أي شخص. يُخزَّن في قاعدة البيانات ولا يظهر في صفحة المتجر.</span></div></div>`,
    foot: `<button class="btn primary" data-close>فهمت</button>`
  });
}

function openCommand() {
  const actions = [
    ['overview', 'نظرة عامة', 'dashboard'], ['products', 'المنتجات', 'box'], ['orders', 'الطلبات', 'receipt'],
    ['customers', 'العملاء', 'users'], ['discounts', 'أكواد الخصم', 'tag'], ['payments', 'المدفوعات', 'wallet'],
    ['design', 'التصميم', 'palette'], ['analytics', 'التحليلات', 'chart'], ['settings', 'الإعدادات', 'settings'], ['store', 'المتجر والنشر', 'globe'],
    ['add-product', 'إضافة منتج جديد', 'plus'], ['publish', 'نشر المتجر', 'rocket'], ['preview', 'معاينة المتجر', 'eye'], ['help', 'دليل الاستخدام', 'help']
  ];
  modal({
    title: 'بحث سريع', sub: 'انتقل إلى أي قسم أو نفّذ إجراءً', body: `<input class="input" id="cmd-input" placeholder="اكتب للبحث…" autocomplete="off"><div class="list-stack" id="cmd-list" style="margin-top:12px"></div>`,
    onMount: (box) => {
      const input = box.querySelector('#cmd-input'), list = box.querySelector('#cmd-list');
      const draw = (q = '') => {
        const f = actions.filter((a) => a[1].includes(q) || a[0].includes(q));
        list.innerHTML = f.map((a) => `<button class="item-card" data-cmd="${a[0]}" style="text-align:start"><span class="ic-tile">${icon(a[2])}</span><span class="body"><b>${esc(a[1])}</b></span>${icon('arrow-left', 'sm')}</button>`).join('') || `<p class="muted small" style="text-align:center;padding:16px">لا نتائج</p>`;
        list.querySelectorAll('[data-cmd]').forEach((b) => b.onclick = () => { uiClose(); runCommand(b.dataset.cmd); });
      };
      input.oninput = () => draw(input.value.trim());
      input.onkeydown = (e) => { if (e.key === 'Enter') { const first = list.querySelector('[data-cmd]'); if (first) { uiClose(); runCommand(first.dataset.cmd); } } };
      draw();
      setTimeout(() => input.focus(), 40);
    }
  });
}
function runCommand(cmd) {
  if (cmd === 'add-product') return openProductEditor();
  if (cmd === 'publish') return publishNow();
  if (cmd === 'preview') return openPreview();
  if (cmd === 'help') return openHelp();
  if (cmd === 'store') return go('store');
  go(cmd);
}

/* ============================== product editor ============================== */
function openProductEditor(id = '') {
  const d = draft();
  const p = id ? d.products.find((x) => x.id === id) : newProduct('paid');
  if (!p) return;
  const isNew = !id;
  const mode = p.mode;
  const body = `
    <div class="field"><label>اسم المنتج</label><input class="input" id="pe-title" value="${attr(p.t)}" placeholder="مثال: دليل التصميم من الصفر" maxlength="120"></div>
    <div class="field"><label>الوصف <span class="hint">اختياري</span></label><textarea class="textarea" id="pe-desc" rows="3" placeholder="ماذا سيحصل عليه الزبون؟">${esc(p.d)}</textarea></div>
    <div class="grid c2" style="gap:12px">
      <div class="field"><label>السعر</label><div class="input-group"><input class="input" id="pe-price" inputmode="decimal" value="${attr(p.pr)}" placeholder="0.00"><span class="prefix">${esc(d.shop.currency)}</span></div></div>
      <div class="field"><label>السعر قبل الخصم <span class="hint">اختياري</span></label><input class="input" id="pe-compare" inputmode="decimal" value="${attr(p.compareAt)}" placeholder="0.00"></div>
    </div>
    <div class="grid c2" style="gap:12px">
      <div class="field"><label>التصنيف <span class="hint">اختياري</span></label><input class="input" id="pe-category" value="${attr(p.category)}" placeholder="كتب، قوالب…"></div>
      <div class="field"><label>شارة <span class="hint">اختياري</span></label><input class="input" id="pe-badge" value="${attr(p.badge)}" placeholder="جديد، الأكثر مبيعًا…"></div>
    </div>
    <div class="field"><label>صور المنتج <span class="hint">حتى 4 صور</span></label>
      <div class="img-grid" id="pe-images">${p.imgs.map((src, i) => `<div class="img-tile"><img src="${attr(src)}" alt=""><button type="button" data-img-rm="${i}" aria-label="حذف">${icon('x', 'sm')}</button>${i === 0 ? '<span class="tag">الرئيسية</span>' : ''}</div>`).join('')}${p.imgs.length < 4 ? `<label class="upload" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px"><input type="file" accept="image/*" id="pe-img-input" hidden>${icon('image')}<b style="font-size:10px">إضافة</b></label>` : ''}</div>
    </div>
    <hr class="divider">
    <div class="field"><label>طريقة التسليم</label>
      <div class="pill-radio" id="pe-modes">
        ${[['paid', 'منتج مدفوع', 'رابط تحميل أو ملف يُسلَّم بعد تأكيد الدفع.'], ['link', 'رابط مجاني', 'يفتح رابطًا خارجيًا مباشرة.'], ['file', 'ملف مجاني', 'تحميل مباشر بدون دفع.'], ['none', 'عرض فقط', 'منتج للعرض بدون زر شراء.']].map(([v, t, s]) => `<label><input type="radio" name="pe-mode" value="${v}" ${mode === v ? 'checked' : ''}><span><b>${t}</b><span>${s}</span></span></label>`).join('')}
      </div>
    </div>
    <div id="pe-mode-fields"></div>
    <div class="field"><label>ملاحظة التسليم <span class="hint">تظهر للزبون</span></label><input class="input" id="pe-note" value="${attr(p.deliveryNote)}" placeholder="مثال: يصلك رابط التحميل بعد تأكيد الدفع"></div>
    <div class="row between" style="margin-top:4px"><div><b class="small">إظهار في المتجر</b><p class="tiny muted" style="margin:2px 0 0">أخفِ المنتج مؤقتًا دون حذفه.</p></div><label class="switch"><input type="checkbox" id="pe-active" ${p.on ? 'checked' : ''}><i></i></label></div>`;
  const m = drawer({
    title: isNew ? 'إضافة منتج' : 'تعديل المنتج', sub: isNew ? 'املأ التفاصيل ثم احفظ.' : esc(p.t || 'منتج'), body, foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" id="pe-save">${icon('check', 'sm')} حفظ المنتج</button>`,
    onMount: (box) => {
      const fields = box.querySelector('#pe-mode-fields');
      const drawMode = () => {
        const v = box.querySelector('input[name=pe-mode]:checked').value;
        if (v === 'paid') {
          p.src = p.src || { type: 'url', url: '', data: '', fn: '' };
          const src = p.src;
          fields.innerHTML = `<div class="field"><label>مصدر التسليم</label><div class="seg" style="margin-bottom:9px"><button type="button" class="${src.type === 'url' ? 'on' : ''}" data-src="url">رابط خارجي</button><button type="button" class="${src.type === 'file' ? 'on' : ''}" data-src="file">ملف مرفوع</button></div>
            <div id="src-url" class="${src.type === 'url' ? '' : 'hidden'}"><input class="input" id="pe-src-url" dir="ltr" value="${attr(src.url)}" placeholder="https://drive.google.com/…"><p class="hint" style="margin-top:5px">يُخفى هذا الرابط عن صفحة المتجر، ويُسلَّم فقط بعد الدفع.</p></div>
            <div id="src-file" class="${src.type === 'file' ? '' : 'hidden'}"><label class="upload"><input type="file" id="pe-src-file" hidden>${icon('upload')}<b>${src.data ? esc(src.fn || 'ملف مرفوع') : 'اختر ملفًا للتسليم'}</b><span>حتى 3 ميغابايت تقريبًا</span></label></div></div>`;
          fields.querySelectorAll('[data-src]').forEach((b) => b.onclick = () => {
            p.src = p.src || { type: 'url', url: '', data: '', fn: '' };
            p.src.type = b.dataset.src; drawMode();
          });
          fields.querySelector('#pe-src-file')?.addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            if (f.size > 3.2 * 1024 * 1024) { toast('الملف كبير. استخدم رابطًا خارجيًا للملفات الكبيرة.', 'err'); return; }
            const data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
            p.src = { type: 'file', data, fn: f.name, url: '' }; drawMode();
          });
        } else if (v === 'link') {
          fields.innerHTML = `<div class="field"><label>الرابط الخارجي</label><input class="input" id="pe-link" dir="ltr" value="${attr(p.link)}" placeholder="https://…"><p class="hint" style="margin-top:5px">يفتح مباشرة عند الضغط على زر المنتج.</p></div>`;
        } else if (v === 'file') {
          fields.innerHTML = `<div class="field"><label>الملف المجاني</label><label class="upload"><input type="file" id="pe-free-file" hidden>${icon('upload')}<b>${p.data ? esc(p.fn || 'ملف مرفوع') : 'اختر ملفًا'}</b><span>سيُتاح للتحميل مباشرة</span></label></div>`;
          fields.querySelector('#pe-free-file')?.addEventListener('change', async (e) => {
            const f = e.target.files[0]; if (!f) return;
            if (f.size > 3.2 * 1024 * 1024) { toast('الملف كبير. استخدم رابطًا خارجيًا.', 'err'); return; }
            p.data = await new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
            p.fn = f.name; drawMode();
          });
        } else fields.innerHTML = `<div class="callout">${icon('info')}<div>سيظهر المنتج في المتجر بدون زر شراء أو تحميل.</div></div>`;
      };
      drawMode();
      box.querySelectorAll('input[name=pe-mode]').forEach((r) => r.onchange = drawMode);
      box.querySelector('#pe-img-input')?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []).slice(0, 4 - p.imgs.length);
        for (const f of files) {
          const { compressImage } = await import('./ui.js');
          const src = await compressImage(f, 1100, 0.82);
          if (src) p.imgs.push(src);
        }
        openProductEditorRefreshImages(box, p);
      });
      box.querySelectorAll('[data-img-rm]').forEach((b) => b.onclick = () => { p.imgs.splice(Number(b.dataset.imgRm), 1); openProductEditorRefreshImages(box, p); });
      box.querySelector('#pe-save').onclick = () => {
        p.t = box.querySelector('#pe-title').value.trim();
        p.d = box.querySelector('#pe-desc').value.trim();
        p.pr = box.querySelector('#pe-price').value.trim();
        p.compareAt = box.querySelector('#pe-compare').value.trim();
        p.category = box.querySelector('#pe-category').value.trim();
        p.badge = box.querySelector('#pe-badge').value.trim();
        p.deliveryNote = box.querySelector('#pe-note').value.trim();
        p.on = box.querySelector('#pe-active').checked ? 1 : 0;
        p.mode = box.querySelector('input[name=pe-mode]:checked').value;
        if (p.mode === 'link') p.link = box.querySelector('#pe-link')?.value.trim() || p.link;
        if (p.mode === 'paid' && p.src?.type === 'url') p.src.url = box.querySelector('#pe-src-url')?.value.trim() || p.src.url;
        if (!p.t) { toast('اكتب اسم المنتج', 'err'); return; }
        if (p.mode === 'paid') {
          if (!p.pr || Number(String(p.pr).replace(',', '.')) <= 0) { toast('حدّد سعرًا للمنتج المدفوع', 'err'); return; }
          if (!p.src || (p.src.type === 'url' ? !p.src.url : !p.src.data)) { toast('أضف رابط تسليم أو ملفًا للمنتج المدفوع', 'err'); return; }
          if (p.src.type === 'url' && !/^https:\/\//i.test(p.src.url)) { toast('رابط التسليم يجب أن يبدأ بـ https://', 'err'); return; }
        }
        if (p.mode === 'link' && !/^https:\/\//i.test(p.link || '')) { toast('أضف رابطًا صحيحًا يبدأ بـ https://', 'err'); return; }
        if (p.mode === 'file' && !p.data) { toast('ارفع الملف المجاني أولًا', 'err'); return; }
        if (isNew) d.products.unshift(p);
        touch(); uiClose(); renderView(); toast(isNew ? 'أُضيف المنتج' : 'تم حفظ المنتج', 'ok');
      };
    }
  });
  return m;
}
function openProductEditorRefreshImages(box, p) {
  const wrap = box.querySelector('#pe-images');
  if (!wrap) return;
  wrap.innerHTML = `${p.imgs.map((src, i) => `<div class="img-tile"><img src="${attr(src)}" alt=""><button type="button" data-img-rm="${i}">${icon('x', 'sm')}</button>${i === 0 ? '<span class="tag">الرئيسية</span>' : ''}</div>`).join('')}${p.imgs.length < 4 ? `<label class="upload" style="aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:8px"><input type="file" accept="image/*" id="pe-img-input2" hidden>${icon('image')}<b style="font-size:10px">إضافة</b></label>` : ''}`;
  wrap.querySelectorAll('[data-img-rm]').forEach((b) => b.onclick = () => { p.imgs.splice(Number(b.dataset.imgRm), 1); openProductEditorRefreshImages(box, p); });
  wrap.querySelector('#pe-img-input2')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []).slice(0, 4 - p.imgs.length);
    for (const f of files) { const { compressImage } = await import('./ui.js'); const src = await compressImage(f, 1100, 0.82); if (src) p.imgs.push(src); }
    openProductEditorRefreshImages(box, p);
  });
}

/* ============================== product preview ============================== */
function openProductPreview(id) {
  const p = draft().products.find((x) => x.id === id); if (!p) return;
  modal({
    title: p.t || 'منتج', sub: 'معاينة كما تظهر في المتجر', wide: true,
    body: `<div class="grid c2" style="gap:18px"><div style="border-radius:16px;overflow:hidden;background:var(--line-2);min-height:240px">${p.imgs?.[0] ? `<img src="${attr(p.imgs[0])}" alt="" style="width:100%;height:100%;object-fit:cover">` : `<div style="display:grid;place-items:center;height:100%;color:var(--muted)">${icon('image', 'lg')}</div>`}</div><div><div class="row" style="gap:6px;margin-bottom:8px">${modeChip(p)}${p.category ? `<span class="chip">${esc(p.category)}</span>` : ''}</div><h3 style="margin:0 0 7px;font-size:22px">${esc(p.t || 'بدون عنوان')}</h3><p class="small muted" style="white-space:pre-line;line-height:1.8">${esc(p.d || 'لا يوجد وصف.')}</p><div style="font-size:24px;font-weight:900;margin:12px 0">${price(p, draft())}</div>${p.deliveryNote ? `<div class="callout">${icon('info')}<div>${esc(p.deliveryNote)}</div></div>` : ''}<div class="row" style="margin-top:14px"><button class="btn primary" data-act="edit-product" data-id="${attr(p.id)}">${icon('edit', 'sm')} تعديل</button><button class="btn" data-close>إغلاق</button></div></div></div>`
  });
}

/* ============================== order drawer ============================== */
async function openOrderDrawer(id) {
  const d = drawer({ title: 'تفاصيل الطلب', sub: 'جارٍ التحميل…', body: spinner(), foot: '' });
  try {
    const [o, events] = await Promise.all([api.getOrder(id), api.orderEvents(id).catch(() => [])]);
    const d0 = draft();
    const canPay = o.status === 'pending';
    const canCancel = ['pending'].includes(o.status);
    const canRefund = ['paid', 'delivered'].includes(o.status);
    const payMethod = [...(d0.pay || []), { id: 'youcanpay', t: 'YouCan Pay' }].find((m) => m.id === o.payment_method) || { t: o.payment_method || '—' };
    const link = api.checkoutUrl(state.store.slug, o.order_no, o.access_token);
    d.box.querySelector('.drawer-head').innerHTML = `<div style="flex:1"><h3>${esc(o.order_no)}</h3><p>${esc(fmt(o.created_at))} · ${esc(o.buyer_name)}</p></div><button class="close-x" data-close>${icon('x')}</button>`;
    d.box.querySelector('.drawer-body').innerHTML = `
      <div class="order-hero"><div class="row between"><div><div class="num">${esc(o.order_no)}</div><div class="total">${money(o.total_minor, o.currency)}</div></div>${statusChipHtml(o.status)}</div>
        <div class="row" style="margin-top:12px;flex-wrap:wrap"><button class="btn sm" data-order-paid ${canPay ? '' : 'disabled'}>${icon('check', 'sm')} تأكيد الدفع</button><button class="btn sm" data-order-cancel ${canCancel ? '' : 'disabled'}>${icon('ban', 'sm')} إلغاء</button><button class="btn sm danger" data-order-refund ${canRefund ? '' : 'disabled'}>${icon('undo', 'sm')} استرجاع</button>${o.receipt_path ? `<button class="btn sm" data-receipt>${icon('receipt', 'sm')} عرض الإيصال</button>` : ''}</div></div>
      <div class="grid c2" style="gap:14px">
        <div class="card pad"><h3 style="margin:0 0 9px;font-size:13px">الزبون</h3><dl class="kv"><dt>الاسم</dt><dd>${esc(o.buyer_name)}</dd><dt>البريد</dt><dd style="direction:ltr;text-align:start">${esc(o.buyer_email)}</dd><dt>الهاتف</dt><dd style="direction:ltr;text-align:start">${esc(o.buyer_phone || '—')}</dd><dt>طريقة الدفع</dt><dd>${esc(payMethod.t || o.payment_method)}</dd><dt>المرجع</dt><dd style="direction:ltr;text-align:start">${esc(o.payment_ref || '—')}</dd></dl></div>
        <div class="card pad"><h3 style="margin:0 0 9px;font-size:13px">الطلب</h3><dl class="kv"><dt>التاريخ</dt><dd>${esc(fmt(o.created_at))}</dd><dt>الدفع</dt><dd>${o.paid_at ? esc(fmt(o.paid_at)) : '—'}</dd><dt>التسليم</dt><dd>${o.delivered_at ? esc(fmt(o.delivered_at)) : '—'}</dd><dt>الخصم</dt><dd>${o.discount_minor ? money(o.discount_minor, o.currency) + (o.coupon ? ` (${esc(o.coupon)})` : '') : '—'}</dd></dl></div>
      </div>
      <h3 style="font-size:13px;margin:20px 0 8px">المنتجات</h3>
      <div class="line-items">${(o.items || []).map((i) => `<div class="line-item"><div><b>${esc(i.title || i.id)}</b><div class="q">${i.qty} × ${money(i.price_minor, o.currency)}</div></div><span class="amt">${money(Number(i.price_minor) * Number(i.qty), o.currency)}</span></div>`).join('')}</div>
      <div class="totals"><div class="t-row"><span>المجموع</span><b>${money(o.subtotal_minor, o.currency)}</b></div>${o.discount_minor ? `<div class="t-row"><span>الخصم</span><b style="color:#047857">− ${money(o.discount_minor, o.currency)}</b></div>` : ''}<div class="t-row grand"><span>الإجمالي</span><span>${money(o.total_minor, o.currency)}</span></div></div>
      <h3 style="font-size:13px;margin:20px 0 8px">ملاحظات داخلية</h3>
      <textarea class="textarea" id="order-note" rows="2" placeholder="ملاحظة تظهر لك فقط…">${esc(o.notes || '')}</textarea>
      <button class="btn sm" style="margin-top:7px" data-order-note>${icon('save', 'sm')} حفظ الملاحظة</button>
      <h3 style="font-size:13px;margin:20px 0 8px">سجل الطلب</h3>
      <div class="timeline">${events.length ? events.map((ev) => `<div class="tl-item"><b>${esc(eventLabel(ev.type))}</b><span>${esc(fmt(ev.created_at))}</span></div>`).join('') : '<p class="muted small">لا توجد أحداث بعد.</p>'}</div>
      <div class="callout" style="margin-top:18px">${icon('link')}<div><b>رابط متابعة الطلب للزبون</b><span style="word-break:break-all;direction:ltr;display:block;text-align:left;margin-top:3px">${esc(link)}</span><button class="btn sm" style="margin-top:7px" data-copy-order>${icon('copy', 'sm')} نسخ الرابط</button></div></div>`;
    d.box.querySelectorAll('[data-close]').forEach((b) => b.onclick = () => uiClose());
    d.box.querySelector('[data-copy-order]').onclick = () => copyText(link);
    d.box.querySelector('[data-order-paid]')?.addEventListener('click', async () => { try { await api.markPaid(o.id); toast('تم تأكيد الدفع وتسليم الطلب', 'ok'); uiClose(); renderView(); refreshStats(); } catch (e) { toast(api.errorText(e), 'err'); } });
    d.box.querySelector('[data-order-cancel]')?.addEventListener('click', async () => { if (!(await confirmDialog({ title: 'إلغاء الطلب', text: 'سيُغلق الطلب ولن يستطيع الزبون الدفع.', confirm: 'إلغاء الطلب', danger: true }))) return; try { await api.cancelOrder(o.id); toast('أُلغي الطلب', 'ok'); uiClose(); renderView(); refreshStats(); } catch (e) { toast(api.errorText(e), 'err'); } });
    d.box.querySelector('[data-order-refund]')?.addEventListener('click', async () => { if (!(await confirmDialog({ title: 'استرجاع الطلب', text: 'سيُعلَّم الطلب كمسترجع ويتوقف الوصول إلى التحميل.', confirm: 'استرجاع', danger: true }))) return; try { await api.refundOrder(o.id); toast('تم الاسترجاع', 'ok'); uiClose(); renderView(); refreshStats(); } catch (e) { toast(api.errorText(e), 'err'); } });
    d.box.querySelector('[data-order-note]')?.addEventListener('click', async () => { try { await api.noteOrder(o.id, d.box.querySelector('#order-note').value); toast('حُفظت الملاحظة', 'ok'); } catch (e) { toast(api.errorText(e), 'err'); } });
    d.box.querySelector('[data-receipt]')?.addEventListener('click', async (ev) => {
      const button = ev.currentTarget;
      button.disabled = true;
      try {
        const url = await api.receiptUrl(o.receipt_path);
        if (!url) throw new Error('missing receipt');
        window.open(url, '_blank', 'noopener');
      } catch (e) { toast(api.errorText(e), 'err'); }
      button.disabled = false;
    });
  } catch (e) {
    d.box.querySelector('.drawer-body').innerHTML = `<div class="callout rose">${icon('alert')}<div>${esc(api.errorText(e))}</div></div>`;
  }
}

function statusChipHtml(s) {
  const map = { pending: ['amber', 'بانتظار الدفع'], paid: ['teal', 'مدفوع'], delivered: ['green', 'تم التسليم'], cancelled: ['rose', 'ملغى'], refunded: ['rose', 'مسترجع'], failed: ['rose', 'فشل'] };
  const [c, t] = map[s] || ['amber', s];
  return `<span class="chip ${c}"><span class="dot"></span>${t}</span>`;
}
function eventLabel(t) {
  return ({ created: 'أُنشئ الطلب', marked_paid: 'تأكيد الدفع يدويًا', buyer_claimed_paid: 'الزبون أبلغ عن الدفع', refunded: 'استرجاع', cancelled: 'إلغاء', payment_confirmed: 'تأكيد دفع تلقائي' }[t] || t);
}
function fmt(iso) { return new Intl.DateTimeFormat('ar-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)); }

/* ============================== payments guide ============================== */
function openPaymentGuide() {
  modal({
    title: 'ربط YouCan Pay', sub: 'بطاقات بنكية وCashPlus بدون رسوم إعداد', wide: true, body: `
      <div class="stack">
        <div class="callout">${icon('info')}<div><b>ما تحتاجه</b><span>حساب تاجر في YouCan Pay، ثم المفتاح العام والخاص من لوحة التحكم.</span></div></div>
        <ol style="margin:0;padding-inline-start:20px;font-size:13px;line-height:2;color:var(--ink-2)">
          <li>سجّل في <a href="https://youcanpay.com" target="_blank" rel="noopener" style="color:var(--accent-ink);font-weight:800">youcanpay.com</a> وأكمل بيانات التاجر.</li>
          <li>من لوحة YouCan Pay، انسخ <b>Public Key</b> و<b>Private Key</b> (تبدأ بـ pub_ و pri_).</li>
          <li>ألصقهما في بطاقة «YouCan Pay» وفعّل الاتصال. استخدم مفاتيح sandbox أثناء التجربة.</li>
          <li>انشر Edge Function <code class="kbd">youcanpay-tokenize</code> و<code class="kbd">youcanpay-webhook</code> من مجلد <code class="kbd">supabase/functions</code>.</li>
          <li>أضف رابط الـ webhook في لوحة YouCan Pay: <code class="kbd">https://&lt;project&gt;.supabase.co/functions/v1/youcanpay-webhook</code>.</li>
        </ol>
        <div class="callout warn">${icon('alert')}<div><b>بدون Edge Functions؟</b><span>يمكنك البيع فورًا عبر الطرق اليدوية: تحويل بنكي، CashPlus، PayPal أو رابط دفع مخصص. أكّد الدفع يدويًا من صفحة الطلبات.</span></div></div>
      </div>`,
    foot: `<button class="btn primary" data-close>حسنًا</button>`
  });
}

/* ============================== import / export ============================== */
function openImport() {
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files[0]; if (!f) return;
    try {
      const raw = JSON.parse(await f.text());
      const d = normalizeDraft(raw.draft || raw);
      if (!(await confirmDialog({ title: 'استيراد المسودة', text: 'سيستبدل هذا المحتوى الحالي للمتجر. صدّر نسخة احتياطية أولًا.', confirm: 'استيراد' }))) return;
      state.store.draft = d;
      touch(); await persist({ force: true }); renderView(); toast('تم الاستيراد', 'ok');
    } catch (e) { toast('ملف غير صالح', 'err'); }
  };
  input.click();
}

/* ============================== global events ============================== */
document.addEventListener('click', async (e) => {
  const nav = e.target.closest('[data-nav]');
  if (nav) { e.preventDefault(); go(nav.dataset.nav); return; }
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.closest('#user-menu')) closeUserMenu();
  const act = btn.dataset.act;
  if (act === 'menu') return toggleSidebar();
  if (act === 'menu-close') return closeSidebar();
  if (act === 'command') return openCommand();
  if (act === 'publish') return publishNow(btn);
  if (act === 'open-store') { if (btn.tagName !== 'A') ctx.openStore(); return; }
  if (act === 'settings') return go('settings');
  if (act === 'account') return openAccount();
  if (act === 'help') return openHelp();
  if (act === 'logout') return doLogout();
  if (act === 'refresh') return renderView();
  if (act === 'copy-store') return copyText(storeUrl(state.store.slug));
  if (act === 'preview') return openPreview();
  if (act === 'unpublish') return ctx.unpublish();
  if (act === 'export') { downloadText(JSON.stringify({ slug: state.store.slug, draft: state.store.draft, revision: state.store.revision, exportedAt: new Date().toISOString() }, null, 2), `rabiti-${state.store.slug}-${new Date().toISOString().slice(0, 10)}.json`); toast('تم التصدير', 'ok'); return; }
  if (act === 'import') return openImport();
  if (act === 'delete-store') return ctx.deleteStore();
  if (act === 'payment-guide') return openPaymentGuide();
  if (act === 'add-product') return openProductEditor();
  if (act === 'add-link') return openLinkEditor();
  if (act === 'add-payment') return openPaymentEditor();
  if (act === 'add-discount') return openDiscountEditor();
  if (act === 'edit-product') return openProductEditor(btn.dataset.id);
  if (act === 'order-open') return openOrderDrawer(btn.dataset.id);
  if (act === 'customer-open') return openCustomerDrawer(btn.dataset.email);
  if (act === 'payment-status-refresh') return renderView();
  if (act === 'go') return go(btn.dataset.view || 'overview');
  if (act === 'link-move') {
    const list = draft().links; const i = list.findIndex((x) => x.id === btn.dataset.id);
    const j = i + Number(btn.dataset.dir); if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]]; touch(); renderView(); return;
  }
  if (act === 'del-link') {
    if (!(await confirmDialog({ title: 'حذف الرابط', text: 'سيُحذف الرابط من صفحتك.', confirm: 'حذف', danger: true }))) return;
    const list = draft().links; const i = list.findIndex((x) => x.id === btn.dataset.id);
    if (i >= 0) { list.splice(i, 1); touch(); renderView(); } return;
  }
  if (act === 'edit-link') return openLinkEditor(btn.dataset.id);
  if (act === 'products-search') { const q = $('#products-q')?.value.trim() || ''; go('products', q ? { q } : {}); return; }
  if (act === 'product-preview') return openProductPreview(btn.dataset.id);
  if (act === 'dup-product') {
    const p = draft().products.find((x) => x.id === btn.dataset.id); if (!p) return;
    const copy = JSON.parse(JSON.stringify(p)); copy.id = uid('prd_'); copy.t = (copy.t || 'منتج') + ' (نسخة)'; copy.on = 0;
    draft().products.unshift(copy); touch(); renderView(); toast('تم نسخ المنتج', 'ok'); return;
  }
  if (act === 'del-product') {
    if (!(await confirmDialog({ title: 'حذف المنتج', text: 'سيُحذف المنتج من المسودة. الطلبات السابقة تبقى محفوظة.', confirm: 'حذف', danger: true }))) return;
    const list = draft().products; const i = list.findIndex((x) => x.id === btn.dataset.id);
    if (i >= 0) { list.splice(i, 1); touch(); renderView(); } return;
  }
  if (act === 'orders-apply') {
    const q = $('#orders-q')?.value.trim() || ''; const status = $('#orders-status')?.value || '';
    go('orders', { ...(status ? { status } : {}), ...(q ? { q } : {}) }); return;
  }
  if (act === 'export-orders') {
    try {
      const { rows } = await api.listOrders({ limit: 1000 });
      const data = [['order_no', 'created_at', 'buyer_name', 'buyer_email', 'buyer_phone', 'items', 'subtotal', 'discount', 'total', 'currency', 'status', 'payment_method', 'coupon']];
      rows.forEach((o) => data.push([o.order_no, o.created_at, o.buyer_name, o.buyer_email, o.buyer_phone, (o.items || []).map((i) => `${i.title} x${i.qty}`).join(' | '), (o.subtotal_minor / 100).toFixed(2), (o.discount_minor / 100).toFixed(2), (o.total_minor / 100).toFixed(2), o.currency, o.status, o.payment_method, o.coupon]));
      downloadCsv(`rabiti-orders-${new Date().toISOString().slice(0, 10)}.csv`, data); toast('تم التصدير', 'ok');
    } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'customers-search') { const q = $('#customers-q')?.value.trim() || ''; go('customers', q ? { q } : {}); return; }
  if (act === 'export-customers') {
    try {
      const rows = await api.customers({ limit: 1000 });
      const data = [['name', 'email', 'phone', 'orders', 'paid_orders', 'total', 'currency', 'last_order']];
      rows.forEach((c) => data.push([c.name, c.email, c.phone, c.orders, c.paid_orders, (c.total_minor / 100).toFixed(2), c.currency, c.last]));
      downloadCsv(`rabiti-customers-${new Date().toISOString().slice(0, 10)}.csv`, data); toast('تم التصدير', 'ok');
    } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'edit-discount') return openDiscountEditor(btn.dataset.id);
  if (act === 'del-discount') {
    if (!(await confirmDialog({ title: 'حذف الكود', text: 'لن يعمل الكود في الطلبات الجديدة.', confirm: 'حذف', danger: true }))) return;
    try { await api.deleteDiscount(btn.dataset.id); renderView(); toast('حُذف الكود', 'ok'); } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'edit-payment') return openPaymentEditor(btn.dataset.id);
  if (act === 'del-payment') {
    if (!(await confirmDialog({ title: 'حذف طريقة الدفع', text: 'لن تظهر للزبائن في صفحة الدفع.', confirm: 'حذف', danger: true }))) return;
    const list = draft().pay; const i = list.findIndex((x) => x.id === btn.dataset.id);
    if (i >= 0) { list.splice(i, 1); touch(); renderView(); } return;
  }
  if (act === 'save-ycp') {
    const pub = $('#ycp-pub').value.trim(), priv = $('#ycp-priv').value.trim();
    const sandbox = $('#ycp-sandbox').checked, enabled = $('#ycp-enabled').checked;
    try {
      const res = await api.setYoucanpay(pub, priv, sandbox, enabled);
      draft().checkout.youcanpay = { enabled: !!res.enabled, publicKey: res.publicKey || '', sandbox: !!res.sandbox };
      touch(); await persist({ force: true }); renderView(); toast('تم حفظ اتصال YouCan Pay', 'ok');
    } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'clear-ycp') {
    if (!(await confirmDialog({ title: 'حذف مفاتيح YouCan Pay', text: 'سيتوقف الدفع بالبطاقة حتى تعيد الربط.', confirm: 'حذف', danger: true }))) return;
    try { await api.clearYoucanpay(); draft().checkout.youcanpay = { enabled: false, publicKey: '', sandbox: false }; touch(); await persist({ force: true }); renderView(); toast('حُذفت المفاتيح', 'ok'); } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'theme') {
    const themes = (await import('./api.js')).DESIGN_THEMES;
    const prev = themes.find((x) => x.id === draft().design.theme);
    const next = themes.find((x) => x.id === btn.dataset.theme);
    draft().design.theme = btn.dataset.theme;
    if (next && (!draft().design.accent || draft().design.accent === prev?.accent)) draft().design.accent = next.accent;
    touch(); renderView(); return;
  }
  if (act === 'design-set') { setPath(draft(), 'design.' + btn.dataset.key, btn.dataset.value); touch(); renderView(); return; }
  if (act === 'accent-reset') { draft().design.accent = ''; touch(); renderView(); return; }
  if (act === 'remove-avatar') { draft().profile.avatar = ''; touch(); renderView(); return; }
  if (act === 'share-native') {
    const url = storeUrl(state.store.slug);
    if (navigator.share) { try { await navigator.share({ title: draft().profile.name || 'متجري', text: 'تفضل بزيارة متجري', url }); } catch { /* cancelled */ } }
    else copyText(url);
    return;
  }
  if (act === 'refresh-preview') {
    const f = $('#store-preview'); if (f) { const u = new URL(f.src); u.searchParams.set('t', Date.now()); f.src = u.href; }
    return;
  }
  if (act === 'check-slug') {
    const v = $('#slug-input').value.trim(); const hint = $('#slug-hint');
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(v)) { hint.textContent = 'الرابط غير صالح.'; hint.style.color = '#be123c'; return; }
    try { const ok = await api.slugAvailable(v); hint.textContent = ok || v === state.store.slug ? 'الرابط متاح ✓' : 'هذا الرابط محجوز.'; hint.style.color = ok || v === state.store.slug ? '#047857' : '#be123c'; }
    catch (e) { hint.textContent = api.errorText(e); hint.style.color = '#be123c'; } return;
  }
  if (act === 'save-slug') {
    const v = $('#slug-input').value.trim();
    if (!/^[a-z0-9][a-z0-9-]{2,39}$/.test(v)) return toast('الرابط غير صالح', 'err');
    if (v === state.store.slug) return toast('هذا رابطك الحالي', 'ok');
    if (!(await confirmDialog({ title: 'تغيير رابط المتجر', text: 'سيتغير الرابط العام. الطلبات القديمة تبقى، لكن الروابط المنشورة سابقًا ستتوقف.', confirm: 'تغيير الرابط' }))) return;
    try { const s = await api.changeSlug(v); state.store.slug = s; await persist({ force: true }); renderView(); toast('تم تغيير الرابط', 'ok'); }
    catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'reset-password') {
    try { await api.resetPassword(state.user.email); toast('أرسلنا رابط تغيير كلمة المرور', 'ok'); } catch (e) { toast(api.errorText(e), 'err'); } return;
  }
  if (act === 'export-analytics') {
    const daily = state.stats?.daily || [];
    const rows = [['day', 'views', 'orders', 'revenue']];
    daily.forEach((x) => rows.push([x.day, x.views, x.orders, (Number(x.revenue_minor || 0) / 100).toFixed(2)]));
    downloadCsv(`rabiti-analytics-${new Date().toISOString().slice(0, 10)}.csv`, rows); toast('تم التصدير', 'ok'); return;
  }
  const handlers = window.__rabitiActions || {};
  if (handlers[act]) return handlers[act](btn, e);
});

document.addEventListener('input', (e) => {
  const f = e.target.closest('[data-field]');
  if (!f || !draft()) return;
  setPath(draft(), f.dataset.field, f.type === 'number' ? Number(f.value) : f.value);
  touch();
});
document.addEventListener('change', (e) => {
  const f = e.target.closest('[data-field]');
  if (f && draft()) { setPath(draft(), f.dataset.field, f.type === 'number' ? Number(f.value) : f.value); touch(); }
  const c = e.target.closest('[data-check]');
  if (c && draft()) { setPath(draft(), c.dataset.check, c.checked); touch(); }
  const t = e.target.closest('[data-toggle-kind]');
  if (t && draft()) {
    const [kind, id] = t.dataset.toggleKind.split(':');
    const list = kind === 'link' ? draft().links : kind === 'product' ? draft().products : draft().pay;
    const item = list.find((x) => x.id === id); if (item) { item.on = t.checked ? 1 : 0; touch(); renderView(); }
  }
  const disc = e.target.closest('[data-discount-toggle]');
  if (disc) {
    api.updateDiscount(disc.dataset.discountToggle, { active: disc.checked })
      .then(() => toast(disc.checked ? 'فُعّل الكود' : 'أُوقف الكود', 'ok'))
      .catch((err) => { toast(api.errorText(err), 'err'); disc.checked = !disc.checked; });
  }
  if (e.target.id === 'avatar-input' && e.target.files?.[0]) {
    import('./ui.js').then(async ({ compressImage }) => {
      const src = await compressImage(e.target.files[0], 500, 0.86);
      if (src && draft()) { draft().profile.avatar = src; touch(); renderView(); toast('تم تحديث الصورة', 'ok'); }
    });
  }
});
function setPath(obj, path, value) {
  const parts = path.split('.'); let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (!o[parts[i]] || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
  o[parts[parts.length - 1]] = value;
}

/* link editor + payment editor + discount editor + customer drawer are defined in views? Keep here. */
function openLinkEditor(id = '') {
  const d = draft();
  const l = id ? d.links.find((x) => x.id === id) : newLink();
  if (!l) return;
  const isNew = !id;
  modal({
    title: isNew ? 'إضافة رابط' : 'تعديل الرابط', body: `
      <div class="field"><label>العنوان</label><input class="input" id="le-title" value="${attr(l.t)}" placeholder="مثال: حسابي على إنستغرام" maxlength="90"></div>
      <div class="field"><label>الرابط</label><input class="input" id="le-url" dir="ltr" value="${attr(l.u)}" placeholder="https://…" required></div>
      <div class="field"><label>الأيقونة</label><select class="select" id="le-icon">${[['website', 'موقع / رابط'], ['instagram', 'إنستغرام'], ['whatsapp', 'واتساب'], ['telegram', 'تيليجرام'], ['facebook', 'فيسبوك'], ['tiktok', 'تيك توك'], ['youtube', 'يوتيوب'], ['email', 'بريد إلكتروني'], ['phone', 'هاتف'], ['store', 'متجر']].map(([v, t]) => `<option value="${v}" ${l.icon === v || (!l.icon && v === 'website') ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="row between"><b class="small">إظهار الرابط</b><label class="switch"><input type="checkbox" id="le-on" ${l.on ? 'checked' : ''}><i></i></label></div>`,
    foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" id="le-save">حفظ</button>`,
    onMount: (box) => {
      box.querySelector('#le-save').onclick = () => {
        const u = box.querySelector('#le-url').value.trim();
        if (!box.querySelector('#le-title').value.trim()) return toast('اكتب عنوان الرابط', 'err');
        if (!/^https:\/\/|^mailto:|^tel:/i.test(u)) return toast('الرابط يجب أن يبدأ بـ https:// أو mailto: أو tel:', 'err');
        l.t = box.querySelector('#le-title').value.trim(); l.u = u; l.icon = box.querySelector('#le-icon').value; l.on = box.querySelector('#le-on').checked ? 1 : 0;
        if (isNew) d.links.push(l);
        touch(); uiClose(); renderView(); toast(isNew ? 'أُضيف الرابط' : 'تم الحفظ', 'ok');
      };
    }
  });
}

function openPaymentEditor(id = '') {
  const d = draft();
  const p = id ? d.pay.find((x) => x.id === id) : newPayMethod();
  if (!p) return;
  const isNew = !id;
  const kinds = [['bank', 'تحويل بنكي', 'أدخل تفاصيل الحساب البنكي (RIB).'], ['cashplus', 'CashPlus', 'رقم الهاتف أو الاسم لتحويل CashPlus.'], ['paypal', 'PayPal', 'بريد PayPal أو رابط الدفع.'], ['custom', 'طريقة أخرى', 'أي طريقة دفع أخرى مع تعليمات.']];
  modal({
    title: isNew ? 'إضافة طريقة دفع' : 'تعديل طريقة الدفع', sub: 'تظهر هذه التعليمات للزبون بعد إنشاء الطلب.', body: `
      <div class="field"><label>النوع</label><div class="pill-radio" id="pm-kinds">${kinds.map(([v, t, s]) => `<label><input type="radio" name="pm-kind" value="${v}" ${p.kind === v ? 'checked' : ''}><span><b>${t}</b><span>${s}</span></span></label>`).join('')}</div></div>
      <div class="field"><label>الاسم الظاهر</label><input class="input" id="pm-title" value="${attr(p.t)}" placeholder="تحويل بنكي — التجاري وفا بنك"></div>
      <div class="field"><label>التعليمات</label><textarea class="textarea" id="pm-details" rows="4" placeholder="اسم صاحب الحساب، RIB، رقم الهاتف…">${esc(p.d)}</textarea><p class="hint" style="margin-top:5px">تظهر للزبون في صفحة الدفع ومتابعة الطلب.</p></div>
      <div class="field"><label>رابط الدفع <span class="hint">اختياري</span></label><input class="input" id="pm-url" dir="ltr" value="${attr(p.u)}" placeholder="https://…"></div>
      <div class="row between"><b class="small">إظهار في صفحة الدفع</b><label class="switch"><input type="checkbox" id="pm-on" ${p.on ? 'checked' : ''}><i></i></label></div>`,
    foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" id="pm-save">حفظ</button>`,
    onMount: (box) => {
      box.querySelector('#pm-save').onclick = () => {
        p.kind = box.querySelector('input[name=pm-kind]:checked').value;
        p.t = box.querySelector('#pm-title').value.trim() || kinds.find((k) => k[0] === p.kind)[1];
        p.d = box.querySelector('#pm-details').value.trim();
        p.u = box.querySelector('#pm-url').value.trim();
        p.on = box.querySelector('#pm-on').checked ? 1 : 0;
        if (p.u && !/^https:\/\//i.test(p.u)) return toast('رابط الدفع يجب أن يبدأ بـ https://', 'err');
        if (isNew) d.pay.push(p);
        touch(); uiClose(); renderView(); toast(isNew ? 'أُضيفت طريقة الدفع' : 'تم الحفظ', 'ok');
      };
    }
  });
}

function openDiscountEditor(id = '') {
  const d = draft();
  const isNew = !id;
  const x = isNew ? { code: '', kind: 'percent', value: 10, min_subtotal: 0, max_uses: 0, starts_at: '', expires_at: '', active: true } : (state.discounts || []).find((v) => v.id === id);
  if (!x) return;
  modal({
    title: isNew ? 'كود خصم جديد' : 'تعديل الكود', sub: 'يعمل على الطلبات الجديدة فقط.', body: `
      <div class="field"><label>الكود</label><input class="input" id="dc-code" dir="ltr" value="${attr(x.code)}" placeholder="WELCOME10" maxlength="24"></div>
      <div class="field"><label>نوع الخصم</label><div class="seg" id="dc-kind"><button type="button" data-k="percent" class="${x.kind === 'percent' ? 'on' : ''}">نسبة %</button><button type="button" data-k="fixed" class="${x.kind === 'fixed' ? 'on' : ''}">مبلغ ثابت</button></div></div>
      <div class="field"><label>القيمة</label><div class="input-group"><input class="input" id="dc-value" type="number" min="1" step="0.01" value="${attr(x.kind === 'fixed' ? Number(x.value || 0) / 100 : x.value)}"><span class="prefix" id="dc-unit">${x.kind === 'percent' ? '%' : d.shop.currency}</span></div></div>
      <div class="grid c2" style="gap:12px"><div class="field"><label>حد أدنى للطلب</label><input class="input" id="dc-min" type="number" min="0" value="${Number(x.min_subtotal || 0) / 100}" placeholder="0"></div><div class="field"><label>أقصى استخدامات <span class="hint">0 = بلا حد</span></label><input class="input" id="dc-max" type="number" min="0" value="${attr(x.max_uses || 0)}"></div></div>
      <div class="grid c2" style="gap:12px"><div class="field"><label>يبدأ في <span class="hint">اختياري</span></label><input class="input" id="dc-start" type="date" value="${attr((x.starts_at || '').slice(0, 10))}"></div><div class="field"><label>ينتهي في <span class="hint">اختياري</span></label><input class="input" id="dc-end" type="date" value="${attr((x.expires_at || '').slice(0, 10))}"></div></div>
      <div class="row between"><b class="small">الكود مفعّل</b><label class="switch"><input type="checkbox" id="dc-active" ${x.active ? 'checked' : ''}><i></i></label></div>`,
    foot: `<button class="btn" data-close>إلغاء</button><button class="btn primary" id="dc-save">حفظ الكود</button>`,
    onMount: (box) => {
      let kind = x.kind;
      box.querySelectorAll('#dc-kind button').forEach((b) => b.onclick = () => {
        if (kind === b.dataset.k) return;
        kind = b.dataset.k; box.querySelectorAll('#dc-kind button').forEach((z) => z.classList.toggle('on', z === b));
        box.querySelector('#dc-unit').textContent = kind === 'percent' ? '%' : d.shop.currency;
        const valueInput = box.querySelector('#dc-value');
        const current = Number(valueInput.value || 0);
        if (kind === 'percent' && current > 100) valueInput.value = '100';
        if (kind === 'fixed' && current < 1) valueInput.value = '10';
      });
      box.querySelector('#dc-save').onclick = async () => {
        const code = box.querySelector('#dc-code').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const value = Number(box.querySelector('#dc-value').value);
        if (!code) return toast('اكتب كود الخصم', 'err');
        if (!(value > 0)) return toast('القيمة غير صالحة', 'err');
        if (kind === 'percent' && value > 100) return toast('النسبة لا تتجاوز 100%', 'err');
        const payload = {
          store_slug: state.store.slug, code, kind, value: kind === 'percent' ? Math.round(value) : Math.round(value * 100),
          min_subtotal: Math.round(Number(box.querySelector('#dc-min').value || 0) * 100),
          max_uses: Math.max(0, Number(box.querySelector('#dc-max').value || 0)),
          starts_at: box.querySelector('#dc-start').value ? new Date(box.querySelector('#dc-start').value).toISOString() : null,
          expires_at: box.querySelector('#dc-end').value ? new Date(box.querySelector('#dc-end').value + 'T23:59:59').toISOString() : null,
          active: box.querySelector('#dc-active').checked
        };
        try {
          if (isNew) await api.createDiscount(payload); else await api.updateDiscount(x.id, payload);
          uiClose(); renderView(); toast('حُفظ الكود', 'ok');
        } catch (e) { toast(api.errorText(e), 'err'); }
      };
    }
  });
}

async function openCustomerDrawer(email) {
  if (!email) return;
  const d = drawer({ title: 'ملف العميل', sub: email, body: spinner() });
  try {
    const { rows } = await api.listOrders({ search: email, limit: 50 });
    const mine = rows.filter((o) => String(o.buyer_email).toLowerCase() === String(email).toLowerCase());
    const paid = mine.filter((o) => o.status === 'paid' || o.status === 'delivered');
    const total = paid.reduce((a, o) => a + Number(o.total_minor || 0), 0);
    d.box.querySelector('.drawer-body').innerHTML = `
      <div class="order-hero"><div class="row between"><div><div class="num">${esc(mine[0]?.buyer_name || '')}</div><div class="total">${money(total, mine[0]?.currency || 'MAD')}</div><div class="tiny muted">${paid.length} طلب مدفوع من ${mine.length}</div></div>${mine[0] ? statusChipHtml(mine[0].status) : ''}</div>
      <div class="row" style="margin-top:10px;flex-wrap:wrap"><a class="btn sm" href="mailto:${attr(email)}">${icon('mail', 'sm')} بريد</a>${mine[0]?.buyer_phone ? `<a class="btn sm" href="https://wa.me/${attr(String(mine[0].buyer_phone).replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">${icon('whatsapp', 'sm')} واتساب</a>` : ''}</div></div>
      <h3 style="font-size:13px;margin:18px 0 8px">الطلبات</h3>
      <div class="list-stack">${mine.map((o) => `<button class="item-card" data-act="order-open" data-id="${attr(o.id)}" style="text-align:start"><span class="ic-tile">${icon('receipt')}</span><span class="body"><b>${esc(o.order_no)}</b><span>${esc(fmt(o.created_at))} · ${money(o.total_minor, o.currency)}</span></span>${statusChipHtml(o.status)}</button>`).join('') || '<p class="muted small">لا طلبات.</p>'}</div>`;
    d.box.querySelectorAll('[data-act="order-open"]').forEach((b) => b.onclick = () => { uiClose(); openOrderDrawer(b.dataset.id); });
  } catch (e) { d.box.querySelector('.drawer-body').innerHTML = `<div class="callout rose">${icon('alert')}<div>${esc(api.errorText(e))}</div></div>`; }
}

/* expose view-specific handlers */
window.__rabitiActions = window.__rabitiActions || {};
window.RABITI_APP = {
  persist, toast, api, renderView,
  get state() { return state; }
};

boot();
