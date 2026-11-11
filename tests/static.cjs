/*
 * Static release checks: files that must exist, files that must be gone,
 * PWA/version consistency, local asset references and legacy references.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const rel = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

/* ---------------- required files ---------------- */
const required = [
  'index.html', 'public.html', 'app.js', 'views.js', 'api.js', 'ui.js', 'public.js',
  'app.css', 'store.css', 'sw.js', 'app-update.js', 'manifest.webmanifest', 'release.json',
  'config.js', 'supabase.min.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png',
  'supabase/schema.sql', 'supabase/v2.sql', 'supabase/v3-receipts.sql',
  'supabase/functions/youcanpay-tokenize/index.ts',
  'supabase/functions/youcanpay-webhook/index.ts',
  'supabase/functions/rabiti-receipt/index.ts',
  'tests/schema.cjs', 'tests/units.mjs', 'tests/static.cjs', 'tests/functions.cjs',
  'README.md', 'SETUP-AR.md', 'AUTOMATIC-PAYMENTS.md', 'TESTING.md', 'CHANGELOG.md',
  'SECURITY-STATUS.md', 'ACTIVATION-STATUS.md', 'CONTRIBUTING.md', 'THIRD-PARTY.txt'
];
for (const file of required) assert.equal(exists(file), true, `missing ${file}`);

/* ---------------- removed files ---------------- */
const removed = [
  'cloud.js', 'commerce-editor.js', 'paid-editor.js', 'store-renderer.js', 'commerce.css',
  'GUMROAD-SETUP.md', 'README.txt', 'supabase/paid-delivery.sql', 'supabase/external-checkout.sql',
  'tests/database.cjs', 'tests/paid.cjs', 'tests/ui.cjs', 'tests/paid-ui.cjs',
  'tests/checkout.cjs', 'tests/commerce-ui.cjs', 'tests/_smoke-v2.cjs'
];
for (const file of removed) assert.equal(exists(file), false, `legacy file still present: ${file}`);

/* ---------------- no legacy references ---------------- */
const legacyPatterns = [
  /local=1/i,
  /gumroad/i,
  /cloud\.js/i,
  /commerce-editor/i,
  /paid-editor/i,
  /store-renderer/i,
  /commerce\.css/i,
  /paid-delivery\.sql/i,
  /external-checkout\.sql/i,
  /index\.html\?local/i
];
const scanFiles = walk('.')
  .filter((file) => !/\.(png|jpg|jpeg|webp|gif|ico|woff2?|ttf|otf|apk|zip)$/i.test(file))
  .filter((file) => file !== 'package-lock.json')
  .filter((file) => file !== 'tests/static.cjs');
for (const file of scanFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const pattern of legacyPatterns) {
    assert.equal(pattern.test(text), false, `${file} still references ${pattern}`);
  }
}

/* ---------------- shell and storefront wiring ---------------- */
const index = read('index.html');
const publicHtml = read('public.html');
assert.match(index, /<script src="config\.js"><\/script>/);
assert.match(index, /<script src="supabase\.min\.js"><\/script>/);
assert.match(index, /<script type="module" src="app\.js"><\/script>/);
assert.match(index, /<script src="app-update\.js" defer><\/script>/);
assert.match(index, /<link rel="stylesheet" href="app\.css">/);
assert.match(publicHtml, /<script type="module" src="public\.js"><\/script>/);
assert.match(publicHtml, /<link rel="stylesheet" href="store\.css">/);
assert.match(publicHtml, /<script src="config\.js"><\/script>/);
assert.match(publicHtml, /<script src="supabase\.min\.js"><\/script>/);
assert.equal(index.indexOf('config.js') < index.indexOf('supabase.min.js'), true);
assert.equal(index.indexOf('supabase.min.js') < index.indexOf('app.js'), true);
assert.equal(publicHtml.indexOf('config.js') < publicHtml.indexOf('public.js'), true);

