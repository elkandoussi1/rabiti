/* Rabiti storefront: public store, cart, checkout and order tracking. */
import {
  $, $$, esc, attr, icon, money, priceToMinor, safeUrl, isEmail, fmtDate, fmtDateTime,
  copyText, currencySymbol, initials, hostLabel
} from './ui.js';
import * as api from './api.js';

const cfg = window.RABITI_CONFIG || {};
const params = new URLSearchParams(location.search);
const state = {
  slug: params.get('store') || '',
  preview: params.get('preview') === '1',
  payload: null,
  lang: 'ar',
  page: params.get('order') ? 'order' : params.get('checkout') === '1' ? 'checkout' : 'home',
  orderNo: params.get('order') || '',
  orderToken: params.get('t') || '',
  order: null,
  cart: {},
  coupon: null,
  couponData: null,
  query: '',
  category: '',
  layout: 'grid',
  productId: '',
  gallery: 0,
  cartOpen: false,
  visitor: '',
  poll: null,
  paidFlag: params.get('paid') === '1',
  error: '',
  loading: true
};

/* ---------- i18n ---------- */
const STR = {
  ar: {
    store: 'المتجر', search: 'ابحث عن منتج…', all: 'الكل', products: 'المنتجات', links: 'تابعني',
    add: 'أضف للسلة', buy: 'اشترِ الآن', open: 'فتح الرابط', download: 'تحميل', details: 'التفاصيل',
    free: 'مجاني', cart: 'السلة', cartEmpty: 'سلتك فارغة', cartEmptyText: 'أضف منتجًا رقميًا لتبدأ.',
    browse: 'تصفح المنتجات', subtotal: 'المجموع', discount: 'الخصم', total: 'الإجمالي', checkout: 'إتمام الشراء',
    continue: 'متابعة التسوق', coupon: 'كود الخصم', apply: 'تطبيق', remove: 'إزالة', qty: 'الكمية',
    customer: 'بياناتك', name: 'الاسم الكامل', email: 'البريد الإلكتروني', phone: 'الهاتف (اختياري)',
    payment: 'طريقة الدفع', note: 'ملاحظة', placeOrder: 'تأكيد الطلب', processing: 'جارٍ المعالجة…',
    secure: 'دفع آمن · تسليم رقمي فوري', summary: 'ملخص الطلب', yourOrder: 'طلبك', orderNo: 'رقم الطلب',
    status: 'الحالة', date: 'التاريخ', items: 'المنتجات', instructions: 'تعليمات الدفع', claim: 'أبلغت عن الدفع',
    claimRef: 'مرجع التحويل أو ملاحظة', claimSent: 'وصلنا إشعارك. سنؤكد الدفع قريبًا.', downloads: 'تحميلاتك',
    pending: 'بانتظار الدفع', paid: 'مدفوع', delivered: 'تم التسليم', cancelled: 'ملغى', refunded: 'مسترجع', failed: 'فشل',
    track: 'تتبع طلبك', trackHint: 'أدخل رقم الطلب والرمز الموجود في رابط الطلب.', trackBtn: 'تتبع',
    storeNotFound: 'المتجر غير موجود', storeNotFoundText: 'تأكد من الرابط أو اطلب من صاحب المتجر رابطًا جديدًا.',
    notPublished: 'المتجر غير منشور', notPublishedText: 'صاحب المتجر لم ينشر صفحته بعد. عد لاحقًا.',
    previewAuth: 'معاينة غير متاحة', previewAuthText: 'سجّل الدخول إلى لوحة التحكم أولًا لمعاينة المسودة.',
    noProducts: 'لا منتجات بعد', noProductsText: 'تابع المتجر، قد تُضاف منتجات قريبًا.', noResults: 'لا نتائج', noResultsText: 'جرّب كلمة أخرى أو تصفح كل المنتجات.',
    added: 'أُضيف إلى السلة', removed: 'أُزيل من السلة', invalidCoupon: 'كود الخصم غير صالح', couponApplied: 'طُبّق الخصم',
    fillFields: 'أكمل بياناتك أولًا', invalidEmail: 'البريد الإلكتروني غير صالح', selectPayment: 'اختر طريقة دفع',
    noPayment: 'لا توجد طريقة دفع متاحة حاليًا', orderCreated: 'أُنشئ طلبك', paymentError: 'تعذّر بدء الدفع',
    paymentNotReady: 'الدفع بالبطاقة غير مفعّل بعد. اختر طريقة أخرى أو تواصل مع المتجر.', retryPay: 'إعادة محاولة الدفع',
    paidSuccess: 'تم الدفع بنجاح', verifying: 'نتحقق من الدفع…', backStore: 'العودة للمتجر', share: 'مشاركة',
    copied: 'تم نسخ الرابط', copy: 'نسخ', deliveryNote: 'ملاحظة التسليم', terms: 'الشروط', contact: 'تواصل',
    paymentMethod: 'طريقة الدفع', orderDate: 'تاريخ الطلب', customerInfo: 'بيانات الزبون', orderItems: 'المنتجات',
    sandbox: 'وضع التجربة', close: 'إغلاق', viewOrder: 'عرض الطلب', payNow: 'ادفع الآن', quantity: 'الكمية',
    powered: 'مدعوم بـ', trackTitle: 'تتبع طلب', orderNotFound: 'لم نجد الطلب', orderNotFoundText: 'تحقق من رقم الطلب والرمز.',
    checkoutStart: 'إتمام الشراء', securePay: 'الدفع آمن ومشفّر', cardPay: 'بطاقة بنكية / CashPlus', manualPay: 'دفع يدوي',
    copiedRef: 'انسخ المرجع', noDownloads: 'لا توجد تحميلات', pendingNote: 'أرسل صورة التحويل على واتساب إن أمكن لتسريع التأكيد.',
    shareText: 'تفضل بزيارة متجري', product: 'منتج', quantityShort: 'الكمية', applyCoupon: 'تطبيق الكود',
    orderTotal: 'الإجمالي', paidVia: 'تم الدفع عبر', choosePayment: 'اختر طريقة الدفع', orderSuccess: 'تم إنشاء طلبك',
    orderSuccessText: 'احتفظ برابط الطلب لمتابعة الدفع والتحميل.', copyOrderLink: 'نسخ رابط الطلب', whatsapp: 'واتساب',
    telegram: 'تيليجرام', emailContact: 'بريد', phoneContact: 'هاتف', website: 'موقع', social: 'تابعني',
    categories: 'التصنيفات', noCategory: 'الكل', price: 'السعر', compare: 'قبل', off: 'خصم', addedToCart: 'في السلة',
    yourCart: 'سلتك', checkoutTitle: 'إتمام الطلب', back: 'رجوع', secureNote: 'بياناتك محفوظة ولا تُشارك مع أي طرف.',
    termsNote: 'بالمتابعة أنت توافق على شروط البيع.', downloadReady: 'رابط التحميل جاهز', orderPendingTitle: 'بانتظار تأكيد الدفع',
    orderPaidTitle: 'شكرًا لك! طلبك مكتمل', orderCancelledTitle: 'هذا الطلب ملغى', orderRefundedTitle: 'تم استرجاع الطلب',
    orderFailedTitle: 'فشل الدفع', payInstructions: 'أكمل الدفع ثم أبلغنا', claimSuccess: 'تم إرسال الإشعار', orderClosed: 'هذا الطلب مغلق.',
    subtotalShort: 'المجموع', discountShort: 'الخصم', totalShort: 'الإجمالي', itemsShort: 'منتج', allProducts: 'كل المنتجات',
    filter: 'تصفية', view: 'عرض', grid: 'شبكة', list: 'قائمة', loading: 'جارٍ التحميل…', error: 'حدث خطأ',
    freeDownload: 'تحميل مجاني', digital: 'منتج رقمي', external: 'رابط خارجي', preview: 'معاينة',
    sandboxCards: 'بطاقات تجريبية: 4242 4242 4242 4242 للنجاح، 4000 0000 0000 0077 للرفض.', payWindow: 'ستفتح نافذة الدفع الآمنة. لا تغلقها حتى تكتمل العملية.',
    orderLinkCopied: 'نُسخ رابط الطلب', chooseMethodFirst: 'اختر طريقة دفع أولًا', fillName: 'اكتب اسمك', fillEmail: 'اكتب بريدك الإلكتروني',
    contactSeller: 'تواصل مع البائع', orderTracking: 'متابعة الطلب', paymentPending: 'بانتظار الدفع', paymentConfirmed: 'تم تأكيد الدفع',
    backToCart: 'العودة للسلة', noProductsShort: 'لا منتجات', categoryAll: 'كل المنتجات', sort: 'ترتيب'
  },
  en: {
    store: 'Store', search: 'Search products…', all: 'All', products: 'Products', links: 'Follow me',
    add: 'Add to cart', buy: 'Buy now', open: 'Open link', download: 'Download', details: 'Details',
    free: 'Free', cart: 'Cart', cartEmpty: 'Your cart is empty', cartEmptyText: 'Add a digital product to get started.',
    browse: 'Browse products', subtotal: 'Subtotal', discount: 'Discount', total: 'Total', checkout: 'Checkout',
    continue: 'Continue shopping', coupon: 'Coupon code', apply: 'Apply', remove: 'Remove', qty: 'Qty',
    customer: 'Your details', name: 'Full name', email: 'Email', phone: 'Phone (optional)',
    payment: 'Payment method', note: 'Note', placeOrder: 'Place order', processing: 'Processing…',
    secure: 'Secure payment · instant digital delivery', summary: 'Order summary', yourOrder: 'Your order', orderNo: 'Order no.',
    status: 'Status', date: 'Date', items: 'Items', instructions: 'Payment instructions', claim: 'I have paid',
    claimRef: 'Transfer reference or note', claimSent: 'We received your note. We will confirm shortly.', downloads: 'Your downloads',
    pending: 'Pending payment', paid: 'Paid', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded', failed: 'Failed',
    track: 'Track your order', trackHint: 'Enter the order number and the token from your order link.', trackBtn: 'Track',
    storeNotFound: 'Store not found', storeNotFoundText: 'Check the link or ask the store owner for a new one.',
    notPublished: 'Store not published', notPublishedText: 'The owner has not published this store yet. Check back later.',
    previewAuth: 'Preview unavailable', previewAuthText: 'Sign in to the dashboard first to preview the draft.',
    noProducts: 'No products yet', noProductsText: 'Follow this store, products may be added soon.', noResults: 'No results', noResultsText: 'Try another word or browse all products.',
    added: 'Added to cart', removed: 'Removed from cart', invalidCoupon: 'Invalid coupon', couponApplied: 'Discount applied',
    fillFields: 'Please complete your details', invalidEmail: 'Invalid email', selectPayment: 'Choose a payment method',
    noPayment: 'No payment method available', orderCreated: 'Your order was created', paymentError: 'Could not start payment',
    paymentNotReady: 'Card payment is not configured. Choose another method or contact the store.', retryPay: 'Retry payment',
    paidSuccess: 'Payment successful', verifying: 'Verifying payment…', backStore: 'Back to store', share: 'Share',
    copied: 'Link copied', copy: 'Copy', deliveryNote: 'Delivery note', terms: 'Terms', contact: 'Contact',
    paymentMethod: 'Payment method', orderDate: 'Order date', customerInfo: 'Customer', orderItems: 'Items',
    sandbox: 'Test mode', close: 'Close', viewOrder: 'View order', payNow: 'Pay now', quantity: 'Quantity',
    powered: 'Powered by', trackTitle: 'Track order', orderNotFound: 'Order not found', orderNotFoundText: 'Check the order number and token.',
    checkoutStart: 'Checkout', securePay: 'Secure encrypted payment', cardPay: 'Card / CashPlus', manualPay: 'Manual payment',
    copiedRef: 'Copy reference', noDownloads: 'No downloads', pendingNote: 'Send the transfer receipt on WhatsApp to speed up confirmation.',
    shareText: 'Visit my store', product: 'Product', quantityShort: 'Qty', applyCoupon: 'Apply code',
    orderTotal: 'Total', paidVia: 'Paid via', choosePayment: 'Choose a payment method', orderSuccess: 'Order created',
    orderSuccessText: 'Keep the order link to track payment and download.', copyOrderLink: 'Copy order link', whatsapp: 'WhatsApp',
    telegram: 'Telegram', emailContact: 'Email', phoneContact: 'Phone', website: 'Website', social: 'Follow me',
    categories: 'Categories', noCategory: 'All', price: 'Price', compare: 'Was', off: 'Off', addedToCart: 'In cart',
    yourCart: 'Your cart', checkoutTitle: 'Checkout', back: 'Back', secureNote: 'Your data is safe and never shared.',
    termsNote: 'By continuing you agree to the store terms.', downloadReady: 'Download ready', orderPendingTitle: 'Waiting for payment',
    orderPaidTitle: 'Thank you! Order complete', orderCancelledTitle: 'This order is cancelled', orderRefundedTitle: 'Order refunded',
    orderFailedTitle: 'Payment failed', payInstructions: 'Complete payment then let us know', claimSuccess: 'Note sent', orderClosed: 'This order is closed.',
    subtotalShort: 'Subtotal', discountShort: 'Discount', totalShort: 'Total', itemsShort: 'item', allProducts: 'All products',
    filter: 'Filter', view: 'View', grid: 'Grid', list: 'List', loading: 'Loading…', error: 'Something went wrong',
    freeDownload: 'Free download', digital: 'Digital product', external: 'External link', preview: 'Preview',
    sandboxCards: 'Test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0077 declines.', payWindow: 'A secure payment window will open. Do not close it until finished.',
    orderLinkCopied: 'Order link copied', chooseMethodFirst: 'Choose a payment method first', fillName: 'Enter your name', fillEmail: 'Enter your email',
    contactSeller: 'Contact seller', orderTracking: 'Order tracking', paymentPending: 'Awaiting payment', paymentConfirmed: 'Payment confirmed',
    backToCart: 'Back to cart', noProductsShort: 'No products', categoryAll: 'All products', sort: 'Sort'
  },
  fr: {
    store: 'Boutique', search: 'Rechercher un produit…', all: 'Tout', products: 'Produits', links: 'Suivez-moi',
    add: 'Ajouter au panier', buy: 'Acheter', open: 'Ouvrir le lien', download: 'Télécharger', details: 'Détails',
    free: 'Gratuit', cart: 'Panier', cartEmpty: 'Votre panier est vide', cartEmptyText: 'Ajoutez un produit numérique pour commencer.',
    browse: 'Voir les produits', subtotal: 'Sous-total', discount: 'Remise', total: 'Total', checkout: 'Commander',
    continue: 'Continuer mes achats', coupon: 'Code promo', apply: 'Appliquer', remove: 'Retirer', qty: 'Qté',
    customer: 'Vos informations', name: 'Nom complet', email: 'E-mail', phone: 'Téléphone (optionnel)',
    payment: 'Moyen de paiement', note: 'Note', placeOrder: 'Confirmer la commande', processing: 'Traitement…',
    secure: 'Paiement sécurisé · livraison numérique immédiate', summary: 'Récapitulatif', yourOrder: 'Votre commande', orderNo: 'N° de commande',
    status: 'Statut', date: 'Date', items: 'Articles', instructions: 'Instructions de paiement', claim: "J'ai payé",
    claimRef: 'Référence du virement ou note', claimSent: 'Nous avons reçu votre note. Confirmation en cours.', downloads: 'Vos téléchargements',
    pending: 'En attente de paiement', paid: 'Payé', delivered: 'Livré', cancelled: 'Annulé', refunded: 'Remboursé', failed: 'Échoué',
    track: 'Suivre votre commande', trackHint: 'Saisissez le numéro et le jeton de votre lien de commande.', trackBtn: 'Suivre',
    storeNotFound: 'Boutique introuvable', storeNotFoundText: 'Vérifiez le lien ou demandez-en un nouveau au propriétaire.',
    notPublished: 'Boutique non publiée', notPublishedText: "Le propriétaire n'a pas encore publié cette boutique. Revenez plus tard.",
    previewAuth: 'Aperçu indisponible', previewAuthText: "Connectez-vous d'abord au tableau de bord pour prévisualiser le brouillon.",
    noProducts: 'Aucun produit', noProductsText: 'Suivez cette boutique, des produits arrivent bientôt.', noResults: 'Aucun résultat', noResultsText: 'Essayez un autre mot ou parcourez tous les produits.',
    added: 'Ajouté au panier', removed: 'Retiré du panier', invalidCoupon: 'Code promo invalide', couponApplied: 'Remise appliquée',
    fillFields: 'Complétez vos informations', invalidEmail: 'E-mail invalide', selectPayment: 'Choisissez un moyen de paiement',
    noPayment: 'Aucun moyen de paiement disponible', orderCreated: 'Commande créée', paymentError: 'Impossible de démarrer le paiement',
    paymentNotReady: "Le paiement par carte n'est pas configuré. Choisissez un autre moyen ou contactez la boutique.", retryPay: 'Réessayer le paiement',
    paidSuccess: 'Paiement réussi', verifying: 'Vérification du paiement…', backStore: 'Retour à la boutique', share: 'Partager',
    copied: 'Lien copié', copy: 'Copier', deliveryNote: 'Note de livraison', terms: 'Conditions', contact: 'Contact',
    paymentMethod: 'Moyen de paiement', orderDate: 'Date', customerInfo: 'Client', orderItems: 'Articles',
    sandbox: 'Mode test', close: 'Fermer', viewOrder: 'Voir la commande', payNow: 'Payer', quantity: 'Quantité',
    powered: 'Propulsé par', trackTitle: 'Suivre la commande', orderNotFound: 'Commande introuvable', orderNotFoundText: 'Vérifiez le numéro et le jeton.',
    checkoutStart: 'Commander', securePay: 'Paiement chiffré sécurisé', cardPay: 'Carte / CashPlus', manualPay: 'Paiement manuel',
    copiedRef: 'Copier la référence', noDownloads: 'Aucun téléchargement', pendingNote: 'Envoyez le reçu sur WhatsApp pour accélérer la confirmation.',
    shareText: 'Visitez ma boutique', product: 'Produit', quantityShort: 'Qté', applyCoupon: 'Appliquer',
    orderTotal: 'Total', paidVia: 'Payé via', choosePayment: 'Choisissez un moyen de paiement', orderSuccess: 'Commande créée',
    orderSuccessText: 'Conservez le lien pour suivre le paiement et télécharger.', copyOrderLink: 'Copier le lien', whatsapp: 'WhatsApp',
    telegram: 'Telegram', emailContact: 'E-mail', phoneContact: 'Téléphone', website: 'Site', social: 'Suivez-moi',
    categories: 'Catégories', noCategory: 'Tout', price: 'Prix', compare: 'Avant', off: 'Remise', addedToCart: 'Dans le panier',
    yourCart: 'Votre panier', checkoutTitle: 'Commande', back: 'Retour', secureNote: 'Vos données sont protégées et jamais partagées.',
    termsNote: 'En continuant, vous acceptez les conditions de la boutique.', downloadReady: 'Téléchargement prêt', orderPendingTitle: 'En attente de paiement',
    orderPaidTitle: 'Merci ! Commande terminée', orderCancelledTitle: 'Commande annulée', orderRefundedTitle: 'Commande remboursée',
    orderFailedTitle: 'Paiement échoué', payInstructions: 'Effectuez le paiement puis prévenez-nous', claimSuccess: 'Note envoyée', orderClosed: 'Commande clôturée.',
    subtotalShort: 'Sous-total', discountShort: 'Remise', totalShort: 'Total', itemsShort: 'article', allProducts: 'Tous les produits',
    filter: 'Filtrer', view: 'Vue', grid: 'Grille', list: 'Liste', loading: 'Chargement…', error: 'Une erreur est survenue',
    freeDownload: 'Téléchargement gratuit', digital: 'Produit numérique', external: 'Lien externe', preview: 'Aperçu',
    sandboxCards: 'Cartes test : 4242 4242 4242 4242 réussit, 4000 0000 0000 0077 refuse.', payWindow: 'Une fenêtre de paiement sécurisée va s’ouvrir. Ne la fermez pas.',
    orderLinkCopied: 'Lien copié', chooseMethodFirst: "Choisissez d'abord un moyen de paiement", fillName: 'Entrez votre nom', fillEmail: 'Entrez votre e-mail',
    contactSeller: 'Contacter le vendeur', orderTracking: 'Suivi de commande', paymentPending: 'En attente', paymentConfirmed: 'Paiement confirmé',
    backToCart: 'Retour au panier', noProductsShort: 'Aucun produit', categoryAll: 'Tous les produits', sort: 'Trier'
  }
};
const t = (k) => STR[state.lang]?.[k] || STR.en[k] || k;

