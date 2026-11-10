/*
 * Edge Function checks. The webhook HMAC helper is plain JavaScript inside the
 * TypeScript file, so the test extracts it and runs it with Node's Web Crypto.
 */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHmac, webcrypto } = require('node:crypto');

const read = (file) => fs.readFileSync(file, 'utf8');
const tokenize = read('supabase/functions/youcanpay-tokenize/index.ts');
const webhook = read('supabase/functions/youcanpay-webhook/index.ts');
const sql = read('supabase/v2.sql');

/* ---------------- tokenization function ---------------- */
assert.match(tokenize, /Deno\.serve/);
assert.match(tokenize, /req\.method === "OPTIONS"/);
assert.match(tokenize, /req\.method !== "POST"/);
assert.match(tokenize, /orderToken/);
assert.match(tokenize, /\^\[a-f0-9\]\{64\}\$/);
assert.match(tokenize, /isHttpUrl\(successUrl\)/);
assert.match(tokenize, /isHttpUrl\(errorUrl\)/);
assert.match(tokenize, /SUPABASE_URL/);
assert.match(tokenize, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(tokenize, /rabiti_payment_secret_for_order/);
assert.match(tokenize, /p_order_no: orderNo/);
assert.match(tokenize, /p_token: orderToken/);
assert.match(tokenize, /secret\.enabled/);
assert.match(tokenize, /secret\.public_key/);
assert.match(tokenize, /secret\.private_key/);
assert.match(tokenize, /secret\.status !== "pending"/);
assert.match(tokenize, /Number\.isInteger\(amount\)/);
assert.match(tokenize, /\^\[A-Z\]\{3\}\$/);
assert.match(tokenize, /youcanpay\.com\/sandbox\/api\/tokenize/);
assert.match(tokenize, /youcanpay\.com\/api\/tokenize/);
assert.match(tokenize, /pri_key: String\(secret\.private_key\)/);
assert.match(tokenize, /token: String\(token\)/);
assert.match(tokenize, /public_key: String\(secret\.public_key\)/);
assert.match(tokenize, /sandbox,/);
assert.equal(/console\.(?:log|info|debug)\([^)]*private_key/.test(tokenize), false);
assert.equal(/json\([^)]*private_key/.test(tokenize), false);
assert.equal(tokenize.includes('pri_key: String(secret.private_key)'), true);
assert.equal(tokenize.slice(tokenize.lastIndexOf('return json(')).includes('private_key'), false);

/* ---------------- webhook static security properties ---------------- */
assert.match(webhook, /Deno\.serve/);
assert.match(webhook, /req\.method !== "POST"/);
assert.match(webhook, /const raw = await req\.text\(\)/);
assert.match(webhook, /x-youcanpay-signature/);
assert.match(webhook, /crypto\.subtle\.importKey/);
assert.match(webhook, /name: "HMAC", hash: "SHA-256"/);
assert.match(webhook, /crypto\.subtle\.sign\("HMAC"/);
assert.match(webhook, /safeEqual/);
assert.match(webhook, /sandbox_mismatch/);
assert.match(webhook, /transaction\.paid/);
assert.match(webhook, /invalid_amount/);
assert.match(webhook, /rpc\/rabiti_confirm_payment/);
assert.match(webhook, /p_event_id: eventId/);
assert.match(webhook, /p_provider: "youcanpay"/);
assert.equal(/console\.(?:log|info|debug)\([^)]*private_key/.test(webhook), false);
assert.equal(/json\([^)]*private_key/.test(webhook), false);

/* ---------------- extract and exercise the HMAC helper ---------------- */
const start = webhook.indexOf('const encoder = new TextEncoder();');
const end = webhook.indexOf('Deno.serve');
assert.equal(start >= 0 && end > start, true, 'could not locate the webhook HMAC helper');
const logic = `${webhook.slice(start, end)
  .replace('(body: unknown, status = 200)', '(body, status = 200)')
  .replaceAll('(bytes: ArrayBuffer)', '(bytes)')
  .replace('(a: string, b: string)', '(a, b)')
  .replace('(raw: string, secret: string, header: string)', '(raw, secret, header)')}
globalThis.signatureMatches = signatureMatches;`;
const context = vm.createContext({
  crypto: webcrypto,
  TextEncoder,
  btoa,
  console: { error: () => {} }
});
vm.runInContext(logic, context);
const signatureMatches = context.signatureMatches;
assert.equal(typeof signatureMatches, 'function');

const raw = JSON.stringify({ event: 'transaction.paid', transaction: { order_id: 'RB-ABC', amount: 4900 } });
const secret = 'pri_sandbox_test';
const digest = createHmac('sha256', secret).update(raw).digest();
const hex = digest.toString('hex');
const base64 = digest.toString('base64').toLowerCase();

(async () => {
  assert.equal(await signatureMatches(raw, secret, hex), true);
  assert.equal(await signatureMatches(raw, secret, `sha256=${hex}`), true);
  assert.equal(await signatureMatches(raw, secret, hex.toUpperCase()), true);
  assert.equal(await signatureMatches(raw, secret, base64), true);
  assert.equal(await signatureMatches(raw, 'pri_wrong', hex), false);
  assert.equal(await signatureMatches(raw, secret, ''), false);
  assert.equal(await signatureMatches(`${raw} `, secret, hex), false);

  /* ---------------- SQL contract used by the functions ---------------- */
  assert.match(sql, /create or replace function public\.rabiti_payment_secret_for_order\(p_order_no text, p_token text\)/);
  assert.match(sql, /o\.access_token = p_token/);
  assert.match(sql, /create or replace function public\.rabiti_confirm_payment\(/);
  assert.match(sql, /p_amount_minor is distinct from o\.total_minor/);
  assert.match(sql, /p_event_id/);
  assert.match(sql, /grant select on public\.rabiti_orders, public\.rabiti_payment_secrets,[\s\S]*?to service_role/);

  console.log('PASS functions: tokenization contract, webhook HMAC, amount checks and service-role SQL surface');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