const localRefs = (html) => [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map((match) => match[1])
  .filter((ref) => !/^(?:https?:|data:|mailto:|tel:|#)/i.test(ref));
for (const [file, html] of [['index.html', index], ['public.html', publicHtml]]) {
  for (const ref of localRefs(html)) {
    const clean = ref.split(/[?#]/)[0];
    assert.equal(exists(clean), true, `${file} references missing ${clean}`);
  }
}

/* ---------------- service worker and PWA ---------------- */
const sw = read('sw.js');
const cache = /const CACHE = "([^"]+)";/.exec(sw)?.[1] || '';
assert.match(cache, /^rabiti-v\d+-v2$/);
const assetsBlock = /const ASSETS = \[([\s\S]*?)\];/.exec(sw)?.[1] || '';
const assets = [...assetsBlock.matchAll(/"\.\/([^"]+)"/g)].map((match) => match[1]);
for (const file of assets) assert.equal(exists(file), true, `service worker caches missing ${file}`);
for (const file of [
  'index.html', 'public.html', 'app.css', 'store.css', 'ui.js', 'api.js', 'views.js',
  'app.js', 'public.js', 'app-update.js', 'config.js', 'supabase.min.js',
  'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'
]) {
  assert.equal(assets.includes(file), true, `service worker does not cache ${file}`);
}
assert.equal(assets.some((file) => /cloud\.js|store-renderer|commerce|paid-editor/.test(file)), false);

const manifest = JSON.parse(read('manifest.webmanifest'));
assert.equal(manifest.start_url, './index.html');
assert.equal(manifest.scope, './');
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.lang, 'ar');
assert.equal(manifest.dir, 'rtl');
for (const icon of manifest.icons) assert.equal(exists(icon.src), true, `manifest icon missing ${icon.src}`);

const release = JSON.parse(read('release.json'));
const update = read('app-update.js');
assert.equal(release.name, 'Rabiti 2.1');
assert.match(release.date, /^\d{4}-\d{2}-\d{2}$/);
assert.match(update, new RegExp(`const version = "${release.version.replace(/\./g, '\\.')}";`));
assert.match(update, /RABITI_APP\?\.persist/);
assert.match(update, /\.overlay/);
assert.match(update, /release\.json/);

/* ---------------- public configuration and payment flow ---------------- */
const config = read('config.js');
assert.match(config, /window\.RABITI_CONFIG/);
assert.equal(/sb_secret_|SUPABASE_SERVICE_ROLE_KEY|pri_live_|pri_sandbox_/.test(config), false);

const storefront = read('public.js');
assert.match(storefront, /youcanpay-tokenize/);
assert.match(storefront, /elements\.confirm\(\)/);
assert.match(storefront, /result\?\.status === 'succeeded'/);
assert.match(storefront, /safeUrl/);
assert.match(storefront, /functions\/v1\/rabiti-receipt/);
assert.match(storefront, /claim-file/);
assert.equal(/gumroad|Gumroad/.test(storefront), false);

/* ---------------- SQL and Edge Function surface ---------------- */
const sql = read('supabase/v2.sql');
assert.match(sql, /create or replace function public\.rabiti_confirm_payment\(/);
assert.match(sql, /grant execute on function public\.rabiti_confirm_payment\([^)]*\) to service_role/);
assert.match(sql, /revoke all on function[\s\S]*public\.rabiti_confirm_payment/);
assert.match(sql, /rabiti_payment_secret_for_order/);
assert.match(sql, /PAID_SOURCE_REQUIRED/);
assert.match(sql, /PAYMENT_METHOD_REQUIRED/);
assert.match(sql, /INVALID_COUPON/);
assert.match(sql, /create table if not exists public\.rabiti_orders/);
assert.match(sql, /create table if not exists public\.rabiti_payment_secrets/);
assert.match(sql, /receipt_path text not null default ''/);
assert.match(sql, /p_receipt text default null/);
assert.match(sql, /'receipt_path', o\.receipt_path/);
assert.match(sql, /grant execute on function\s+rabiti_private\.rabiti_order_status\(text,text,text\),\s+rabiti_private\.rabiti_order_download\(text,text,text,text\)\s+to service_role/);
assert.equal(/create or replace function public\.rabiti_redeem/.test(sql), false);

const tokenize = read('supabase/functions/youcanpay-tokenize/index.ts');
const webhook = read('supabase/functions/youcanpay-webhook/index.ts');
assert.match(tokenize, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(tokenize, /rabiti_payment_secret_for_order/);
assert.match(tokenize, /order_no/);
assert.match(tokenize, /p_token/);
assert.match(tokenize, /public_key/);
assert.equal(/private_key\s*:/.test(tokenize.slice(tokenize.lastIndexOf('return json('))), false);
assert.match(webhook, /x-youcanpay-signature/);
assert.match(webhook, /HMAC/);
assert.match(webhook, /transaction\.paid/);
assert.match(webhook, /rabiti_confirm_payment/);
assert.match(webhook, /p_event_id/);

/* ---------------- receipt upload function ---------------- */
const receipt = read('supabase/functions/rabiti-receipt/index.ts');
assert.match(receipt, /Deno\.serve/);
assert.match(receipt, /req\.method === "OPTIONS"/);
assert.match(receipt, /req\.method !== "POST"/);
assert.match(receipt, /req\.formData\(\)/);
assert.match(receipt, /\^\[a-f0-9\]\{64\}\$/);
assert.match(receipt, /5 \* 1024 \* 1024/);
assert.match(receipt, /rabiti_order_status/);
assert.match(receipt, /order\.status !== "pending"/);
assert.match(receipt, /storage\/v1\/object\/rabiti-receipts/);
assert.match(receipt, /x-upsert/);
assert.match(receipt, /p_receipt: path/);
assert.match(receipt, /method: "DELETE"/);
assert.match(receipt, /authHeaders\(serviceKey\)/);
assert.equal(receipt.includes('Authorization: `Bearer ${serviceKey}`'), false);
assert.equal(/console\.(?:log|info|debug)/.test(receipt), false);

/* ---------------- package scripts ---------------- */
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.type, 'module');
for (const test of ['tests/schema.cjs', 'tests/units.mjs', 'tests/static.cjs', 'tests/functions.cjs']) {
  assert.match(pkg.scripts.test, new RegExp(test.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

console.log('PASS static: files, PWA version, assets, legacy removal, SQL surface and package scripts');