/* ---------- helpers ---------- */
const root = () => document.getElementById('store-root');
const cur = () => state.payload?.shop?.currency || 'MAD';
const products = () => (state.payload?.products || []).filter((p) => p && p.id);
const payMethods = () => (state.payload?.pay || []).filter((m) => m && m.t);
const ycp = () => state.payload?.checkout?.youcanpay || {};
const imgSrc = (u) => {
  const s = String(u || '');
  return /^data:image\//i.test(s) || /^https:\/\//i.test(s) ? s : '';
};
const linkHref = (u) => {
  const s = String(u || '').trim();
  if (/^https:\/\//i.test(s) || /^mailto:/i.test(s) || /^tel:/i.test(s)) return s;
  return '#';
};
const fmt = (iso) => state.lang === 'ar' ? fmtDate(iso, 'ar') : state.lang === 'fr' ? fmtDate(iso, 'fr') : fmtDate(iso, 'en');
const fmtTime = (iso) => state.lang === 'ar' ? fmtDateTime(iso, 'ar') : state.lang === 'fr' ? fmtDateTime(iso, 'fr') : fmtDateTime(iso, 'en');
const priceOf = (p) => priceToMinor(p.pr);
const pcur = (p) => p.cur || cur();
const sale = (p) => {
  const c = Number(String(p.compareAt || '').replace(',', '.'));
  const n = Number(String(p.pr || '').replace(',', '.'));
  return c > n && n > 0;
};
const statusText = (s) => t(s in STR[state.lang] ? s : 'pending');
const statusIcon = (s) => s === 'paid' || s === 'delivered' ? 'check-circle' : s === 'cancelled' || s === 'refunded' ? 'ban' : s === 'failed' ? 'x-circle' : 'clock';
const statusClass = (s) => s === 'paid' || s === 'delivered' ? '' : s === 'cancelled' || s === 'refunded' || s === 'failed' ? s : 'pending';
const methodName = (id) => {
  if (id === 'youcanpay') return 'YouCan Pay';
  return payMethods().find((m) => m.id === id)?.t || id || '—';
};
const methodDetails = (id) => payMethods().find((m) => m.id === id) || null;

function sToast(msg, ms = 2800) {
  const n = document.createElement('div'); n.className = 's-toast'; n.textContent = msg; document.body.appendChild(n);
  setTimeout(() => { n.style.opacity = '0'; n.style.transition = '.25s'; setTimeout(() => n.remove(), 260); }, ms);
}

function visitorId() {
  try {
    let v = localStorage.getItem('rabiti_visitor');
    if (!v || !/^[a-f0-9]{16,64}$/.test(v)) { v = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('rabiti_visitor', v); }
    return v;
  } catch { return ''; }
}

/* ---------- theme ---------- */
const THEMES = {
  sand: { bg: '#fbf7f0', accent: '#0d9488' }, midnight: { bg: '#0b1220', accent: '#2dd4bf' },
  ocean: { bg: '#f0f9ff', accent: '#0284c7' }, rose: { bg: '#fff7f7', accent: '#e11d48' },
  forest: { bg: '#f4f8f3', accent: '#15803d' }, mono: { bg: '#f5f5f4', accent: '#1c1917' },
  violet: { bg: '#faf5ff', accent: '#7c3aed' }
};
function applyTheme() {
  const d = state.payload?.design || {};
  const theme = THEMES[d.theme] ? d.theme : 'sand';
  document.documentElement.dataset.theme = theme;
  const accent = /^#[0-9a-f]{3,8}$/i.test(d.accent || '') ? d.accent : THEMES[theme].accent;
  document.documentElement.style.setProperty('--s-accent', accent);
  document.documentElement.style.setProperty('--s-accent-ink', accent);
  document.documentElement.style.setProperty('--s-accent-soft', `color-mix(in srgb, ${accent} 16%, var(--s-bg))`);
  document.documentElement.style.setProperty('--s-hero', `linear-gradient(135deg,color-mix(in srgb,${accent} 10%,var(--s-bg)),var(--s-bg) 60%)`);
  document.documentElement.style.setProperty('--ratio', ['1/1', '4/3', '16/9', '3/4'].includes(d.ratio) ? d.ratio : '1/1');
  const fonts = {
    cairo: '"Cairo","Segoe UI",Tahoma,sans-serif', tajawal: '"Tajawal","Segoe UI",Tahoma,sans-serif',
    ibm: '"IBM Plex Sans Arabic","Segoe UI",Tahoma,sans-serif', system: '"Segoe UI",Tahoma,system-ui,sans-serif'
  };
  document.documentElement.style.setProperty('--s-font', fonts[d.font] || fonts.cairo);
  document.documentElement.style.setProperty('--s-display', fonts[d.font] || fonts.cairo);
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = THEMES[theme].bg;
  document.documentElement.lang = state.lang;
  document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
}
function applySeo() {
  const p = state.payload; if (!p) return;
  const title = p.seo?.title || `${p.profile?.name || 'متجر'} — ${t('store')}`;
  const desc = p.seo?.description || p.profile?.bio || t('store');
  document.title = title;
  const setMeta = (name, val, prop = false) => {
    let m = document.querySelector(`${prop ? 'meta[property' : 'meta[name'}="${name}"]`);
    if (!m) { m = document.createElement('meta'); if (prop) m.setAttribute('property', name); else m.setAttribute('name', name); document.head.appendChild(m); }
    m.content = val || '';
  };
  setMeta('description', desc);
  setMeta('og:title', title, true); setMeta('og:description', desc, true);
  setMeta('og:type', 'website', true);
  if (p.seo?.image && /^https:\/\//i.test(p.seo.image)) setMeta('og:image', p.seo.image, true);
  setMeta('twitter:card', 'summary_large_image');
}

/* ---------- cart ---------- */
const cartKey = () => `rabiti_cart_${state.slug}`;
function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(cartKey()) || '{}');
    const out = {};
    for (const [id, qty] of Object.entries(raw || {})) {
      const p = products().find((x) => x.id === id);
      if (p && p.mode === 'paid' && Number(qty) > 0) out[id] = Math.min(10, Number(qty));
    }
    state.cart = out;
  } catch { state.cart = {}; }
}
function saveCart() { try { localStorage.setItem(cartKey(), JSON.stringify(state.cart)); } catch { /* full */ } }
function cartLines() {
  return Object.entries(state.cart).map(([id, qty]) => {
    const product = products().find((p) => p.id === id);
    return product ? { product, qty } : null;
  }).filter(Boolean);
}
const cartCount = () => cartLines().reduce((a, l) => a + l.qty, 0);
const cartSubtotal = () => cartLines().reduce((a, l) => a + priceOf(l.product) * l.qty, 0);
const discountMinor = () => state.couponData?.valid ? Math.min(Number(state.couponData.discount_minor || 0), cartSubtotal()) : 0;
const cartTotal = () => Math.max(0, cartSubtotal() - discountMinor());
function addToCart(id, qty = 1, silent = false) {
  const p = products().find((x) => x.id === id);
  if (!p || p.mode !== 'paid') return;
  state.cart[id] = Math.min(10, (state.cart[id] || 0) + qty);
  state.coupon = null; state.couponData = null;
  saveCart(); refreshCartUI();
  if (!silent) sToast(t('added'));
  api.track(state.slug, 'product_view', id, location.pathname, state.visitor, document.referrer).catch(() => {});
}
function setQty(id, qty) {
  if (qty <= 0) delete state.cart[id]; else state.cart[id] = Math.min(10, qty);
  state.coupon = null; state.couponData = null; saveCart(); refreshCartUI();
  if (state.page === 'checkout') renderRoute();
}
function clearCart() { state.cart = {}; state.coupon = null; state.couponData = null; saveCart(); refreshCartUI(); }
function refreshCartUI() {
  const n = cartCount();
  $$('[data-cart-count]').forEach((el) => { el.textContent = n; el.classList.toggle('hidden', n === 0); });
  if (state.cartOpen) renderCartDrawer();
  if (state.page === 'checkout') renderRoute();
}

