-- Rabiti v2 — orders, coupons, analytics, payment connections and secure delivery.
-- Run once on an existing project that already has supabase/schema.sql applied.
-- For a new project run schema.sql first, then this file.
begin;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.money_minor(p_price text, p_currency text)
returns bigint
language plpgsql immutable set search_path='' as $$
declare
  v text;
  n numeric;
  e integer;
begin
  v := btrim(coalesce(p_price,''));
  if v = '' then return 0; end if;
  v := replace(replace(v,' ',''),',','.');
  v := regexp_replace(v,'[^0-9.\-]','','g');
  if v = '' or v !~ '^-?[0-9]+(\.[0-9]+)?$' then return 0; end if;
  n := v::numeric;
  e := case upper(coalesce(p_currency,'MAD'))
    when 'JPY' then 0 when 'KRW' then 0 when 'VND' then 0 when 'CLP' then 0
    when 'KWD' then 3 when 'BHD' then 3 when 'OMR' then 3
    else 2 end;
  return round(n * power(10,e))::bigint;
end $$;

create or replace function rabiti_private.safe_https(p text)
returns boolean
language sql immutable set search_path='' as $$
  select coalesce(p,'') ~* '^https://[^[:space:]]+$';
$$;

-- A public snapshot is built here, never in the browser, so delivery sources
-- and payment secrets cannot leak into the published page.
create or replace function rabiti_private.rabiti_public_payload(p_draft jsonb)
returns jsonb
language sql immutable set search_path='' as $$
  select jsonb_build_object(
    'version', 2,
    'lang', coalesce(p_draft->>'lang','ar'),
    'profile', jsonb_build_object(
      'name', p_draft#>>'{profile,name}',
      'bio', p_draft#>>'{profile,bio}',
      'avatar', p_draft#>>'{profile,avatar}',
      'location', p_draft#>>'{profile,location}'
    ),
    'design', coalesce(p_draft->'design','{}'::jsonb),
    'texts', coalesce(p_draft->'texts','{}'::jsonb),
    'shop', jsonb_build_object(
      'currency', coalesce(nullif(p_draft#>>'{shop,currency}',''),'MAD'),
      'whatsapp', p_draft#>>'{shop,whatsapp}',
      'telegram', p_draft#>>'{shop,telegram}',
      'email', p_draft#>>'{shop,email}',
      'phone', p_draft#>>'{shop,phone}',
      'city', p_draft#>>'{shop,city}',
      'terms', p_draft#>>'{shop,terms}',
      'deliveryNote', p_draft#>>'{shop,deliveryNote}'
    ),
    'seo', jsonb_build_object(
      'title', p_draft#>>'{seo,title}',
      'description', p_draft#>>'{seo,description}',
      'image', p_draft#>>'{seo,image}'
    ),
    'sub', jsonb_build_object(
      'mode', p_draft#>>'{sub,mode}',
      'feed', p_draft#>>'{sub,feed}',
      'endpoint', p_draft#>>'{sub,endpoint}',
      'field', p_draft#>>'{sub,field}',
      'extra', p_draft#>>'{sub,extra}',
      'email', p_draft#>>'{sub,email}',
      'title', p_draft#>>'{sub,title}'
    ),
    'checkout', jsonb_build_object(
      'mode', coalesce(nullif(p_draft#>>'{checkout,mode}',''),'manual'),
      'note', p_draft#>>'{checkout,note}',
      'youcanpay', jsonb_build_object(
        'enabled', coalesce((p_draft#>>'{checkout,youcanpay,enabled}')::boolean,false),
        'publicKey', p_draft#>>'{checkout,youcanpay,publicKey}',
        'sandbox', coalesce((p_draft#>>'{checkout,youcanpay,sandbox}')::boolean,false)
      )
    ),
    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p->>'id',
        't', p->>'t',
        'd', p->>'d',
        'pr', p->>'pr',
        'cur', p->>'cur',
        'imgs', coalesce(p->'imgs','[]'::jsonb),
        'on', 1,
        'mode', p->>'mode',
        'badge', p->>'badge',
        'compareAt', p->>'compareAt',
        'category', p->>'category',
        'deliveryNote', p->>'deliveryNote',
        'link', case when p->>'mode'='link' then p->>'link' else '' end,
        'fn', case when p->>'mode'='file' then p->>'fn' else '' end,
        'data', case when p->>'mode'='file' then p->>'data' else '' end
      ) order by ord)
      from jsonb_array_elements(coalesce(p_draft->'products','[]'::jsonb)) with ordinality as t(p, ord)
      where coalesce(p->>'on','1') <> '0'
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', l->>'id', 't', l->>'t', 'u', l->>'u',
        'kind', l->>'kind', 'on', 1, 'icon', l->>'icon'
      ) order by ord)
      from jsonb_array_elements(coalesce(p_draft->'links','[]'::jsonb)) with ordinality as t(l, ord)
      where coalesce(l->>'on','1') <> '0'
    ), '[]'::jsonb),
    'pay', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m->>'id', 't', m->>'t', 'd', m->>'d', 'u', m->>'u',
        'kind', m->>'kind', 'on', 1
      ) order by ord)
      from jsonb_array_elements(coalesce(p_draft->'pay','[]'::jsonb)) with ordinality as t(m, ord)
      where coalesce(m->>'on','1') <> '0'
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- New tables
-- ---------------------------------------------------------------------------
create table if not exists public.rabiti_discounts (
  id uuid primary key default gen_random_uuid(),
  store_slug text not null references public.rabiti_stores(slug) on update cascade on delete cascade,
  code text not null,
  kind text not null default 'percent' check (kind in ('percent','fixed')),
  value integer not null check (value > 0),
  min_subtotal integer not null default 0 check (min_subtotal >= 0),
  max_uses integer not null default 0 check (max_uses >= 0),
  uses integer not null default 0 check (uses >= 0),
  starts_at timestamptz,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists rabiti_discounts_code_unique on public.rabiti_discounts(store_slug, upper(code));
create index if not exists rabiti_discounts_store on public.rabiti_discounts(store_slug, active);

create table if not exists public.rabiti_orders (
  id uuid primary key default gen_random_uuid(),
  store_slug text not null references public.rabiti_stores(slug) on update cascade on delete cascade,
  order_no text not null unique,
  access_token text not null check (access_token ~ '^[a-f0-9]{64}$'),
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text not null default '',
  items jsonb not null check (jsonb_typeof(items)='array'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  discount_minor bigint not null default 0 check (discount_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  currency text not null,
  coupon text not null default '',
  status text not null default 'pending' check (status in ('pending','paid','delivered','cancelled','refunded','failed')),
  payment_method text not null default '',
  payment_ref text not null default '',
  receipt_path text not null default '',
  provider text not null default '',
  provider_ref text not null default '',
  notes text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  delivered_at timestamptz
);
create index if not exists rabiti_orders_store_created on public.rabiti_orders(store_slug, created_at desc);
create index if not exists rabiti_orders_store_status on public.rabiti_orders(store_slug, status);
create index if not exists rabiti_orders_buyer on public.rabiti_orders(store_slug, lower(buyer_email));

create table if not exists public.rabiti_order_events (
  id bigserial primary key,
  order_id uuid not null references public.rabiti_orders(id) on delete cascade,
  type text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists rabiti_order_events_order on public.rabiti_order_events(order_id, created_at);

create table if not exists public.rabiti_payment_events (
  id bigserial primary key,
  provider text not null,
  event_id text not null,
  order_id uuid references public.rabiti_orders(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists rabiti_payment_events_unique on public.rabiti_payment_events(provider, event_id);

create table if not exists public.rabiti_events (
  id bigserial primary key,
  store_slug text not null references public.rabiti_stores(slug) on update cascade on delete cascade,
  type text not null check (type in ('page_view','product_view','checkout_start','link_click','share')),
  product_id text not null default '',
  path text not null default '',
  visitor text not null default '',
  referrer text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists rabiti_events_store_created on public.rabiti_events(store_slug, created_at desc);
create index if not exists rabiti_events_store_type on public.rabiti_events(store_slug, type, created_at desc);

create table if not exists public.rabiti_payment_secrets (
  store_slug text primary key references public.rabiti_stores(slug) on update cascade on delete cascade,
  provider text not null default 'youcanpay',
  public_key text not null default '',
  private_key text not null default '',
  sandbox boolean not null default false,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rabiti_pages add column if not exists revision integer not null default 0;

-- Keep the customer page linked when a store changes its slug.
do $$
declare c text;
begin
  select conname into c
  from pg_constraint
  where conrelid = 'public.rabiti_pages'::regclass
    and contype = 'f'
    and confrelid = 'public.rabiti_stores'::regclass;
  if c is not null then
    execute format('alter table public.rabiti_pages drop constraint %I', c);
  end if;
end $$;
alter table public.rabiti_pages
  add constraint rabiti_pages_slug_fkey
  foreign key (slug) references public.rabiti_stores(slug)
  on update cascade on delete cascade;

-- ---------------------------------------------------------------------------
-- Publishing and slug management
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_slug_available(p_slug text)
returns boolean
language sql security definer set search_path='' as $$
  select coalesce(p_slug,'') ~ '^[a-z0-9][a-z0-9-]{2,39}$'
     and not exists (select 1 from public.rabiti_stores where slug = p_slug);
$$;

create or replace function rabiti_private.rabiti_change_slug(p_slug text)
returns text
language plpgsql security definer set search_path='' as $$
declare old_slug text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if coalesce(p_slug,'') !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'INVALID_SLUG'; end if;
  select slug into old_slug from public.rabiti_stores where owner_id = auth.uid() for update;
  if not found then raise exception 'STORE_REQUIRED'; end if;
  if old_slug = p_slug then return p_slug; end if;
  if exists (select 1 from public.rabiti_stores where slug = p_slug) then raise exception 'SLUG_TAKEN'; end if;
  update public.rabiti_stores set slug = p_slug, updated_at = now() where owner_id = auth.uid();
  return p_slug;
end $$;

create or replace function rabiti_private.rabiti_publish(p_revision integer)
returns text
language plpgsql security definer set search_path='' as $$
declare
  s public.rabiti_stores;
  payload jsonb;
  has_paid boolean;
  has_method boolean;
  has_ycp boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.rabiti_stores where owner_id = auth.uid() for update;
  if not found then raise exception 'STORE_REQUIRED'; end if;
  if s.revision <> p_revision then raise exception 'REVISION_CONFLICT'; end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
    where coalesce(p->>'on','1') <> '0' and p->>'mode' = 'paid'
  ) into has_paid;

  if has_paid then
    if exists (
      select 1 from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
      where coalesce(p->>'on','1') <> '0' and p->>'mode' = 'paid'
        and (
          coalesce(p#>>'{src,type}','') not in ('url','file')
          or (p#>>'{src,type}' = 'url' and not rabiti_private.safe_https(p#>>'{src,url}'))
          or (p#>>'{src,type}' = 'file' and coalesce(p#>>'{src,data}','') = '')
        )
    ) then
      raise exception 'PAID_SOURCE_REQUIRED';
    end if;
  end if;

  if exists (
    select 1 from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
    where coalesce(p->>'on','1') <> '0' and p->>'mode' = 'link'
      and not rabiti_private.safe_https(p->>'link')
  ) then
    raise exception 'INVALID_LINK_URL';
  end if;

  select exists (
    select 1 from jsonb_array_elements(coalesce(s.draft->'pay','[]'::jsonb)) m
    where coalesce(m->>'on','1') <> '0'
  ) into has_method;

  select exists (
    select 1 from public.rabiti_payment_secrets y
    where y.store_slug = s.slug and y.provider = 'youcanpay'
      and y.enabled and y.public_key <> '' and y.private_key <> ''
  ) into has_ycp;

  if has_paid and not has_method and not has_ycp then
    raise exception 'PAYMENT_METHOD_REQUIRED';
  end if;
  if coalesce((s.draft#>>'{checkout,youcanpay,enabled}')::boolean,false) and not has_ycp then
    raise exception 'PAYMENT_NOT_CONFIGURED';
  end if;

  payload := rabiti_private.rabiti_public_payload(s.draft);
  payload := payload || jsonb_build_object('publishedAt', now(), 'revision', s.revision);
  insert into public.rabiti_pages(slug, payload, revision) values(s.slug, payload, s.revision)
  on conflict(slug) do update set payload = excluded.payload, revision = excluded.revision, published_at = now();
  return s.slug;
end $$;

-- Used by the dashboard for a live preview without publishing.
create or replace function rabiti_private.rabiti_preview()
returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.rabiti_stores;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into s from public.rabiti_stores where owner_id = auth.uid();
  if not found then raise exception 'STORE_REQUIRED'; end if;
  return rabiti_private.rabiti_public_payload(s.draft);
end $$;

-- ---------------------------------------------------------------------------
-- Payment connection (YouCan Pay — keys never reach the browser)
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_set_youcanpay(
  p_public_key text, p_private_key text, p_sandbox boolean, p_enabled boolean
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  slug text;
  existing_private text;
  next_private text;
  next_public text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select s.slug into slug from public.rabiti_stores s where s.owner_id = auth.uid();
  if not found then raise exception 'STORE_REQUIRED'; end if;

  next_public := btrim(coalesce(p_public_key,''));
  next_private := btrim(coalesce(p_private_key,''));
  select private_key into existing_private from public.rabiti_payment_secrets where store_slug = slug;
  if next_private = '' then next_private := coalesce(existing_private,''); end if;

  if next_public <> '' and next_public !~ '^pub_(sandbox_)?[A-Za-z0-9_\-]+$' then raise exception 'INVALID_PUBLIC_KEY'; end if;
  if next_private <> '' and next_private !~ '^pri_(sandbox_)?[A-Za-z0-9_\-]+$' then raise exception 'INVALID_PRIVATE_KEY'; end if;
  if p_enabled and (next_public = '' or next_private = '') then raise exception 'PAYMENT_KEYS_REQUIRED'; end if;

  insert into public.rabiti_payment_secrets(store_slug, provider, public_key, private_key, sandbox, enabled, updated_at)
  values(slug, 'youcanpay', next_public, next_private, coalesce(p_sandbox,false), coalesce(p_enabled,false), now())
  on conflict(store_slug) do update set
    provider = excluded.provider,
    public_key = excluded.public_key,
    private_key = excluded.private_key,
    sandbox = excluded.sandbox,
    enabled = excluded.enabled,
    updated_at = now();

  return jsonb_build_object(
    'enabled', coalesce(p_enabled,false),
    'publicKey', next_public,
    'sandbox', coalesce(p_sandbox,false),
    'hasPrivateKey', next_private <> ''
  );
end $$;

create or replace function rabiti_private.rabiti_youcanpay_status()
returns jsonb
language plpgsql security definer set search_path='' as $$
declare slug text; row public.rabiti_payment_secrets;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select s.slug into slug from public.rabiti_stores s where s.owner_id = auth.uid();
  if not found then raise exception 'STORE_REQUIRED'; end if;
  select * into row from public.rabiti_payment_secrets where store_slug = slug and provider = 'youcanpay';
  if not found then
    return jsonb_build_object('enabled',false,'publicKey','','sandbox',false,'hasPrivateKey',false);
  end if;
  return jsonb_build_object(
    'enabled', row.enabled,
    'publicKey', row.public_key,
    'sandbox', row.sandbox,
    'hasPrivateKey', row.private_key <> ''
  );
end $$;

create or replace function rabiti_private.rabiti_clear_youcanpay()
returns void
language plpgsql security definer set search_path='' as $$
declare slug text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select s.slug into slug from public.rabiti_stores s where s.owner_id = auth.uid();
  if not found then raise exception 'STORE_REQUIRED'; end if;
  delete from public.rabiti_payment_secrets where store_slug = slug and provider = 'youcanpay';
end $$;

-- Service-role only: the Edge Function needs the secret to tokenize a payment.
-- The caller must prove it holds the order's access token.
drop function if exists rabiti_private.rabiti_payment_secret_for_order(text);
create or replace function rabiti_private.rabiti_payment_secret_for_order(p_order_no text, p_token text)
returns jsonb
language sql security definer set search_path='' as $$
  select jsonb_build_object(
    'store_slug', o.store_slug,
    'order_no', o.order_no,
    'status', o.status,
    'total_minor', o.total_minor,
    'currency', o.currency,
    'provider', y.provider,
    'public_key', y.public_key,
    'private_key', y.private_key,
    'sandbox', y.sandbox,
    'enabled', y.enabled
  )
  from public.rabiti_orders o
  join public.rabiti_payment_secrets y on y.store_slug = o.store_slug and y.provider = 'youcanpay'
  where o.order_no = p_order_no
    and o.access_token = p_token
    and p_token ~ '^[a-f0-9]{64}$'
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Analytics (anonymous, privacy-friendly: a random visitor id only)
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_track(
  p_slug text, p_type text, p_product_id text default '', p_path text default '',
  p_visitor text default '', p_referrer text default ''
) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_type not in ('page_view','product_view','checkout_start','link_click','share') then return; end if;
  if not exists (select 1 from public.rabiti_pages where slug = p_slug) then return; end if;
  if length(coalesce(p_visitor,'')) > 64 or length(coalesce(p_path,'')) > 300 or length(coalesce(p_referrer,'')) > 300 then return; end if;
  insert into public.rabiti_events(store_slug, type, product_id, path, visitor, referrer)
  values(p_slug, p_type, left(coalesce(p_product_id,''),80), left(coalesce(p_path,''),300),
         left(coalesce(p_visitor,''),64), left(coalesce(p_referrer,''),300));
end $$;

create or replace function rabiti_private.rabiti_validate_coupon(
  p_slug text, p_code text, p_subtotal_minor bigint
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  d public.rabiti_discounts;
  v_code text;
  amount bigint := 0;
begin
  v_code := upper(regexp_replace(coalesce(p_code,''), '[^A-Za-z0-9]', '', 'g'));
  if v_code = '' then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  select * into d from public.rabiti_discounts dis
  where dis.store_slug = p_slug and upper(regexp_replace(dis.code,'[^A-Za-z0-9]','','g')) = v_code
  limit 1;
  if not found or not d.active then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  if d.starts_at is not null and d.starts_at > now() then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  if d.expires_at is not null and d.expires_at < now() then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  if d.max_uses > 0 and d.uses >= d.max_uses then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  if p_subtotal_minor < d.min_subtotal then return jsonb_build_object('valid',false,'discount_minor',0); end if;
  if d.kind = 'percent' then amount := floor(p_subtotal_minor * d.value / 100.0)::bigint;
  else amount := least(d.value, p_subtotal_minor); end if;
  return jsonb_build_object('valid',true,'discount_minor',greatest(amount,0),'kind',d.kind,'value',d.value);
end $$;

-- ---------------------------------------------------------------------------
-- Orders — public creation and secure delivery
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_create_order(
  p_slug text, p_items jsonb, p_buyer jsonb, p_coupon text, p_payment_method text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  page jsonb;
  prod jsonb;
  item jsonb;
  item_id text;
  qty integer;
  cur text;
  store_currency text;
  product_price bigint;
  product_cur text;
  subtotal bigint := 0;
  discount bigint := 0;
  total bigint;
  v_buyer_name text;
  v_buyer_email text;
  v_buyer_phone text;
  coupon_code text;
  coupon_row public.rabiti_discounts;
  order_row public.rabiti_orders;
  order_no text;
  token text;
  method text;
  attempt integer;
  items_json jsonb := '[]'::jsonb;
begin
  if coalesce(p_slug,'') !~ '^[a-z0-9][a-z0-9-]{2,39}$' then raise exception 'INVALID_STORE'; end if;
  select payload into page from public.rabiti_pages where slug = p_slug;
  if not found then raise exception 'STORE_NOT_PUBLISHED'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 20 then
    raise exception 'INVALID_ITEMS';
  end if;

  v_buyer_name := btrim(coalesce(p_buyer->>'name',''));
  v_buyer_email := lower(btrim(coalesce(p_buyer->>'email','')));
  v_buyer_phone := btrim(coalesce(p_buyer->>'phone',''));
  if length(v_buyer_name) < 1 or length(v_buyer_name) > 120 then raise exception 'INVALID_NAME'; end if;
  if v_buyer_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then raise exception 'INVALID_EMAIL'; end if;
  if length(v_buyer_phone) > 40 then raise exception 'INVALID_PHONE'; end if;

  -- Simple abuse guard: no more than 12 open orders per email per store per hour.
  if (select count(*) from public.rabiti_orders o
      where o.store_slug = p_slug and lower(o.buyer_email) = v_buyer_email
        and o.status = 'pending' and o.created_at > now() - interval '1 hour') >= 12 then
    raise exception 'TOO_MANY_ORDERS';
  end if;

  store_currency := coalesce(nullif(page#>>'{shop,currency}',''),'MAD');
  for item in select value from jsonb_array_elements(p_items) loop
    item_id := item->>'id';
    qty := coalesce((item->>'qty')::integer, 1);
    if qty < 1 or qty > 10 then raise exception 'INVALID_QTY'; end if;
    select value into prod from jsonb_array_elements(page->'products') as t(value)
    where value->>'id' = item_id limit 1;
    if prod is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if prod->>'mode' <> 'paid' then raise exception 'PRODUCT_NOT_PAID'; end if;
    product_cur := coalesce(nullif(prod->>'cur',''), store_currency);
    if upper(product_cur) <> upper(store_currency) then raise exception 'CURRENCY_MISMATCH'; end if;
    product_price := rabiti_private.money_minor(prod->>'pr', store_currency);
    if product_price <= 0 then raise exception 'INVALID_PRICE'; end if;
    subtotal := subtotal + product_price * qty;
    items_json := items_json || jsonb_build_array(jsonb_build_object(
      'id', item_id,
      'title', prod->>'t',
      'price_minor', product_price,
      'qty', qty,
      'currency', store_currency
    ));
  end loop;

  coupon_code := upper(regexp_replace(coalesce(p_coupon,''), '[^A-Za-z0-9]', '', 'g'));
  if coupon_code <> '' then
    select * into coupon_row from public.rabiti_discounts d
    where d.store_slug = p_slug and upper(regexp_replace(d.code,'[^A-Za-z0-9]','','g')) = coupon_code
    for update;
    if not found or not coupon_row.active
       or (coupon_row.starts_at is not null and coupon_row.starts_at > now())
       or (coupon_row.expires_at is not null and coupon_row.expires_at < now())
       or (coupon_row.max_uses > 0 and coupon_row.uses >= coupon_row.max_uses)
       or subtotal < coupon_row.min_subtotal then
      raise exception 'INVALID_COUPON';
    end if;
    if coupon_row.kind = 'percent' then
      discount := floor(subtotal * coupon_row.value / 100.0)::bigint;
    else
      discount := least(coupon_row.value, subtotal);
    end if;
  end if;

  total := greatest(subtotal - discount, 0);
  method := btrim(coalesce(p_payment_method,''));
  if method = '' then method := coalesce(nullif(page#>>'{checkout,mode}',''),'manual'); end if;
  if method not in ('manual','youcanpay') and not exists (
    select 1 from jsonb_array_elements(coalesce(page->'pay','[]'::jsonb)) m where m->>'id' = method
  ) then
    raise exception 'INVALID_PAYMENT_METHOD';
  end if;
  if method = 'youcanpay' and not coalesce((page#>>'{checkout,youcanpay,enabled}')::boolean,false) then
    raise exception 'PAYMENT_NOT_CONFIGURED';
  end if;

  for attempt in 1..5 loop
    order_no := 'RB-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
    token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    begin
      insert into public.rabiti_orders(
        store_slug, order_no, access_token, buyer_name, buyer_email, buyer_phone,
        items, subtotal_minor, discount_minor, total_minor, currency, coupon,
        status, payment_method
      ) values(
        p_slug, order_no, token, v_buyer_name, v_buyer_email, v_buyer_phone,
        items_json, subtotal, discount, total, store_currency, coupon_code,
        'pending', method
      ) returning * into order_row;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  if coupon_code <> '' then
    update public.rabiti_discounts set uses = uses + 1 where id = coupon_row.id;
  end if;

  insert into public.rabiti_order_events(order_id, type, data)
  values(order_row.id, 'created', jsonb_build_object('method', method, 'items', items_json));

  return jsonb_build_object(
    'id', order_row.id,
    'order_no', order_row.order_no,
    'token', order_row.access_token,
    'status', order_row.status,
    'subtotal_minor', order_row.subtotal_minor,
    'discount_minor', order_row.discount_minor,
    'total_minor', order_row.total_minor,
    'currency', order_row.currency,
    'coupon', order_row.coupon,
    'payment_method', order_row.payment_method,
    'created_at', order_row.created_at
  );
end $$;

create or replace function rabiti_private.rabiti_order_status(
  p_slug text, p_order_no text, p_token text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders;
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into o from public.rabiti_orders
  where store_slug = p_slug and order_no = p_order_no and access_token = p_token;
  if not found then return null; end if;
  return jsonb_build_object(
    'order_no', o.order_no,
    'status', o.status,
    'buyer_name', o.buyer_name,
    'buyer_email', o.buyer_email,
    'items', o.items,
    'subtotal_minor', o.subtotal_minor,
    'discount_minor', o.discount_minor,
    'total_minor', o.total_minor,
    'currency', o.currency,
    'coupon', o.coupon,
    'payment_method', o.payment_method,
    'payment_ref', o.payment_ref,
    'receipt_path', o.receipt_path,
    'created_at', o.created_at,
    'paid_at', o.paid_at,
    'delivered_at', o.delivered_at,
    'can_download', o.status in ('paid','delivered')
  );
end $$;

create or replace function rabiti_private.rabiti_order_download(
  p_slug text, p_order_no text, p_token text, p_product_id text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_order public.rabiti_orders;
  v_draft jsonb;
  v_prod jsonb;
  v_src jsonb;
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' then return null; end if;
  select * into v_order from public.rabiti_orders
  where store_slug = p_slug and order_no = p_order_no and access_token = p_token;
  if not found or v_order.status not in ('paid','delivered') then return null; end if;
  if not exists (
    select 1 from jsonb_array_elements(v_order.items) i where i->>'id' = p_product_id
  ) then return null; end if;
  select st.draft into v_draft from public.rabiti_stores st where st.slug = v_order.store_slug;
  if not found then return null; end if;
  select t.value into v_prod from jsonb_array_elements(coalesce(v_draft->'products','[]'::jsonb)) as t(value)
  where t.value->>'id' = p_product_id limit 1;
  if v_prod is null or v_prod->>'mode' <> 'paid' then return null; end if;
  v_src := v_prod->'src';
  if v_src is null then return null; end if;
  if v_src->>'type' = 'url' and rabiti_private.safe_https(v_src->>'url') then
    return jsonb_build_object('url', v_src->>'url', 'filename', coalesce(v_src->>'fn',''));
  elsif v_src->>'type' = 'file' and coalesce(v_src->>'data','') <> '' then
    return jsonb_build_object('url', v_src->>'data', 'filename', coalesce(nullif(v_src->>'fn',''),'file'));
  end if;
  return null;
end $$;

create or replace function rabiti_private.rabiti_order_claim_paid(
  p_slug text, p_order_no text, p_token text, p_ref text, p_receipt text default null
) returns boolean
language plpgsql security definer set search_path='' as $$
declare
  o public.rabiti_orders;
  v_ref text := left(coalesce(p_ref,''),500);
  v_receipt text := nullif(left(btrim(coalesce(p_receipt,'')),400),'');
begin
  if coalesce(p_token,'') !~ '^[a-f0-9]{64}$' then return false; end if;
  if v_receipt is not null and v_receipt !~ '^[a-z0-9][a-z0-9-]{0,39}/RB-[A-Z0-9]{10}/[A-Za-z0-9._-]{1,120}$' then
    return false;
  end if;
  select * into o from public.rabiti_orders
  where store_slug = p_slug and order_no = p_order_no and access_token = p_token for update;
  if not found or o.status <> 'pending' then return false; end if;
  update public.rabiti_orders
  set payment_ref = v_ref,
      receipt_path = coalesce(v_receipt, receipt_path),
      metadata = metadata || jsonb_build_object(
        'buyer_claimed_paid', true,
        'claimed_at', now(),
        'receipt', coalesce(v_receipt, receipt_path)
      )
  where id = o.id;
  insert into public.rabiti_order_events(order_id, type, data)
  values(o.id, 'buyer_claimed_paid', jsonb_build_object('ref', v_ref, 'receipt', v_receipt));
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Owner actions
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_owner_order(p_order_id uuid)
returns public.rabiti_orders
language plpgsql security definer set search_path='' as $$
declare v_order public.rabiti_orders;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select o.* into v_order from public.rabiti_orders o
  join public.rabiti_stores s on s.slug = o.store_slug
  where o.id = p_order_id and s.owner_id = auth.uid()
  for update of o;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  return v_order;
end $$;

create or replace function rabiti_private.rabiti_order_mark_paid(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders;
begin
  o := rabiti_private.rabiti_owner_order(p_order_id);
  if o.status in ('cancelled','refunded') then raise exception 'ORDER_CLOSED'; end if;
  if o.status in ('paid','delivered') then
    return jsonb_build_object('id',o.id,'status',o.status,'order_no',o.order_no);
  end if;
  update public.rabiti_orders
  set status = 'delivered', paid_at = now(), delivered_at = now(),
      provider = case when provider = '' then 'manual' else provider end
  where id = o.id;
  insert into public.rabiti_order_events(order_id, type, data)
  values(o.id, 'marked_paid', jsonb_build_object('by', 'owner'));
  return jsonb_build_object('id',o.id,'status','delivered','order_no',o.order_no);
end $$;

create or replace function rabiti_private.rabiti_order_refund(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders;
begin
  o := rabiti_private.rabiti_owner_order(p_order_id);
  update public.rabiti_orders set status = 'refunded' where id = o.id;
  insert into public.rabiti_order_events(order_id, type, data)
  values(o.id, 'refunded', jsonb_build_object('by', 'owner'));
  return jsonb_build_object('id',o.id,'status','refunded','order_no',o.order_no);
end $$;

create or replace function rabiti_private.rabiti_order_cancel(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders;
begin
  o := rabiti_private.rabiti_owner_order(p_order_id);
  if o.status in ('paid','delivered') then raise exception 'ORDER_PAID'; end if;
  update public.rabiti_orders set status = 'cancelled' where id = o.id;
  insert into public.rabiti_order_events(order_id, type, data)
  values(o.id, 'cancelled', jsonb_build_object('by', 'owner'));
  return jsonb_build_object('id',o.id,'status','cancelled','order_no',o.order_no);
end $$;

create or replace function rabiti_private.rabiti_order_note(p_order_id uuid, p_note text)
returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders;
begin
  o := rabiti_private.rabiti_owner_order(p_order_id);
  update public.rabiti_orders set notes = left(coalesce(p_note,''),2000) where id = o.id;
  return jsonb_build_object('id',o.id,'notes',left(coalesce(p_note,''),2000));
end $$;

-- ---------------------------------------------------------------------------
-- Verified provider confirmation (service role only)
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_confirm_payment(
  p_order_no text, p_provider text, p_provider_ref text,
  p_amount_minor bigint, p_currency text, p_event_id text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare o public.rabiti_orders; existing public.rabiti_payment_events;
begin
  select * into o from public.rabiti_orders where order_no = p_order_no for update;
  if not found then raise exception 'ORDER_NOT_FOUND'; end if;
  select * into existing from public.rabiti_payment_events
  where provider = p_provider and event_id = coalesce(nullif(p_event_id,''), nullif(p_provider_ref,''), p_order_no)
  limit 1;
  if found then
    return jsonb_build_object('id',o.id,'status',o.status,'order_no',o.order_no,'duplicate',true);
  end if;
  if p_amount_minor is distinct from o.total_minor or upper(coalesce(p_currency,'')) <> upper(o.currency) then
    raise exception 'PAYMENT_MISMATCH';
  end if;
  insert into public.rabiti_payment_events(provider, event_id, order_id, payload)
  values(p_provider, coalesce(nullif(p_event_id,''), nullif(p_provider_ref,''), p_order_no), o.id, coalesce(p_payload,'{}'::jsonb));
  if o.status in ('cancelled','refunded') then
    return jsonb_build_object('id',o.id,'status',o.status,'order_no',o.order_no,'ignored',true);
  end if;
  if o.status in ('paid','delivered') then
    return jsonb_build_object('id',o.id,'status',o.status,'order_no',o.order_no,'duplicate',true);
  end if;
  update public.rabiti_orders
  set status = 'delivered', paid_at = now(), delivered_at = now(),
      provider = p_provider, provider_ref = left(coalesce(p_provider_ref,''),200)
  where id = o.id;
  insert into public.rabiti_order_events(order_id, type, data)
  values(o.id, 'payment_confirmed', jsonb_build_object('provider', p_provider, 'ref', p_provider_ref));
  return jsonb_build_object('id',o.id,'status','delivered','order_no',o.order_no);
end $$;

-- ---------------------------------------------------------------------------
-- Dashboard statistics
-- ---------------------------------------------------------------------------
create or replace function rabiti_private.rabiti_stats()
returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_slug text;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  select s.slug into v_slug from public.rabiti_stores s where s.owner_id = auth.uid();
  if not found then raise exception 'STORE_REQUIRED'; end if;

  return jsonb_build_object(
    'orders_total', (select count(*) from public.rabiti_orders where store_slug = v_slug),
    'orders_paid', (select count(*) from public.rabiti_orders where store_slug = v_slug and status in ('paid','delivered')),
    'orders_pending', (select count(*) from public.rabiti_orders where store_slug = v_slug and status = 'pending'),
    'orders_30d', (select count(*) from public.rabiti_orders where store_slug = v_slug and created_at >= now() - interval '30 days'),
    'orders_prev_30d', (select count(*) from public.rabiti_orders where store_slug = v_slug and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'revenue_minor', (select coalesce(sum(total_minor),0) from public.rabiti_orders where store_slug = v_slug and status in ('paid','delivered')),
    'revenue_30d_minor', (select coalesce(sum(total_minor),0) from public.rabiti_orders where store_slug = v_slug and status in ('paid','delivered') and created_at >= now() - interval '30 days'),
    'revenue_prev_30d_minor', (select coalesce(sum(total_minor),0) from public.rabiti_orders where store_slug = v_slug and status in ('paid','delivered') and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'views_30d', (select count(*) from public.rabiti_events where store_slug = v_slug and type = 'page_view' and created_at >= now() - interval '30 days'),
    'views_prev_30d', (select count(*) from public.rabiti_events where store_slug = v_slug and type = 'page_view' and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'),
    'visitors_30d', (select count(distinct visitor) from public.rabiti_events where store_slug = v_slug and type = 'page_view' and visitor <> '' and created_at >= now() - interval '30 days'),
    'product_views_30d', (select count(*) from public.rabiti_events where store_slug = v_slug and type = 'product_view' and created_at >= now() - interval '30 days'),
    'checkout_starts_30d', (select count(*) from public.rabiti_events where store_slug = v_slug and type = 'checkout_start' and created_at >= now() - interval '30 days'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', to_char(d::date,'YYYY-MM-DD'),
        'revenue_minor', coalesce((select sum(o.total_minor) from public.rabiti_orders o
          where o.store_slug = v_slug and o.status in ('paid','delivered') and o.created_at::date = d::date),0),
        'orders', coalesce((select count(*) from public.rabiti_orders o
          where o.store_slug = v_slug and o.created_at::date = d::date),0),
        'views', coalesce((select count(*) from public.rabiti_events e
          where e.store_slug = v_slug and e.type = 'page_view' and e.created_at::date = d::date),0)
      ) order by d), '[]'::jsonb)
      from generate_series((now()::date - interval '29 days')::date, now()::date, interval '1 day') d
    ),
    'top_products', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'title', title, 'revenue_minor', revenue, 'orders', orders
      ) order by revenue desc), '[]'::jsonb)
      from (
        select i->>'id' as id, max(i->>'title') as title,
               sum((i->>'price_minor')::bigint * (i->>'qty')::integer) as revenue,
               count(*) as orders
        from public.rabiti_orders o, jsonb_array_elements(o.items) i
        where o.store_slug = v_slug and o.status in ('paid','delivered')
        group by i->>'id'
        order by revenue desc
        limit 5
      ) t
    )
  );
end $$;

-- ---------------------------------------------------------------------------
-- Public wrappers
-- ---------------------------------------------------------------------------
create or replace function public.rabiti_slug_available(p_slug text)
returns boolean language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_slug_available(p_slug)
$$;
create or replace function public.rabiti_change_slug(p_slug text)
returns text language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_change_slug(p_slug)
$$;
create or replace function public.rabiti_preview()
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_preview()
$$;
create or replace function public.rabiti_set_youcanpay(p_public_key text, p_private_key text, p_sandbox boolean, p_enabled boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_set_youcanpay(p_public_key,p_private_key,p_sandbox,p_enabled)
$$;
create or replace function public.rabiti_youcanpay_status()
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_youcanpay_status()
$$;
create or replace function public.rabiti_clear_youcanpay()
returns void language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_clear_youcanpay()
$$;
create or replace function public.rabiti_track(p_slug text, p_type text, p_product_id text default '', p_path text default '', p_visitor text default '', p_referrer text default '')
returns void language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_track(p_slug,p_type,p_product_id,p_path,p_visitor,p_referrer)
$$;
create or replace function public.rabiti_validate_coupon(p_slug text, p_code text, p_subtotal_minor bigint)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_validate_coupon(p_slug,p_code,p_subtotal_minor)
$$;
create or replace function public.rabiti_create_order(p_slug text, p_items jsonb, p_buyer jsonb, p_coupon text, p_payment_method text)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_create_order(p_slug,p_items,p_buyer,p_coupon,p_payment_method)
$$;
create or replace function public.rabiti_order_status(p_slug text, p_order_no text, p_token text)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_status(p_slug,p_order_no,p_token)
$$;
create or replace function public.rabiti_order_download(p_slug text, p_order_no text, p_token text, p_product_id text)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_download(p_slug,p_order_no,p_token,p_product_id)
$$;
create or replace function public.rabiti_order_claim_paid(p_slug text, p_order_no text, p_token text, p_ref text, p_receipt text default null)
returns boolean language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_claim_paid(p_slug,p_order_no,p_token,p_ref,p_receipt)
$$;
create or replace function public.rabiti_order_mark_paid(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_mark_paid(p_order_id)
$$;
create or replace function public.rabiti_order_refund(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_refund(p_order_id)
$$;
create or replace function public.rabiti_order_cancel(p_order_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_cancel(p_order_id)
$$;
create or replace function public.rabiti_order_note(p_order_id uuid, p_note text)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_note(p_order_id,p_note)
$$;
create or replace function public.rabiti_stats()
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_stats()
$$;
-- Service-role only: used by the YouCan Pay Edge Functions. The order token is
-- required for the secret lookup, and payment confirmation only runs after the
-- webhook verifies the provider signature.
drop function if exists public.rabiti_payment_secret_for_order(text);
create or replace function public.rabiti_payment_secret_for_order(p_order_no text, p_token text)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_payment_secret_for_order(p_order_no,p_token)
$$;
create or replace function public.rabiti_confirm_payment(
  p_order_no text, p_provider text, p_provider_ref text,
  p_amount_minor bigint, p_currency text, p_event_id text, p_payload jsonb
)
returns jsonb language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_confirm_payment(
    p_order_no,p_provider,p_provider_ref,p_amount_minor,p_currency,p_event_id,p_payload
  )
$$;

-- ---------------------------------------------------------------------------
-- Privileges and RLS
-- ---------------------------------------------------------------------------
grant usage on schema rabiti_private to anon, authenticated;

revoke all on public.rabiti_orders, public.rabiti_order_events, public.rabiti_payment_events,
  public.rabiti_events, public.rabiti_payment_secrets, public.rabiti_discounts
  from public, anon, authenticated;
grant select on public.rabiti_orders to authenticated;
grant select on public.rabiti_order_events to authenticated;
grant select, insert, update, delete on public.rabiti_discounts to authenticated;

alter table public.rabiti_orders enable row level security;
alter table public.rabiti_order_events enable row level security;
alter table public.rabiti_payment_events enable row level security;
alter table public.rabiti_events enable row level security;
alter table public.rabiti_payment_secrets enable row level security;
alter table public.rabiti_discounts enable row level security;

drop policy if exists rabiti_orders_owner_read on public.rabiti_orders;
create policy rabiti_orders_owner_read on public.rabiti_orders
  for select to authenticated
  using (exists (select 1 from public.rabiti_stores s where s.slug = store_slug and s.owner_id = auth.uid()));

drop policy if exists rabiti_order_events_owner_read on public.rabiti_order_events;
create policy rabiti_order_events_owner_read on public.rabiti_order_events
  for select to authenticated
  using (exists (
    select 1 from public.rabiti_orders o
    join public.rabiti_stores s on s.slug = o.store_slug
    where o.id = order_id and s.owner_id = auth.uid()
  ));

drop policy if exists rabiti_discounts_owner_all on public.rabiti_discounts;
create policy rabiti_discounts_owner_all on public.rabiti_discounts
  for all to authenticated
  using (exists (select 1 from public.rabiti_stores s where s.slug = store_slug and s.owner_id = auth.uid()))
  with check (exists (select 1 from public.rabiti_stores s where s.slug = store_slug and s.owner_id = auth.uid()));

revoke all on function
  rabiti_private.rabiti_slug_available(text),
  rabiti_private.rabiti_change_slug(text),
  rabiti_private.rabiti_publish(integer),
  rabiti_private.rabiti_preview(),
  rabiti_private.rabiti_set_youcanpay(text,text,boolean,boolean),
  rabiti_private.rabiti_youcanpay_status(),
  rabiti_private.rabiti_clear_youcanpay(),
  rabiti_private.rabiti_track(text,text,text,text,text,text),
  rabiti_private.rabiti_validate_coupon(text,text,bigint),
  rabiti_private.rabiti_create_order(text,jsonb,jsonb,text,text),
  rabiti_private.rabiti_order_status(text,text,text),
  rabiti_private.rabiti_order_download(text,text,text,text),
  rabiti_private.rabiti_order_claim_paid(text,text,text,text,text),
  rabiti_private.rabiti_order_mark_paid(uuid),
  rabiti_private.rabiti_order_refund(uuid),
  rabiti_private.rabiti_order_cancel(uuid),
  rabiti_private.rabiti_order_note(uuid,text),
  rabiti_private.rabiti_stats(),
  rabiti_private.rabiti_payment_secret_for_order(text,text),
  rabiti_private.rabiti_confirm_payment(text,text,text,bigint,text,text,jsonb),
  rabiti_private.rabiti_owner_order(uuid)
from public, anon, authenticated;

grant execute on function
  rabiti_private.rabiti_slug_available(text),
  rabiti_private.rabiti_change_slug(text),
  rabiti_private.rabiti_publish(integer),
  rabiti_private.rabiti_preview(),
  rabiti_private.rabiti_set_youcanpay(text,text,boolean,boolean),
  rabiti_private.rabiti_youcanpay_status(),
  rabiti_private.rabiti_clear_youcanpay(),
  rabiti_private.rabiti_track(text,text,text,text,text,text),
  rabiti_private.rabiti_validate_coupon(text,text,bigint),
  rabiti_private.rabiti_create_order(text,jsonb,jsonb,text,text),
  rabiti_private.rabiti_order_status(text,text,text),
  rabiti_private.rabiti_order_download(text,text,text,text),
  rabiti_private.rabiti_order_claim_paid(text,text,text,text,text)
to anon, authenticated;

grant execute on function
  rabiti_private.rabiti_order_mark_paid(uuid),
  rabiti_private.rabiti_order_refund(uuid),
  rabiti_private.rabiti_order_cancel(uuid),
  rabiti_private.rabiti_order_note(uuid,text),
  rabiti_private.rabiti_stats(),
  rabiti_private.rabiti_change_slug(text),
  rabiti_private.rabiti_preview(),
  rabiti_private.rabiti_set_youcanpay(text,text,boolean,boolean),
  rabiti_private.rabiti_youcanpay_status(),
  rabiti_private.rabiti_clear_youcanpay(),
  rabiti_private.rabiti_slug_available(text)
to authenticated;

revoke all on function
  public.rabiti_slug_available(text),
  public.rabiti_change_slug(text),
  public.rabiti_preview(),
  public.rabiti_set_youcanpay(text,text,boolean,boolean),
  public.rabiti_youcanpay_status(),
  public.rabiti_clear_youcanpay(),
  public.rabiti_track(text,text,text,text,text,text),
  public.rabiti_validate_coupon(text,text,bigint),
  public.rabiti_create_order(text,jsonb,jsonb,text,text),
  public.rabiti_order_status(text,text,text),
  public.rabiti_order_download(text,text,text,text),
  public.rabiti_order_claim_paid(text,text,text,text,text),
  public.rabiti_order_mark_paid(uuid),
  public.rabiti_order_refund(uuid),
  public.rabiti_order_cancel(uuid),
  public.rabiti_order_note(uuid,text),
  public.rabiti_stats(),
  public.rabiti_payment_secret_for_order(text,text),
  public.rabiti_confirm_payment(text,text,text,bigint,text,text,jsonb)
from public, anon, authenticated;

grant execute on function
  public.rabiti_slug_available(text),
  public.rabiti_track(text,text,text,text,text,text),
  public.rabiti_validate_coupon(text,text,bigint),
  public.rabiti_create_order(text,jsonb,jsonb,text,text),
  public.rabiti_order_status(text,text,text),
  public.rabiti_order_download(text,text,text,text),
  public.rabiti_order_claim_paid(text,text,text,text,text)
to anon, authenticated;

grant execute on function
  public.rabiti_change_slug(text),
  public.rabiti_preview(),
  public.rabiti_set_youcanpay(text,text,boolean,boolean),
  public.rabiti_youcanpay_status(),
  public.rabiti_clear_youcanpay(),
  public.rabiti_order_mark_paid(uuid),
  public.rabiti_order_refund(uuid),
  public.rabiti_order_cancel(uuid),
  public.rabiti_order_note(uuid,text),
  public.rabiti_stats()
to authenticated;

-- Service role is used only by the Edge Functions.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema rabiti_private to service_role;
    grant execute on function rabiti_private.rabiti_payment_secret_for_order(text,text) to service_role;
    grant execute on function rabiti_private.rabiti_confirm_payment(text,text,text,bigint,text,text,jsonb) to service_role;
    grant execute on function public.rabiti_payment_secret_for_order(text,text) to service_role;
    grant execute on function public.rabiti_confirm_payment(text,text,text,bigint,text,text,jsonb) to service_role;
    grant select on public.rabiti_orders, public.rabiti_payment_secrets,
      public.rabiti_payment_events, public.rabiti_order_events to service_role;
  end if;
end $$;

-- Remove the old code-redemption entry points. Orders replace them.
drop function if exists public.rabiti_redeem(text,text,text,text);
drop function if exists public.rabiti_download(text,text,text);
drop function if exists public.rabiti_code_status(text);
drop function if exists rabiti_private.rabiti_redeem(text,text,text,text);
drop function if exists rabiti_private.rabiti_download(text,text,text);
drop function if exists rabiti_private.rabiti_code_status(text);

commit;
