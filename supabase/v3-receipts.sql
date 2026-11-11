-- ---------------------------------------------------------------------------
-- v3: payment receipts for manual methods
--
-- A buyer paying by bank transfer or CashPlus can attach a photo or PDF of the
-- receipt from the order page. The file lives in a private storage bucket; the
-- order only keeps its path, and the store owner reads it through a signed URL.
-- Uploads go through the `rabiti-receipt` Edge Function, which checks the
-- order's secret token, so no anonymous write policy exists on the bucket.
-- ---------------------------------------------------------------------------

alter table public.rabiti_orders add column if not exists receipt_path text;
update public.rabiti_orders set receipt_path = '' where receipt_path is null;
alter table public.rabiti_orders alter column receipt_path set default '';
alter table public.rabiti_orders alter column receipt_path set not null;

-- ---------------------------------------------------------------------------
-- Order status now reports whether a receipt was attached.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Claim paid, with an optional receipt path. The 4-argument signature is
-- replaced by a 5-argument one with a default, so existing calls keep working.
-- ---------------------------------------------------------------------------
drop function if exists public.rabiti_order_claim_paid(text,text,text,text);
drop function if exists rabiti_private.rabiti_order_claim_paid(text,text,text,text);

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

create or replace function public.rabiti_order_claim_paid(
  p_slug text, p_order_no text, p_token text, p_ref text, p_receipt text default null
) returns boolean
language sql security invoker set search_path='' as $$
  select rabiti_private.rabiti_order_claim_paid(p_slug,p_order_no,p_token,p_ref,p_receipt)
$$;

revoke all on function rabiti_private.rabiti_order_claim_paid(text,text,text,text,text) from public, anon, authenticated;
grant execute on function rabiti_private.rabiti_order_claim_paid(text,text,text,text,text) to anon, authenticated, service_role;

revoke all on function public.rabiti_order_claim_paid(text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.rabiti_order_claim_paid(text,text,text,text,text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Private bucket for receipts. 5 MB, images or PDF only.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rabiti-receipts', 'rabiti-receipts', false, 5242880,
  array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "rabiti receipts owner read" on storage.objects;
create policy "rabiti receipts owner read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'rabiti-receipts'
    and exists (
      select 1 from public.rabiti_stores s
      where s.owner_id = auth.uid()
        and s.slug = split_part(storage.objects.name, '/', 1)
    )
  );

drop policy if exists "rabiti receipts owner delete" on storage.objects;
create policy "rabiti receipts owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'rabiti-receipts'
    and exists (
      select 1 from public.rabiti_stores s
      where s.owner_id = auth.uid()
        and s.slug = split_part(storage.objects.name, '/', 1)
    )
  );