/* ---------- views ---------- */
function topbar() {
  const p = state.payload;
  const name = p.profile?.name || 'المتجر';
  return `<header class="s-top"><div class="wrap s-top-in">
    <a class="s-brand" href="${attr(homeUrl())}" data-s-act="home">${p.profile?.avatar ? `<span class="mark"><img src="${attr(imgSrc(p.profile.avatar))}" alt=""></span>` : `<span class="mark">${esc(initials(name))}</span>`}<span>${esc(name)}</span></a>
    <div class="spacer"></div>
    <div class="s-top-actions">
      <div class="s-lang">${['ar', 'en', 'fr'].map((l) => `<button data-s-act="lang" data-lang="${l}" class="${state.lang === l ? 'on' : ''}" aria-label="${l}">${l.toUpperCase()}</button>`).join('')}</div>
      <button class="s-icon-btn" data-s-act="share" title="${t('share')}">${icon('share')}</button>
      <button class="s-icon-btn" data-s-act="cart-open" title="${t('cart')}">${icon('bag')}<span class="count ${cartCount() ? '' : 'hidden'}" data-cart-count>${cartCount()}</span></button>
    </div>
  </div></header>`;
}

function hero() {
  const p = state.payload; const d = p.design || {};
  const name = p.profile?.name || 'المتجر';
  const links = (p.links || []).filter((l) => ['whatsapp', 'telegram', 'instagram', 'facebook', 'tiktok', 'youtube', 'email', 'phone'].includes(l.icon || platformIcon(l.u))).slice(0, 5);
  return `<section class="s-hero"><div class="wrap s-hero-in ${d.hero === 'centered' ? 'centered' : ''}">
    <div class="s-avatar">${p.profile?.avatar ? `<img src="${attr(imgSrc(p.profile.avatar))}" alt="${attr(name)}">` : esc(initials(name))}</div>
    <div><h1>${esc(name)}</h1>${p.profile?.bio ? `<p class="bio">${esc(p.profile.bio)}</p>` : ''}${p.profile?.location ? `<div class="loc">${icon('pin', 'sm')} ${esc(p.profile.location)}</div>` : ''}
      ${links.length ? `<div class="s-socials">${links.map((l) => `<a href="${attr(linkHref(l.u))}" target="_blank" rel="noopener" data-s-track="link" data-id="${attr(l.id)}">${icon(PLAT[l.icon] || platformIcon(l.u) || 'globe', 'sm')} ${esc(l.t || platformName(l.u))}</a>`).join('')}</div>` : ''}
    </div>
    ${products().length ? `<div class="s-hero-side"><div class="s-stat-pill"><b>${products().length}</b><span>${t('products')}</span></div><div class="s-stat-pill"><b>${t('digital')}</b><span>${t('secure')}</span></div></div>` : ''}
  </div></section>`;
}

