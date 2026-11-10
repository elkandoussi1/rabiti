/*
 * PostgreSQL/PGlite end-to-end tests for the Rabiti v2 schema.
 *
 * The test creates the same roles Supabase provides, applies schema.sql and
 * v2.sql in order, then exercises the public and owner-facing RPCs with the
 * same permissions a real project uses.
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');

const read = (path) => fs.readFileSync(path, 'utf8');
const USER_A = '11111111-1111-1111-1111-111111111111';
const USER_B = '22222222-2222-2222-2222-222222222222';
const TOKEN = /^[a-f0-9]{64}$/;
const ORDER_NO = /^RB-[A-F0-9]{10}$/;

async function rejects(promise, pattern) {
  try {
    await promise;
  } catch (error) {
    assert.match(String(error?.message || error), pattern);
    return;
  }
  assert.fail(`expected rejection matching ${pattern}`);
}

(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  await db.exec(read('supabase/schema.sql'));
  await db.exec(read('supabase/v2.sql'));
  await db.query('insert into auth.users(id) values($1),($2)', [USER_A, USER_B]);

  async function as(role, uid = '') {
    await db.exec('reset role');
    await db.exec(`set role ${role}`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  }

  const baseDraft = {
    lang: 'ar',
    profile: { name: 'Teacher', bio: 'Digital workbooks', avatar: '', location: 'Rabat' },
    design: { theme: 'sand' },
    shop: { currency: 'MAD', whatsapp: '212600000000', email: 'shop@example.com' },
    checkout: { mode: 'manual', note: 'Send the transfer reference.', youcanpay: { enabled: false, publicKey: '', sandbox: true } },
    pay: [
      { id: 'bank', t: 'Bank transfer', d: 'RIB 123', u: '', kind: 'bank', on: 1 },
      { id: 'hidden-pay', t: 'Hidden', d: 'nope', u: '', kind: 'bank', on: 0 }
    ],
    links: [
      { id: 'site', t: 'Website', u: 'https://example.com', kind: 'website', on: 1 },
      { id: 'hidden-link', t: 'Hidden', u: 'https://example.com/hidden', kind: 'website', on: 0 }
    ],
    products: [
      {
        id: 'book', t: 'Workbook', d: 'Full details', pr: '49', cur: 'MAD', on: 1, mode: 'paid',
        badge: 'New', category: 'Books', deliveryNote: 'Instant download',
        src: { type: 'url', url: 'https://example.com/private.pdf', fn: 'book.pdf' }
      },
      { id: 'free', t: 'Free guide', d: 'Free', pr: '', on: 1, mode: 'link', link: 'https://example.com/free' },
      { id: 'hidden-product', t: 'Hidden product', pr: '10', on: 0, mode: 'paid', src: { type: 'url', url: 'https://example.com/hidden.pdf' } },
      { id: 'sample', t: 'Sample file', pr: '', on: 1, mode: 'file', fn: 'sample.txt', data: 'data:text/plain;base64,SGk=' }
    ]
  };
  const clone = (value) => JSON.parse(JSON.stringify(value));

  /* ---------------- owner setup and first publication ---------------- */
  await as('authenticated', USER_A);
  await db.query('insert into public.rabiti_stores(owner_id,slug,draft) values($1,$2,$3)', [
    USER_A, 'teacher', JSON.stringify(baseDraft)
  ]);

  assert.equal((await db.query("select public.rabiti_slug_available('new-store') as ok")).rows[0].ok, true);
  assert.equal((await db.query("select public.rabiti_slug_available('teacher') as ok")).rows[0].ok, false);
  assert.equal((await db.query("select public.rabiti_slug_available('ab') as ok")).rows[0].ok, false);

  assert.equal((await db.query('select public.rabiti_publish(0) as slug')).rows[0].slug, 'teacher');
  let page = (await db.query("select payload,revision from public.rabiti_pages where slug='teacher'")).rows[0];
  assert.equal(page.revision, 0);
  const payload = page.payload;
  assert.equal(payload.version, 2);
  assert.equal(payload.profile.name, 'Teacher');
  assert.equal(payload.profile.location, 'Rabat');
  assert.equal(payload.checkout.mode, 'manual');
  assert.deepEqual(payload.products.map((p) => p.id), ['book', 'free', 'sample']);
  assert.deepEqual(payload.links.map((l) => l.id), ['site']);
  assert.deepEqual(payload.pay.map((m) => m.id), ['bank']);
  const book = payload.products.find((p) => p.id === 'book');
  assert.equal(book.mode, 'paid');
  assert.equal(book.badge, 'New');
  assert.equal(book.src, undefined);
  assert.equal(book.link, '');
  assert.equal(payload.products.find((p) => p.id === 'free').link, 'https://example.com/free');
  assert.equal(payload.products.find((p) => p.id === 'sample').data, 'data:text/plain;base64,SGk=');
  const serialized = JSON.stringify(payload);
  for (const secret of ['private.pdf', 'hidden.pdf', 'hidden-product', 'hidden-pay', 'hidden-link']) {
    assert.equal(serialized.includes(secret), false, `${secret} leaked into the public payload`);
  }

  /* ---------------- revisions and save/publish ordering ---------------- */
  const edited = clone(baseDraft);
  edited.profile.name = 'Teacher Edited';
  const saved = await db.query('select public.rabiti_save($1,0) as revision', [JSON.stringify(edited)]);
  assert.equal(saved.rows[0].revision, 1);
  await rejects(
    db.query('select public.rabiti_save($1,0)', [JSON.stringify(baseDraft)]),
    /REVISION_CONFLICT/
  );
  assert.equal((await db.query('select public.rabiti_publish(1) as slug')).rows[0].slug, 'teacher');
  page = (await db.query("select payload,revision from public.rabiti_pages where slug='teacher'")).rows[0];
  assert.equal(page.revision, 1);
  assert.equal(page.payload.profile.name, 'Teacher Edited');

  /* ---------------- publication guards ---------------- */
  let revision = 1;
  async function saveDraft(draft) {
    const result = await db.query('select public.rabiti_save($1,$2) as revision', [JSON.stringify(draft), revision]);
    revision = result.rows[0].revision;
    return revision;
  }
  async function expectPublishError(draft, pattern) {
    const next = await saveDraft(draft);
    await rejects(db.query('select public.rabiti_publish($1)', [next]), pattern);
  }

  const noSource = clone(baseDraft);
  noSource.products[0].src.url = '';
  await expectPublishError(noSource, /PAID_SOURCE_REQUIRED/);

  const badLink = clone(baseDraft);
  badLink.products[1].link = 'javascript:alert(1)';
  await expectPublishError(badLink, /INVALID_LINK_URL/);

  const noMethod = clone(baseDraft);
  noMethod.pay = [];
  noMethod.checkout.youcanpay.enabled = false;
  await expectPublishError(noMethod, /PAYMENT_METHOD_REQUIRED/);

  const enabledWithoutKeys = clone(baseDraft);
  enabledWithoutKeys.checkout.youcanpay.enabled = true;
  await expectPublishError(enabledWithoutKeys, /PAYMENT_NOT_CONFIGURED/);

  await rejects(
    db.query("select public.rabiti_set_youcanpay('bad-key','bad-key',false,true)"),
    /INVALID_PUBLIC_KEY/
  );
  const ycpStatus = await db.query("select public.rabiti_set_youcanpay('pub_sandbox_test','pri_sandbox_test',true,true) as status");
  assert.equal(ycpStatus.rows[0].status.enabled, true);
  assert.equal(ycpStatus.rows[0].status.publicKey, 'pub_sandbox_test');
  assert.equal(ycpStatus.rows[0].status.hasPrivateKey, true);
  assert.equal(ycpStatus.rows[0].status.private_key, undefined);
  const readStatus = await db.query('select public.rabiti_youcanpay_status() as status');
  assert.equal(readStatus.rows[0].status.hasPrivateKey, true);
  assert.equal(JSON.stringify(readStatus.rows[0].status).includes('pri_sandbox_test'), false);

  const withYcp = clone(baseDraft);
  withYcp.checkout.youcanpay = { enabled: true, publicKey: 'pub_sandbox_test', sandbox: true };
  await saveDraft(withYcp);
  await db.query('select public.rabiti_publish($1)', [revision]);
  page = (await db.query("select payload from public.rabiti_pages where slug='teacher'")).rows[0];
  assert.equal(page.payload.checkout.youcanpay.enabled, true);
  assert.equal(page.payload.checkout.youcanpay.publicKey, 'pub_sandbox_test');
  assert.equal(JSON.stringify(page.payload).includes('pri_sandbox_test'), false);

  /* ---------------- coupons ---------------- */
  await db.query(
    "insert into public.rabiti_discounts(store_slug,code,kind,value,min_subtotal) values('teacher','SAVE10','percent',10,0)"
  );
  const validCoupon = await db.query("select public.rabiti_validate_coupon('teacher','save 10',4900) as c");
  assert.equal(validCoupon.rows[0].c.valid, true);
  assert.equal(validCoupon.rows[0].c.discount_minor, 490);
  await db.query("update public.rabiti_discounts set min_subtotal=10000 where code='SAVE10'");
  const tooSmall = await db.query("select public.rabiti_validate_coupon('teacher','SAVE10',4900) as c");
  assert.equal(tooSmall.rows[0].c.valid, false);
  await db.query("update public.rabiti_discounts set min_subtotal=0 where code='SAVE10'");

  /* ---------------- order 1: manual payment, claim, delivery, refund ---------------- */
  await as('anon');
  const created1 = await db.query(
    "select public.rabiti_create_order('teacher','[{\"id\":\"book\",\"qty\":1}]'::jsonb,'{\"name\":\"Buyer One\",\"email\":\"buyer@example.com\",\"phone\":\"0600000000\"}'::jsonb,'SAVE10','bank') as o"
  );
  const order1 = created1.rows[0].o;
  assert.match(order1.order_no, ORDER_NO);
  assert.match(order1.token, TOKEN);
  assert.equal(order1.status, 'pending');
  assert.equal(order1.subtotal_minor, 4900);
  assert.equal(order1.discount_minor, 490);
  assert.equal(order1.total_minor, 4410);
  assert.equal(order1.currency, 'MAD');
  assert.equal(order1.coupon, 'SAVE10');
  assert.equal(order1.payment_method, 'bank');

  assert.equal(
    (await db.query("select public.rabiti_order_status('teacher',$1,$2) as s", [order1.order_no, 'a'.repeat(64)])).rows[0].s,
    null
  );
  const status1 = (await db.query("select public.rabiti_order_status('teacher',$1,$2) as s", [order1.order_no, order1.token])).rows[0].s;
  assert.equal(status1.status, 'pending');
  assert.equal(status1.can_download, false);
  assert.equal(Object.hasOwn(status1, 'notes'), false);
  assert.equal(Object.hasOwn(status1, 'metadata'), false);
  assert.equal(
    (await db.query("select public.rabiti_order_download('teacher',$1,$2,'book') as d", [order1.order_no, order1.token])).rows[0].d,
    null
  );
  assert.equal(
    (await db.query("select public.rabiti_order_download('teacher',$1,$2,'free') as d", [order1.order_no, order1.token])).rows[0].d,
    null
  );
  assert.equal(
    (await db.query("select public.rabiti_order_claim_paid('teacher',$1,$2,'TRX-123') as ok", [order1.order_no, order1.token])).rows[0].ok,
    true
  );
  const claimed = (await db.query("select public.rabiti_order_status('teacher',$1,$2) as s", [order1.order_no, order1.token])).rows[0].s;
  assert.equal(claimed.payment_ref, 'TRX-123');
  assert.equal(claimed.status, 'pending');

  await as('authenticated', USER_A);
  assert.equal((await db.query('select public.rabiti_order_mark_paid($1) as r', [order1.id])).rows[0].r.status, 'delivered');
  const delivered = (await db.query("select public.rabiti_order_status('teacher',$1,$2) as s", [order1.order_no, order1.token])).rows[0].s;
  assert.equal(delivered.status, 'delivered');
  assert.equal(delivered.can_download, true);
  const download1 = (await db.query("select public.rabiti_order_download('teacher',$1,$2,'book') as d", [order1.order_no, order1.token])).rows[0].d;
  assert.equal(download1.url, 'https://example.com/private.pdf');
  assert.equal(download1.filename, 'book.pdf');
  assert.equal((await db.query("select count(*)::int as n from public.rabiti_discounts where code='SAVE10' and uses=1")).rows[0].n, 1);

  const events1 = await db.query('select type from public.rabiti_order_events where order_id=$1 order by id', [order1.id]);
  assert.deepEqual(events1.rows.map((r) => r.type), ['created', 'buyer_claimed_paid', 'marked_paid']);

  const stats1 = (await db.query('select public.rabiti_stats() as s')).rows[0].s;
  assert.equal(stats1.orders_total, 1);
  assert.equal(stats1.orders_paid, 1);
  assert.equal(stats1.orders_pending, 0);
  assert.equal(stats1.revenue_minor, 4410);
  assert.equal(stats1.daily.length, 30);
  assert.equal(stats1.top_products[0].id, 'book');
  assert.equal(stats1.top_products[0].revenue_minor, 4900);

  assert.equal((await db.query('select public.rabiti_order_refund($1) as r', [order1.id])).rows[0].r.status, 'refunded');
  assert.equal(
    (await db.query("select public.rabiti_order_download('teacher',$1,$2,'book') as d", [order1.order_no, order1.token])).rows[0].d,
    null
  );
  const refunded = (await db.query("select public.rabiti_order_status('teacher',$1,$2) as s", [order1.order_no, order1.token])).rows[0].s;
  assert.equal(refunded.status, 'refunded');
  assert.equal(refunded.can_download, false);
  const statsRefund = (await db.query('select public.rabiti_stats() as s')).rows[0].s;
  assert.equal(statsRefund.orders_paid, 0);
  assert.equal(statsRefund.revenue_minor, 0);

  /* ---------------- owner isolation and RLS ---------------- */
  await as('authenticated', USER_B);
  assert.equal((await db.query('select count(*)::int as n from public.rabiti_orders')).rows[0].n, 0);
  assert.equal((await db.query('select count(*)::int as n from public.rabiti_order_events')).rows[0].n, 0);
  await rejects(db.query('select public.rabiti_order_mark_paid($1)', [order1.id]), /ORDER_NOT_FOUND/);
  await rejects(db.query('select public.rabiti_stats()'), /STORE_REQUIRED/);

  /* ---------------- order 2: YouCan Pay secret lookup and manual delivery ---------------- */
  await as('anon');
  const created2 = await db.query(
    "select public.rabiti_create_order('teacher','[{\"id\":\"book\",\"qty\":2}]'::jsonb,'{\"name\":\"Buyer Two\",\"email\":\"buyer2@example.com\"}'::jsonb,'','bank') as o"
  );
  const order2 = created2.rows[0].o;
  assert.equal(order2.total_minor, 9800);

  await rejects(
    db.query('select public.rabiti_payment_secret_for_order($1,$2)', [order2.order_no, order2.token]),
    /permission denied/i
  );

  await as('service_role');
  const secret = (await db.query('select public.rabiti_payment_secret_for_order($1,$2) as s', [order2.order_no, order2.token])).rows[0].s;
  assert.equal(secret.store_slug, 'teacher');
  assert.equal(secret.private_key, 'pri_sandbox_test');
  assert.equal(secret.public_key, 'pub_sandbox_test');
  assert.equal(secret.sandbox, true);
  assert.equal(secret.status, 'pending');
  assert.equal(secret.total_minor, 9800);
  assert.equal(
    (await db.query('select public.rabiti_payment_secret_for_order($1,$2) as s', [order2.order_no, 'b'.repeat(64)])).rows[0].s,
    null
  );
  assert.equal((await db.query('select count(*)::int as n from public.rabiti_orders')).rows[0].n, 2);

  await as('authenticated', USER_A);
  assert.equal((await db.query('select public.rabiti_order_mark_paid($1) as r', [order2.id])).rows[0].r.status, 'delivered');

  /* ---------------- order 3: signed provider confirmation and idempotency ---------------- */
  await as('anon');
  const created3 = await db.query(
    "select public.rabiti_create_order('teacher','[{\"id\":\"book\",\"qty\":1}]'::jsonb,'{\"name\":\"Buyer Three\",\"email\":\"buyer3@example.com\"}'::jsonb,'','youcanpay') as o"
  );
  const order3 = created3.rows[0].o;
  assert.equal(order3.payment_method, 'youcanpay');
  assert.equal(order3.total_minor, 4900);

  await as('service_role');
  await rejects(
    db.query(
      "select public.rabiti_confirm_payment($1,'youcanpay','trx_wrong',5000,'MAD','evt_wrong','{}'::jsonb)",
      [order3.order_no]
    ),
    /PAYMENT_MISMATCH/
  );
  const confirmed = (await db.query(
    "select public.rabiti_confirm_payment($1,'youcanpay','trx_ok',4900,'MAD','evt_ok','{\"event\":\"transaction.paid\"}'::jsonb) as r",
    [order3.order_no]
  )).rows[0].r;
  assert.equal(confirmed.status, 'delivered');
  const duplicate = (await db.query(
    "select public.rabiti_confirm_payment($1,'youcanpay','trx_ok',4900,'MAD','evt_ok','{}'::jsonb) as r",
    [order3.order_no]
  )).rows[0].r;
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.status, 'delivered');
  assert.equal(
    (await db.query("select count(*)::int as n from public.rabiti_payment_events where provider='youcanpay' and event_id='evt_ok'")).rows[0].n,
    1
  );

  await as('anon');
  const download3 = (await db.query("select public.rabiti_order_download('teacher',$1,$2,'book') as d", [order3.order_no, order3.token])).rows[0].d;
  assert.equal(download3.url, 'https://example.com/private.pdf');

  /* ---------------- analytics ---------------- */
  await db.query("select public.rabiti_track('teacher','page_view','','/public.html','visitor-1','https://example.com')");
  await db.query("select public.rabiti_track('teacher','product_view','book','/public.html','visitor-1','')");
  await db.query("select public.rabiti_track('teacher','not-a-type','','','','')");
  await db.query("select public.rabiti_track('missing-store','page_view','','','','')");

  await as('authenticated', USER_A);
  const stats2 = (await db.query('select public.rabiti_stats() as s')).rows[0].s;
  assert.equal(stats2.orders_total, 3);
  assert.equal(stats2.orders_paid, 2);
  assert.equal(stats2.orders_pending, 0);
  assert.equal(stats2.revenue_minor, 9800 + 4900);
  assert.equal(stats2.views_30d, 1);
  assert.equal(stats2.visitors_30d, 1);
  assert.equal(stats2.product_views_30d, 1);
  assert.equal(stats2.daily.length, 30);
  assert.equal(stats2.top_products[0].id, 'book');
  assert.equal(stats2.top_products[0].revenue_minor, 14700);

  /* ---------------- slug change keeps pages and orders linked ---------------- */
  assert.equal((await db.query("select public.rabiti_change_slug('teacher-two') as s")).rows[0].s, 'teacher-two');
  assert.equal((await db.query("select count(*)::int as n from public.rabiti_pages where slug='teacher-two'")).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int as n from public.rabiti_orders where store_slug='teacher-two'")).rows[0].n, 3);
  assert.equal((await db.query("select public.rabiti_change_slug('teacher') as s")).rows[0].s, 'teacher');

  /* ---------------- secret removal ---------------- */
  await db.query('select public.rabiti_clear_youcanpay()');
  const cleared = (await db.query('select public.rabiti_youcanpay_status() as s')).rows[0].s;
  assert.equal(cleared.enabled, false);
  assert.equal(cleared.hasPrivateKey, false);
  await as('service_role');
  assert.equal(
    (await db.query('select public.rabiti_payment_secret_for_order($1,$2) as s', [order2.order_no, order2.token])).rows[0].s,
    null
  );

  await db.close();
  console.log('PASS schema: publish, secrets, coupons, orders, delivery, refunds, RLS, stats, slug and payment confirmation');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