function toolbar() {
  const cats = Array.from(new Set(products().map((p) => (p.category || '').trim()).filter(Boolean))).slice(0, 8);
  const d = state.payload.design || {};
  return `<div class="s-toolbar"><div class="wrap s-toolbar-in">
    <div class="s-search">${icon('search')}<input id="store-search" placeholder="${t('search')}" value="${attr(state.query)}" autocomplete="off"></div>
    ${cats.length ? `<div class="s-cats"><button data-s-act="cat" data-cat="" class="${!state.category ? 'on' : ''}">${t('all')}</button>${cats.map((c) => `<button data-s-act="cat" data-cat="${attr(c)}" class="${state.category === c ? 'on' : ''}">${esc(c)}</button>`).join('')}</div>` : ''}
    <div class="spacer"></div>
    <div class="s-view-toggle"><button data-s-act="layout" data-layout="grid" class="${state.layout !== 'list' ? 'on' : ''}" title="${t('grid')}">${icon('grid')}</button><button data-s-act="layout" data-layout="list" class="${state.layout === 'list' ? 'on' : ''}" title="${t('list')}">${icon('list')}</button></div>
  </div></div>`;
}

function productCard(p) {
  const d = state.payload.design || {};
  const im = p.imgs?.[0] ? imgSrc(p.imgs[0]) : '';
  const badge = p.badge || (sale(p) ? t('off') : '');
  const type = p.mode === 'paid' ? `<span class="s-type">${icon('lock', 'sm')} ${t('digital')}</span>` : p.mode === 'link' ? `<span class="s-type">${icon('external', 'sm')} ${t('external')}</span>` : p.mode === 'file' ? `<span class="s-type">${icon('download', 'sm')} ${t('free')}</span>` : '';
  return `<article class="s-card" data-product="${attr(p.id)}">
    <div class="s-media" data-s-act="open" data-id="${attr(p.id)}">${im ? `<img src="${attr(im)}" alt="${attr(p.t)}" loading="lazy">` : `<div class="placeholder">${icon('image')}</div>`}${badge ? `<span class="s-badge ${sale(p) ? 'sale' : ''}">${esc(badge)}</span>` : ''}${type}</div>
    <div class="s-body">${p.category ? `<div class="s-cat">${esc(p.category)}</div>` : ''}<h3 class="s-title" data-s-act="open" data-id="${attr(p.id)}" style="cursor:pointer">${esc(p.t || t('product'))}</h3>${d.desc ? `<p class="s-desc">${esc(p.d || '')}</p>` : ''}
      <div class="s-price-row">${d.price === 0 ? '' : p.mode === 'paid' ? `<span class="s-price">${money(priceOf(p), pcur(p), state.lang)}</span>${sale(p) ? `<span class="s-compare">${money(priceToMinor(p.compareAt), pcur(p), state.lang)}</span>` : ''}` : `<span class="s-free">${t('free')}</span>`}</div>
      <div class="s-actions">${p.mode === 'paid' ? `<button class="s-btn fill" data-s-act="add" data-id="${attr(p.id)}">${icon('cart', 'sm')} ${t('add')}</button><button class="s-btn" data-s-act="buy" data-id="${attr(p.id)}">${t('buy')}</button>` : p.mode === 'link' ? `<a class="s-btn fill" href="${attr(linkHref(p.link))}" target="_blank" rel="noopener" data-s-track="link" data-id="${attr(p.id)}">${icon('external', 'sm')} ${t('open')}</a>` : p.mode === 'file' ? `<button class="s-btn fill" data-s-act="free-download" data-id="${attr(p.id)}">${icon('download', 'sm')} ${t('download')}</button>` : `<button class="s-btn" data-s-act="open" data-id="${attr(p.id)}">${t('details')}</button>`}</div>
    </div></article>`;
}

function visibleProducts() {
  const q = state.query.trim().toLowerCase();
  let list = products();
  if (state.category) list = list.filter((p) => (p.category || '') === state.category);
  if (q) list = list.filter((p) => `${p.t || ''} ${p.d || ''} ${p.category || ''}`.toLowerCase().includes(q));
  return list;
}
function gridHTML() {
  const q = state.query.trim().toLowerCase();
  const list = visibleProducts();
  if (!list.length) return `<div class="s-empty"><div class="ill">${icon(q || state.category ? 'search' : 'box')}</div><h3>${q || state.category ? t('noResults') : t('noProducts')}</h3><p>${q || state.category ? t('noResultsText') : t('noProductsText')}</p></div>`;
  return `<div class="s-grid ${state.layout === 'list' ? 'list' : ''}" id="products-grid">${list.map(productCard).join('')}</div>`;
}

function linksBlock() {
  const links = state.payload.links || [];
  if (!links.length) return '';
  return `<section class="s-links"><div class="wrap"><div class="s-sec-head"><div><h2>${t('links')}</h2><p>${t('social')}</p></div></div><div class="s-links-grid">${links.map((l) => `<a class="s-link" href="${attr(linkHref(l.u))}" target="_blank" rel="noopener" data-s-track="link" data-id="${attr(l.id)}"><span class="ic-tile">${icon(PLAT[l.icon] || platformIcon(l.u) || 'globe')}</span><span style="min-width:0"><b>${esc(l.t || platformName(l.u))}</b><span>${esc(hostLabel(l.u))}</span></span><span class="arrow">${icon('arrow-up-right', 'sm')}</span></a>`).join('')}</div></div></section>`;
}

function footer() {
  const p = state.payload; const d = p.design || {};
  const name = p.profile?.name || '';
  const year = new Date().getFullYear();
  return `<footer class="s-foot"><div class="wrap"><div class="s-foot-in"><div>${d.footerOn ? esc(d.footer || `© ${year} ${name} — ${t('store')}`) : `© ${year} ${name}`}</div><div class="row" style="gap:14px">${p.shop?.terms ? `<button class="s-btn ghost" data-s-act="terms" style="border:0;background:none;padding:0;font-size:10.5px;color:var(--s-muted)">${t('terms')}</button>` : ''}<a class="made" href="index.html" target="_blank" rel="noopener"><span class="mark">R</span>${t('powered')} ${t('store') === 'Store' ? 'Rabiti' : 'رابطي'}</a></div></div><div class="s-pay-note">${icon('lock', 'sm')} ${t('secure')}</div></div></footer>`;
}

function homeHTML() {
  const d = state.payload.design || {};
  return `${topbar()}${hero()}${toolbar()}<section class="s-section"><div class="wrap"><div class="s-sec-head"><div><h2>${t('products')}</h2><p>${state.category ? esc(state.category) : t('allProducts')}</p></div><span class="s-count" id="products-count">${products().length} ${t('itemsShort')}</span></div><div id="products-wrap">${gridHTML()}</div></div></section>${linksBlock()}${footer()}<button class="s-cart-fab" data-s-act="cart-open" ${cartCount() ? '' : 'style="display:none"'}>${icon('bag')} ${t('cart')} <span class="count" data-cart-count>${cartCount()}</span></button>`;
}

/* ---------- product modal ---------- */
function openProduct(id) {
  const p = products().find((x) => x.id === id); if (!p) return;
  state.productId = id; state.gallery = 0;
  api.track(state.slug, 'product_view', id, location.pathname, state.visitor, document.referrer).catch(() => {});
  renderProductModal();
}
function renderProductModal() {
  const p = products().find((x) => x.id === state.productId); if (!p) return;
  const imgs = (p.imgs || []).map(imgSrc).filter(Boolean);
  const im = imgs[state.gallery] || imgs[0] || '';
  const d = state.payload.design || {};
  const inCart = !!state.cart[p.id];
  const actions = p.mode === 'paid'
    ? `<button class="s-btn fill" data-s-act="add" data-id="${attr(p.id)}">${icon('cart', 'sm')} ${inCart ? t('addedToCart') : t('add')}</button><button class="s-btn" data-s-act="buy" data-id="${attr(p.id)}">${t('buy')}</button>`
    : p.mode === 'link' ? `<a class="s-btn fill" href="${attr(linkHref(p.link))}" target="_blank" rel="noopener" data-s-track="link" data-id="${attr(p.id)}">${icon('external', 'sm')} ${t('open')}</a>`
    : p.mode === 'file' ? `<button class="s-btn fill" data-s-act="free-download" data-id="${attr(p.id)}">${icon('download', 'sm')} ${t('download')}</button>` : '';
  let rootEl = document.getElementById('modal-root');
  if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'modal-root'; document.body.appendChild(rootEl); }
  rootEl.innerHTML = `<div class="s-overlay" data-s-act="modal-close"></div><div class="s-modal"><div class="s-modal-box">
    <div class="s-modal-media">${im ? `<img src="${attr(im)}" alt="${attr(p.t)}">` : `<div class="placeholder">${icon('image', 'lg')}</div>`}<button class="s-modal-close" data-s-act="modal-close">${icon('x')}</button>${imgs.length > 1 ? `<div style="position:absolute;bottom:10px;inset-inline:0;display:flex;gap:5px;justify-content:center">${imgs.map((s, i) => `<button data-s-act="gallery" data-i="${i}" style="width:34px;height:34px;border-radius:8px;border:2px solid ${i === state.gallery ? 'var(--s-accent)' : 'transparent'};overflow:hidden;padding:0;background:none"><img src="${attr(s)}" style="width:100%;height:100%;object-fit:cover"></button>`).join('')}</div>` : ''}</div>
    <div class="s-modal-body">${p.category ? `<div class="s-cat">${esc(p.category)}</div>` : ''}<h2>${esc(p.t || t('product'))}</h2>${d.desc !== 0 ? `<p class="desc">${esc(p.d || '')}</p>` : ''}
      ${d.price !== 0 ? `<div class="price">${p.mode === 'paid' ? money(priceOf(p), pcur(p), state.lang) : `<span class="s-free">${t('free')}</span>`}${sale(p) ? `<span class="cmp">${money(priceToMinor(p.compareAt), pcur(p), state.lang)}</span>` : ''}</div>` : ''}
      ${p.deliveryNote || state.payload.shop?.deliveryNote ? `<div class="note">${icon('info', 'sm')}<span>${esc(p.deliveryNote || state.payload.shop.deliveryNote)}</span></div>` : ''}
      ${p.mode === 'paid' ? `<div class="note" style="background:transparent;padding:0;color:var(--s-muted)">${icon('lock', 'sm')}<span>${t('secure')}</span></div>` : ''}
      <div class="actions">${actions}<button class="s-btn ghost" data-s-act="modal-close">${t('close')}</button></div>
    </div></div></div>`;
  document.body.classList.add('lock');
}
function closeProduct() {
  const el = document.getElementById('modal-root'); if (el) el.innerHTML = '';
  state.productId = ''; document.body.classList.remove('lock');
}

/* ---------- cart drawer ---------- */
function openCart() { state.cartOpen = true; renderCartDrawer(); }
function closeCart() { state.cartOpen = false; const el = document.getElementById('cart-root'); if (el) el.innerHTML = ''; document.body.classList.remove('lock'); }
function renderCartDrawer() {
  let el = document.getElementById('cart-root');
  if (!el) { el = document.createElement('div'); el.id = 'cart-root'; document.body.appendChild(el); }
  const lines = cartLines();
  const body = lines.length ? lines.map(({ product: p, qty }) => `<div class="cart-line"><div class="im">${p.imgs?.[0] ? `<img src="${attr(imgSrc(p.imgs[0]))}" alt="">` : icon('box', 'sm')}</div><div class="info"><b>${esc(p.t || t('product'))}</b><span>${money(priceOf(p), pcur(p), state.lang)}</span><div class="line-foot"><div class="qty"><button data-s-act="qty" data-id="${attr(p.id)}" data-dir="-1">−</button><span>${qty}</span><button data-s-act="qty" data-id="${attr(p.id)}" data-dir="1">+</button></div><span class="amt">${money(priceOf(p) * qty, pcur(p), state.lang)}</span><button class="rm" data-s-act="remove" data-id="${attr(p.id)}">${icon('trash', 'sm')}</button></div></div></div>`).join('') : `<div class="cart-empty"><div class="ill">${icon('bag', 'lg')}</div><h4>${t('cartEmpty')}</h4><p>${t('cartEmptyText')}</p><button class="s-btn fill" data-s-act="cart-close" style="width:100%">${t('browse')}</button></div>`;
  el.innerHTML = `<div class="s-overlay" data-s-act="cart-close"></div><aside class="s-panel"><div class="s-panel-head"><div style="flex:1"><h3>${t('yourCart')}</h3><p>${cartCount()} ${t('itemsShort')}</p></div><button class="s-close" data-s-act="cart-close">${icon('x')}</button></div><div class="s-panel-body">${body}${lines.length ? `<div class="coupon-row"><input id="coupon-input" placeholder="${t('coupon')}" value="${attr(state.coupon || '')}"><button data-s-act="coupon-apply">${t('apply')}</button></div>${state.couponData?.valid ? `<div class="coupon-msg ok">${t('couponApplied')} · −${money(discountMinor(), cur(), state.lang)} <button data-s-act="coupon-remove" style="border:0;background:none;color:var(--s-muted);text-decoration:underline;font-size:10px">${t('remove')}</button></div>` : state.couponData && !state.couponData.valid ? `<div class="coupon-msg err">${t('invalidCoupon')}</div>` : ''}<div class="cart-summary"><div class="r"><span>${t('subtotal')}</span><b>${money(cartSubtotal(), cur(), state.lang)}</b></div>${discountMinor() ? `<div class="r"><span>${t('discount')}</span><b style="color:#047857">− ${money(discountMinor(), cur(), state.lang)}</b></div>` : ''}<div class="r total"><span>${t('total')}</span><span>${money(cartTotal(), cur(), state.lang)}</span></div></div>` : ''}</div>${lines.length ? `<div class="s-panel-foot"><button class="s-btn fill" data-s-act="checkout" style="width:100%;padding:12px">${icon('lock', 'sm')} ${t('checkout')}</button><div class="s-secure">${icon('shield', 'sm')} ${t('secure')}</div></div>` : ''}</aside>`;
  document.body.classList.add('lock');
}

/* ---------- checkout ---------- */
function checkoutHTML() {
  const lines = cartLines();
  if (!lines.length) return `${topbar()}<div class="wrap s-checkout"><div class="s-empty"><div class="ill">${icon('bag')}</div><h3>${t('cartEmpty')}</h3><p>${t('cartEmptyText')}</p><a class="s-btn fill" href="${attr(homeUrl())}" data-s-act="home" style="display:inline-flex;padding:10px 16px">${t('browse')}</a></div></div>${footer()}`;
  const methods = [];
  if (ycp().enabled && ycp().publicKey) methods.push({ id: 'youcanpay', title: t('cardPay'), sub: 'YouCan Pay · ' + (ycp().sandbox ? t('sandbox') : 'Visa / Mastercard / CashPlus'), logo: 'YCP' });
  payMethods().forEach((m) => methods.push({ id: m.id, title: m.t, sub: m.d || '', logo: m.kind === 'paypal' ? 'PayPal' : m.kind === 'cashplus' ? 'Cash' : m.kind === 'bank' ? 'Bank' : 'Pay' }));
  const selected = state.checkoutMethod && methods.some((m) => m.id === state.checkoutMethod) ? state.checkoutMethod : methods[0]?.id || '';
  state.checkoutMethod = selected;
  return `${topbar()}<div class="wrap s-checkout"><a class="s-back" href="${attr(homeUrl())}" data-s-act="home">${icon('arrow-left', 'sm')} ${t('back')}</a><div class="s-checkout-grid">
    <form class="s-panel-card" id="checkout-form" novalidate><h3>${t('customer')}</h3><p class="sub">${t('secureNote')}</p>
      <div class="s-field"><label>${t('name')}</label><input id="co-name" autocomplete="name" required maxlength="120" value="${attr(state.buyer?.name || '')}"></div>
      <div class="s-field"><label>${t('email')}</label><input id="co-email" type="email" autocomplete="email" required value="${attr(state.buyer?.email || '')}" dir="ltr"></div>
      <div class="s-field"><label>${t('phone')}</label><input id="co-phone" type="tel" autocomplete="tel" value="${attr(state.buyer?.phone || '')}" dir="ltr"></div>
      <h3 style="margin-top:20px">${t('payment')}</h3><p class="sub">${t('choosePayment')}</p>
      <div class="s-methods">${methods.length ? methods.map((m) => `<label class="s-method"><input type="radio" name="co-method" value="${attr(m.id)}" ${selected === m.id ? 'checked' : ''}><span class="m-logo">${esc(m.logo)}</span><span class="m-info"><b>${esc(m.title)}</b><span>${esc(m.sub)}</span></span></label>`).join('') : `<div class="s-instructions">${t('noPayment')}</div>`}</div>
      ${state.payload.checkout?.note ? `<div class="s-instructions" style="margin-top:12px">${esc(state.payload.checkout.note)}</div>` : ''}
      <div style="margin-top:16px"><button class="s-btn fill" id="co-submit" style="width:100%;padding:12px" ${methods.length ? '' : 'disabled'}>${icon('lock', 'sm')} ${t('placeOrder')}</button><div class="s-secure">${icon('shield', 'sm')} ${t('securePay')}</div></div>
    </form>
    <aside class="s-panel-card s-order-sum"><h3>${t('summary')}</h3><div class="lines">${lines.map(({ product: p, qty }) => `<div class="line"><div class="im">${p.imgs?.[0] ? `<img src="${attr(imgSrc(p.imgs[0]))}" alt="">` : icon('box', 'sm')}</div><div style="flex:1;min-width:0"><b>${esc(p.t || t('product'))}</b><span>${t('quantityShort')} ${qty}</span></div><span class="amt">${money(priceOf(p) * qty, pcur(p), state.lang)}</span></div>`).join('')}</div>
      <div class="sums"><div class="r"><span>${t('subtotal')}</span><b>${money(cartSubtotal(), cur(), state.lang)}</b></div>${discountMinor() ? `<div class="r"><span>${t('discount')}</span><b style="color:var(--s-accent)">− ${money(discountMinor(), cur(), state.lang)}</b></div>` : ''}<div class="r total"><span>${t('total')}</span><span>${money(cartTotal(), cur(), state.lang)}</span></div></div>
      <div class="coupon-row"><input id="co-coupon" placeholder="${t('coupon')}" value="${attr(state.coupon || '')}"><button type="button" data-s-act="co-coupon">${t('apply')}</button></div>${state.couponData?.valid ? `<div class="coupon-msg ok">${t('couponApplied')}</div>` : state.couponData && !state.couponData.valid ? `<div class="coupon-msg err">${t('invalidCoupon')}</div>` : ''}
      <div class="s-secure" style="margin-top:14px">${icon('lock', 'sm')} ${t('secure')}</div></aside>
  </div></div>${footer()}`;
}

async function applyCoupon(code, inputId) {
  const c = String(code || '').trim();
  if (!c) return;
  try {
    const r = await api.validateCoupon(state.slug, c, cartSubtotal());
    state.coupon = c; state.couponData = r;
    if (r.valid) sToast(t('couponApplied')); else sToast(t('invalidCoupon'), 3500);
    if (state.cartOpen) renderCartDrawer();
    if (state.page === 'checkout') renderRoute();
  } catch (e) {
    state.coupon = ''; state.couponData = null;
    sToast(api.errorText(e), 4000);
  }
}

async function submitCheckout(e) {
  e.preventDefault();
  const name = $('#co-name').value.trim(), email = $('#co-email').value.trim(), phone = $('#co-phone').value.trim();
  const method = document.querySelector('input[name=co-method]:checked')?.value || '';
  if (!name) return sToast(t('fillName'), 3000);
  if (!isEmail(email)) return sToast(t('invalidEmail'), 3000);
  if (!method) return sToast(t('selectPayment'), 3000);
  const btn = $('#co-submit'); if (!btn) return;
  btn.disabled = true; const old = btn.innerHTML; btn.innerHTML = `${icon('loader', 'sm')} ${t('processing')}`;
  state.buyer = { name, email, phone };
  try { localStorage.setItem('rabiti_buyer', JSON.stringify(state.buyer)); } catch { /* ignore */ }
  const items = cartLines().map(({ product, qty }) => ({ id: product.id, qty }));
  try {
    const order = await api.createOrder(state.slug, items, state.buyer, state.coupon || '', method);
    clearCart();
    if (method === 'youcanpay') {
      goOrder(order, true);
      await startYouCanPay(order);
    } else {
      goOrder(order);
      sToast(t('orderCreated'), 3000);
    }
  } catch (err) {
    sToast(api.errorText(err), 5000);
    btn.disabled = false; btn.innerHTML = old;
  }
}

/* ---------- order ---------- */
async function loadOrder() {
  if (!state.orderNo || !state.orderToken) return null;
  try {
    const o = await api.orderStatus(state.slug, state.orderNo, state.orderToken);
    state.order = o;
    if (o && ['paid', 'delivered', 'cancelled', 'refunded', 'failed'].includes(o.status)) stopPolling();
    return o;
  } catch (e) { state.error = api.errorText(e); return null; }
}
function stopPolling() { if (state.poll) { clearInterval(state.poll); state.poll = null; } }
function startPolling() {
  stopPolling();
  if (!state.order || state.order.status !== 'pending') return;
  state.poll = setInterval(async () => {
    if (state.page !== 'order') return;
    const o = await loadOrder();
    if (o && o.status !== state.order?.status) { renderRoute(); if (o.status !== 'pending') stopPolling(); }
    else if (o && o.status !== 'pending') stopPolling();
  }, 12000);
}

async function orderHTML() {
  if (!state.orderNo || !state.orderToken) return trackPageHTML(t('orderNotFound'), t('orderNotFoundText'));
  if (!state.order) await loadOrder();
  const o = state.order;
  if (!o) return trackPageHTML(t('orderNotFound'), t('orderNotFoundText'));
  const paid = o.status === 'paid' || o.status === 'delivered';
  const downloads = {};
  if (paid) {
    for (const it of o.items || []) {
      try { const d = await api.orderDownload(state.slug, o.order_no, state.orderToken, it.id); if (d) downloads[it.id] = d; } catch { /* ignore */ }
    }
  }
  const method = methodDetails(o.payment_method);
  const title = paid ? t('orderPaidTitle') : o.status === 'cancelled' ? t('orderCancelledTitle') : o.status === 'refunded' ? t('orderRefundedTitle') : o.status === 'failed' ? t('orderFailedTitle') : t('orderPendingTitle');
  const ico = paid ? 'check-circle' : o.status === 'cancelled' || o.status === 'refunded' || o.status === 'failed' ? 'ban' : 'clock';
  return `${topbar()}<div class="wrap s-order"><a class="s-back" href="${attr(homeUrl())}" data-s-act="home">${icon('arrow-left', 'sm')} ${t('backStore')}</a>
    <div class="s-order-card"><div class="s-order-head"><div class="status-ico ${statusClass(o.status)}">${icon(ico, 'lg')}</div><h1>${esc(title)}</h1><p>${paid ? t('paidSuccess') : o.status === 'pending' ? t('payInstructions') : t('orderClosed')}</p><span class="onum">${esc(o.order_no)}</span></div>
      <div class="s-order-body">
        ${o.status === 'pending' ? `<h3>${t('instructions')}</h3>${o.payment_method === 'youcanpay' ? `<div class="s-instructions"><b>${t('cardPay')}</b>${t('payWindow')}${ycp().sandbox ? `<br><br>${t('sandboxCards')}` : ''}</div><button class="s-btn fill" style="margin-top:10px;width:100%" data-s-act="retry-pay">${icon('card', 'sm')} ${t('retryPay')}</button>` : `<div class="s-instructions"><b>${esc(method?.t || methodName(o.payment_method))}</b>${esc(method?.d || '')}${method?.u ? `<br><a href="${attr(linkHref(method.u))}" target="_blank" rel="noopener" style="color:var(--s-accent);font-weight:800">${t('open')}</a>` : ''}${state.payload.checkout?.note ? `<br><br>${esc(state.payload.checkout.note)}` : ''}${t('pendingNote') ? `<br><br>${esc(t('pendingNote'))}` : ''}</div><form id="claim-form" class="s-claim"><input id="claim-ref" placeholder="${t('claimRef')}" maxlength="500"><button type="submit">${t('claim')}</button></form>`}` : ''}
        ${paid ? `<h3>${t('downloads')}</h3><div class="s-downloads">${(o.items || []).map((it) => { const d = downloads[it.id]; return `<div class="s-download"><span class="ic-tile">${icon('file', 'sm')}</span><div style="flex:1;min-width:0"><b>${esc(it.title || it.id)}</b><span>${d ? esc(d.filename || '') : t('noDownloads')}</span></div>${d ? `<a class="s-btn fill" href="${attr(d.url)}" ${/^data:/i.test(d.url) ? `download="${attr(d.filename || 'file')}"` : 'target="_blank" rel="noopener"'} data-s-act="download-file">${icon('download', 'sm')} ${t('download')}</a>` : ''}</div>`; }).join('')}</div>` : ''}
        <h3 style="margin-top:22px">${t('orderItems')}</h3><div class="s-order-lines">${(o.items || []).map((it) => `<div class="s-order-line"><div style="flex:1;min-width:0"><b>${esc(it.title || it.id)}</b><div class="q">${it.qty} × ${money(it.price_minor, o.currency, state.lang)}</div></div><span class="amt">${money(Number(it.price_minor) * Number(it.qty), o.currency, state.lang)}</span></div>`).join('')}</div>
        <div class="s-order-totals"><div class="r"><span>${t('subtotal')}</span><b>${money(o.subtotal_minor, o.currency, state.lang)}</b></div>${o.discount_minor ? `<div class="r"><span>${t('discount')} ${o.coupon ? `(${esc(o.coupon)})` : ''}</span><b style="color:var(--s-accent)">− ${money(o.discount_minor, o.currency, state.lang)}</b></div>` : ''}<div class="r total"><span>${t('total')}</span><span>${money(o.total_minor, o.currency, state.lang)}</span></div></div>
        <div class="s-order-totals" style="margin-top:16px;color:var(--s-muted);font-size:11px"><div class="r"><span>${t('orderDate')}</span><span>${esc(fmtTime(o.created_at))}</span></div><div class="r"><span>${t('paymentMethod')}</span><span>${esc(methodName(o.payment_method))}</span></div><div class="r"><span>${t('status')}</span><span>${esc(statusText(o.status))}</span></div></div>
        <div class="row" style="margin-top:16px;flex-wrap:wrap"><button class="s-btn" data-s-act="copy-order">${icon('copy', 'sm')} ${t('copyOrderLink')}</button>${state.payload.shop?.whatsapp ? `<a class="s-btn" href="https://wa.me/${attr(String(state.payload.shop.whatsapp).replace(/[^0-9]/g, ''))}" target="_blank" rel="noopener">${icon('whatsapp', 'sm')} ${t('contactSeller')}</a>` : ''}</div>
      </div></div>
    <div class="s-panel-card" style="margin-top:16px"><h3 style="margin:0 0 4px;font-size:14px">${t('track')}</h3><p class="small" style="margin:0;color:var(--s-muted);font-size:11.5px">${t('trackHint')}</p><form id="track-form" class="s-track-form"><input id="track-no" placeholder="${t('orderNo')}" value="${attr(state.orderNo)}" dir="ltr"><input id="track-token" placeholder="Token" dir="ltr" type="password" value="${attr(state.orderToken)}"><button type="submit">${t('trackBtn')}</button></form></div>
  </div>${footer()}`;
}

function trackPageHTML(title, text) {
  return `${topbar()}<div class="wrap s-order"><div class="s-order-card"><div class="s-order-head"><div class="status-ico pending">${icon('search', 'lg')}</div><h1>${esc(title)}</h1><p>${esc(text)}</p></div><div class="s-order-body"><form id="track-form" class="s-track-form" style="flex-direction:column;align-items:stretch"><input id="track-no" placeholder="${t('orderNo')}" dir="ltr"><input id="track-token" placeholder="Token" dir="ltr" type="password"><button type="submit">${t('trackBtn')}</button></form><div class="row" style="margin-top:14px"><a class="s-btn" href="${attr(homeUrl())}" data-s-act="home">${t('backStore')}</a></div></div></div></div>${footer()}`;
}

/* ---------- payment ---------- */
async function startYouCanPay(order) {
  const pub = ycp().publicKey;
  if (!ycp().enabled || !pub) { sToast(t('paymentNotReady'), 4500); return; }
  let rootEl = document.getElementById('modal-root');
  if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'modal-root'; document.body.appendChild(rootEl); }
  rootEl.innerHTML = `<div class="s-overlay" data-s-act="pay-close"></div><div class="s-modal"><div class="s-modal-box" style="grid-template-columns:1fr;width:min(520px,100%)"><div class="s-modal-body"><h2 style="font-size:20px;margin:0 0 4px">${t('cardPay')}</h2><p style="font-size:12px;color:var(--s-muted);margin:0 0 14px">${t('payWindow')}</p><div id="yp-status" class="s-instructions" style="margin-bottom:12px">${t('processing')}</div><div id="yp-container"></div><div class="actions" style="margin-top:14px"><button class="s-btn fill" id="yp-confirm" disabled>${t('payNow')}</button><button class="s-btn" data-s-act="pay-close">${t('close')}</button></div><div class="s-secure">${icon('lock', 'sm')} YouCan Pay</div></div></div></div>`;
  document.body.classList.add('lock');
  const status = document.getElementById('yp-status');
  try {
    const fnUrl = `${String(cfg.supabaseUrl || '').replace(/\/$/, '')}/functions/v1/youcanpay-tokenize`;
    const successUrl = orderUrl(order, { paid: '1' });
    const errorUrl = orderUrl(order, { failed: '1' });
    const res = await fetch(fnUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cfg.supabasePublishableKey || '', Authorization: `Bearer ${cfg.supabasePublishableKey || ''}` },
      body: JSON.stringify({ order_no: order.order_no, token: order.token, success_url: successUrl, error_url: errorUrl })
    });
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    const token = data.token || data.data?.token;
    const publicKey = data.public_key || data.publicKey || pub;
    if (!token) throw new Error('missing token');
    if (!window.yp) await loadScript('https://youcanpay.com/yp.js');
    if (!window.yp) throw new Error('SDK unavailable');
    status.textContent = t('payWindow');
    const elements = window.yp(publicKey, {
      locale: state.lang === 'ar' ? 'ar' : state.lang === 'fr' ? 'fr' : 'en',
      sandbox: !!data.sandbox
    }).elements({ token, container: '#yp-container' });
    elements.on?.('error', (err) => {
      status.textContent = t('paymentError') + (err?.message ? ': ' + err.message : '');
    });
    await elements.mount();
    const confirm = document.getElementById('yp-confirm');
    confirm.disabled = false;
    confirm.onclick = async () => {
      confirm.disabled = true; const old = confirm.textContent; confirm.textContent = t('processing');
      try {
        const result = await elements.confirm();
        if (result?.status === 'succeeded') { window.location.href = successUrl; return; }
        status.textContent = t('paymentError') + (result?.error?.message ? ': ' + result.error.message : '');
        confirm.disabled = false; confirm.textContent = old;
      } catch (e) {
        status.textContent = t('paymentError') + (e?.message ? ': ' + e.message : '');
        confirm.disabled = false; confirm.textContent = old;
      }
    };
  } catch (e) {
    status.innerHTML = `<b>${t('paymentNotReady')}</b><br><span style="font-size:10.5px;color:var(--s-muted)">${esc(String(e.message || e).slice(0, 240))}</span><br><a href="${attr(homeUrl())}" style="color:var(--s-accent);font-weight:800">${t('backStore')}</a>`;
    sToast(t('paymentError'), 4500);
  }
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = src; s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
  });
}

/* ---------- navigation ---------- */
function homeUrl() {
  const u = new URL('public.html', location.href);
  u.searchParams.set('store', state.slug);
  if (state.preview) u.searchParams.set('preview', '1');
  return u.href;
}
function orderUrl(order, extra = {}) {
  const u = new URL(location.href);
  u.searchParams.set('store', state.slug);
  u.searchParams.set('order', order.order_no);
  u.searchParams.set('t', order.token);
  u.searchParams.delete('checkout'); u.searchParams.delete('paid'); u.searchParams.delete('failed');
  Object.entries(extra).forEach(([k, v]) => u.searchParams.set(k, v));
  return u.href;
}
function go(page, { order, token, replace = false } = {}) {
  const u = new URL(location.href);
  u.searchParams.set('store', state.slug);
  if (state.preview) u.searchParams.set('preview', '1'); else u.searchParams.delete('preview');
  u.searchParams.delete('checkout'); u.searchParams.delete('order'); u.searchParams.delete('t'); u.searchParams.delete('paid'); u.searchParams.delete('failed');
  if (page === 'checkout') u.searchParams.set('checkout', '1');
  if (page === 'order') { u.searchParams.set('order', order?.order_no || state.orderNo); u.searchParams.set('t', order?.token || state.orderToken); }
  history[replace ? 'replaceState' : 'pushState']({}, '', u);
  state.page = page;
  if (page === 'order') { state.orderNo = order?.order_no || state.orderNo; state.orderToken = order?.token || state.orderToken; state.order = null; }
  if (page === 'checkout') { state.checkoutMethod = state.checkoutMethod || ''; api.track(state.slug, 'checkout_start', '', location.pathname, state.visitor, document.referrer).catch(() => {}); }
  renderRoute(true);
}
function goOrder(order, replace = false) {
  state.orderNo = order.order_no; state.orderToken = order.token; state.order = null;
  const u = orderUrl(order);
  history[replace ? 'replaceState' : 'pushState']({}, '', u);
  state.page = 'order';
  renderRoute(true);
}

async function renderRoute(scroll = false) {
  applyTheme();
  const html = state.page === 'checkout' ? checkoutHTML() : state.page === 'order' ? await orderHTML() : homeHTML();
  root().innerHTML = html;
  if (scroll) window.scrollTo({ top: 0, behavior: 'smooth' });
  if (state.page === 'order') { startPolling(); if (state.paidFlag) { state.paidFlag = false; setTimeout(async () => { await loadOrder(); renderRoute(); }, 2500); } }
}

/* ---------- boot ---------- */
async function boot() {
  if (!state.slug || !/^[a-z0-9][a-z0-9-]{2,39}$/.test(state.slug)) { renderError(t('storeNotFound'), t('storeNotFoundText')); return; }
  state.visitor = visitorId();
  try {
    let page;
    if (state.preview) {
      try { page = { payload: await api.preview() }; }
      catch (e) { renderError(t('previewAuth'), t('previewAuthText')); return; }
    } else {
      page = await api.publicPage(state.slug);
    }
    if (!page?.payload) { renderError(t('storeNotFound'), t('storeNotFoundText')); return; }
    state.payload = page.payload;
    state.lang = ['ar', 'en', 'fr'].includes(localStorage.getItem('rabiti_lang_' + state.slug)) ? localStorage.getItem('rabiti_lang_' + state.slug) : (['ar', 'en', 'fr'].includes(state.payload.lang) ? state.payload.lang : 'ar');
    try { state.buyer = JSON.parse(localStorage.getItem('rabiti_buyer') || 'null') || {}; } catch { state.buyer = {}; }
    loadCart(); applySeo();
    if (!state.preview) api.track(state.slug, 'page_view', '', location.pathname, state.visitor, document.referrer).catch(() => {});
    if (state.page === 'order') await loadOrder();
    await renderRoute();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  } catch (e) {
    renderError(t('error'), api.errorText(e));
  }
}

function renderError(title, text) {
  root().innerHTML = `<div class="s-error"><div class="box"><div class="ill">${icon('alert', 'lg')}</div><h1>${esc(title)}</h1><p>${esc(text)}</p><a class="s-btn fill" href="index.html" style="display:inline-flex;padding:10px 16px">${t('store')}</a></div></div>`;
}

/* ---------- helpers for links ---------- */
const PLAT = { whatsapp: 'whatsapp', telegram: 'telegram', instagram: 'instagram', facebook: 'facebook', tiktok: 'tiktok', youtube: 'youtube', email: 'mail', phone: 'phone', website: 'globe', store: 'bag' };
function platformIcon(u) {
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
}
function platformName(u) {
  const k = platformIcon(u);
  return { whatsapp: t('whatsapp'), telegram: t('telegram'), instagram: 'Instagram', facebook: 'Facebook', tiktok: 'TikTok', youtube: 'YouTube', email: t('emailContact'), phone: t('phoneContact'), website: t('website') }[k] || t('website');
}

/* ---------- events ---------- */
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-s-act]');
  if (!btn) return;
  const act = btn.dataset.sAct;
  if (act === 'home') { e.preventDefault(); go('home'); return; }
  if (act === 'cart-open') { openCart(); return; }
  if (act === 'cart-close') { closeCart(); return; }
  if (act === 'checkout') { closeCart(); go('checkout'); return; }
  if (act === 'add') { addToCart(btn.dataset.id); return; }
  if (act === 'buy') { addToCart(btn.dataset.id, 1, true); closeProduct(); go('checkout'); return; }
  if (act === 'open') { openProduct(btn.dataset.id); return; }
  if (act === 'modal-close') { closeProduct(); return; }
  if (act === 'pay-close') { closeProduct(); return; }
  if (act === 'gallery') { state.gallery = Number(btn.dataset.i) || 0; renderProductModal(); return; }
  if (act === 'qty') { const id = btn.dataset.id; setQty(id, (state.cart[id] || 0) + Number(btn.dataset.dir)); return; }
  if (act === 'remove') { setQty(btn.dataset.id, 0); return; }
  if (act === 'coupon-apply') { await applyCoupon($('#coupon-input')?.value, '#coupon-input'); return; }
  if (act === 'co-coupon') { await applyCoupon($('#co-coupon')?.value, '#co-coupon'); return; }
  if (act === 'coupon-remove') { state.coupon = null; state.couponData = null; if (state.cartOpen) renderCartDrawer(); if (state.page === 'checkout') renderRoute(); return; }
  if (act === 'cat') { state.category = btn.dataset.cat || ''; $$('.s-cats button').forEach((b) => b.classList.toggle('on', b.dataset.cat === state.category)); updateGrid(); return; }
  if (act === 'layout') { state.layout = btn.dataset.layout; $$('.s-view-toggle button').forEach((b) => b.classList.toggle('on', b.dataset.layout === state.layout)); updateGrid(); return; }
  if (act === 'lang') { setLang(btn.dataset.lang); return; }
  if (act === 'share') { await shareStore(); return; }
  if (act === 'terms') { showTerms(); return; }
  if (act === 'free-download') { freeDownload(btn.dataset.id); return; }
  if (act === 'retry-pay') { if (state.order) await startYouCanPay({ order_no: state.order.order_no, token: state.orderToken }); return; }
  if (act === 'copy-order') { await copyText(orderUrl({ order_no: state.orderNo, token: state.orderToken })); sToast(t('orderLinkCopied')); return; }
  if (act === 'download-file') { api.track(state.slug, 'link_click', '', location.pathname, state.visitor, document.referrer).catch(() => {}); return; }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'store-search') { state.query = e.target.value; updateGrid(); }
});
document.addEventListener('change', (e) => {
  if (e.target.name === 'co-method') state.checkoutMethod = e.target.value;
});
document.addEventListener('submit', async (e) => {
  if (e.target.id === 'checkout-form') { e.preventDefault(); await submitCheckout(e); }
  if (e.target.id === 'claim-form') {
    e.preventDefault();
    const ref = $('#claim-ref')?.value.trim() || '';
    try { await api.claimPaid(state.slug, state.orderNo, state.orderToken, ref); sToast(t('claimSuccess'), 4500); e.target.innerHTML = `<div class="s-instructions">${t('claimSuccess')}</div>`; }
    catch (err) { sToast(api.errorText(err), 4000); }
  }
  if (e.target.id === 'track-form') {
    e.preventDefault();
    const no = $('#track-no')?.value.trim(), tk = $('#track-token')?.value.trim();
    if (!no || !tk) return sToast(t('orderNotFoundText'), 3000);
    state.orderNo = no; state.orderToken = tk; state.order = null;
    const o = await loadOrder();
    if (o) goOrder({ order_no: no, token: tk }, true); else { sToast(t('orderNotFound'), 3500); renderRoute(); }
  }
});
window.addEventListener('popstate', () => {
  const p = new URLSearchParams(location.search);
  state.page = p.get('order') ? 'order' : p.get('checkout') === '1' ? 'checkout' : 'home';
  state.orderNo = p.get('order') || ''; state.orderToken = p.get('t') || ''; state.order = null;
  renderRoute();
});

function updateGrid() {
  const wrap = document.getElementById('products-wrap');
  if (wrap) wrap.innerHTML = gridHTML();
  const count = document.getElementById('products-count');
  if (count) count.textContent = `${visibleProducts().length} ${t('itemsShort')}`;
}
function setLang(l) {
  if (!['ar', 'en', 'fr'].includes(l)) return;
  state.lang = l;
  try { localStorage.setItem('rabiti_lang_' + state.slug, l); } catch { /* ignore */ }
  closeProduct(); closeCart(); renderRoute();
}
async function shareStore() {
  const url = homeUrl();
  const title = state.payload?.profile?.name || t('store');
  api.track(state.slug, 'share', '', location.pathname, state.visitor, document.referrer).catch(() => {});
  if (navigator.share) { try { await navigator.share({ title, text: t('shareText'), url }); return; } catch { /* cancelled */ } }
  await copyText(url); sToast(t('copied'));
}
function showTerms() {
  const terms = state.payload?.shop?.terms || '';
  if (!terms) return;
  let rootEl = document.getElementById('modal-root');
  if (!rootEl) { rootEl = document.createElement('div'); rootEl.id = 'modal-root'; document.body.appendChild(rootEl); }
  rootEl.innerHTML = `<div class="s-overlay" data-s-act="modal-close"></div><div class="s-modal"><div class="s-modal-box" style="grid-template-columns:1fr;width:min(560px,100%)"><div class="s-modal-body"><h2 style="font-size:19px;margin:0 0 10px">${t('terms')}</h2><p style="font-size:12.5px;line-height:1.9;white-space:pre-line;color:var(--s-ink-2)">${esc(terms)}</p><div class="actions" style="margin-top:16px"><button class="s-btn fill" data-s-act="modal-close">${t('close')}</button></div></div></div></div>`;
  document.body.classList.add('lock');
}
function freeDownload(id) {
  const p = products().find((x) => x.id === id);
  if (!p || p.mode !== 'file' || !p.data) return;
  const a = document.createElement('a'); a.href = p.data; a.download = p.fn || 'download'; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
  api.track(state.slug, 'link_click', id, location.pathname, state.visitor, document.referrer).catch(() => {});
}

boot();
