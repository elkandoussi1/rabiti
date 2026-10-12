begin;
create table rabiti_private.deliveries (
 slug text not null references public.rabiti_stores(slug) on delete cascade,
 product_id text not null,
 version text not null,
 source text not null,
 filename text not null default '',
 primary key(slug,product_id,version)
);
create table rabiti_private.delivery_codes (
 slug text not null,
 product_id text not null,
 code_hash text not null,
 version text not null,
 active boolean not null default true,
 revoked boolean not null default false,
 claim_hash text,
 redeemed_at timestamptz,
 primary key(slug,product_id,code_hash),
 foreign key(slug,product_id,version) references rabiti_private.deliveries(slug,product_id,version) on delete cascade
);
create index delivery_version_lookup on rabiti_private.delivery_codes(slug,product_id,version);
create index receipt_lookup on rabiti_private.delivery_codes(slug,product_id,claim_hash) where claim_hash is not null;
alter table rabiti_private.deliveries enable row level security;
alter table rabiti_private.delivery_codes enable row level security;
revoke all on rabiti_private.deliveries,rabiti_private.delivery_codes from public,anon,authenticated;
create policy no_direct_delivery_access on rabiti_private.deliveries for all to anon,authenticated using(false) with check(false);
create policy no_direct_code_access on rabiti_private.delivery_codes for all to anon,authenticated using(false) with check(false);

create function rabiti_private.sync_paid(p_slug text,p_draft jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare p jsonb; c jsonb; target text; file_name text; ver text; normalized text; h text;
begin
 if not exists(select 1 from public.rabiti_stores where slug=p_slug and owner_id=auth.uid()) then raise exception 'AUTH_REQUIRED'; end if;
 update rabiti_private.delivery_codes set active=false where slug=p_slug;
 for p in select value from jsonb_array_elements(coalesce(p_draft->'products','[]'::jsonb)) where value->>'mode'='paid' and coalesce(value->>'on','1')<>'0' loop
 if coalesce(p->>'id','') !~ '^[a-zA-Z0-9_-]{1,80}$' then raise exception 'INVALID_PRODUCT_ID'; end if;
 target=case when p#>>'{src,type}'='file' then p#>>'{src,data}' else btrim(p#>>'{src,url}') end;
 if target like 'data:;base64,%' then target=replace(target,'data:;base64,','data:application/octet-stream;base64,'); end if;
 file_name=case when p#>>'{src,type}'='file' then coalesce(p#>>'{src,fn}','file') else '' end;
 if target is null or target='' or length(target)>4500000 or length(file_name)>255 then raise exception 'PAID_SOURCE_REQUIRED'; end if;
 if p#>>'{src,type}'='file' then
   if target !~ '^data:[a-zA-Z0-9.+/-]+;base64,[a-zA-Z0-9+/=]+$' or target ~* '^data:(text/html|image/svg|application/javascript)' then raise exception 'INVALID_FILE'; end if;
 elsif p#>>'{src,type}'='url' then
   if target !~* '^https?://[^[:space:]]+$' then raise exception 'INVALID_URL'; end if;
 else raise exception 'PAID_SOURCE_REQUIRED'; end if;
 if jsonb_typeof(p#>'{lm,codes}') is distinct from 'array' or jsonb_array_length(p#>'{lm,codes}')<1 or jsonb_array_length(p#>'{lm,codes}')>300 then raise exception 'PAID_CODES_REQUIRED'; end if;
 ver=encode(sha256(convert_to(target||chr(10)||file_name,'UTF8')),'hex');
 insert into rabiti_private.deliveries(slug,product_id,version,source,filename) values(p_slug,p->>'id',ver,target,file_name) on conflict do nothing;
 for c in select value from jsonb_array_elements(p#>'{lm,codes}') loop
 normalized=regexp_replace(upper(coalesce(c->>'c','')),'[^A-Z0-9]','','g');
 if normalized !~ '^[A-Z0-9]{12,64}$' then raise exception 'INVALID_CODE'; end if;
 h=encode(sha256(convert_to(normalized,'UTF8')),'hex');
 insert into rabiti_private.delivery_codes(slug,product_id,code_hash,version,revoked)
 values(p_slug,p->>'id',h,ver,coalesce((c->>'revoked')::boolean,false))
 on conflict(slug,product_id,code_hash) do update set active=true,
 revoked=excluded.revoked,
 version=case when rabiti_private.delivery_codes.claim_hash is null then excluded.version else rabiti_private.delivery_codes.version end;
 end loop;
 end loop;
end $$;
revoke all on function rabiti_private.sync_paid(text,jsonb) from public,anon,authenticated;
create or replace function rabiti_private.rabiti_publish(p_revision integer) returns text
language plpgsql security definer set search_path='' as $$
declare s public.rabiti_stores; products jsonb; links jsonb; payments jsonb; payload jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into s from public.rabiti_stores where owner_id=auth.uid() for update;
 if not found then raise exception 'STORE_REQUIRED'; end if;
 if s.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 perform 1 from public.rabiti_pages where slug=s.slug for update;
 perform rabiti_private.sync_paid(s.slug,s.draft);
 select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','t',p->>'t','d',p->>'d',
 'pr',p->>'pr','cur',p->>'cur','imgs',p->'imgs','on',1,'mode',p->>'mode',
 'link',case when p->>'mode'='link' then p->>'link' else '' end,
 'fn',case when p->>'mode'='file' then p->>'fn' when p->>'mode'='paid' then p#>>'{src,fn}' else '' end,
 'lock',case when p->>'mode'='paid' then 'server-v1' else '' end,
 'data',case when p->>'mode'='file' then p->>'data' else '' end)), '[]'::jsonb)
 into products from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
 where coalesce(p->>'on','1')<>'0';
 select coalesce(jsonb_agg(jsonb_build_object('id',l->>'id','t',l->>'t','u',l->>'u','kind',l->>'kind','on',1)),'[]'::jsonb)
 into links from jsonb_array_elements(coalesce(s.draft->'links','[]'::jsonb)) l where coalesce(l->>'on','1')<>'0';
 select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','t',p->>'t','d',p->>'d','u',p->>'u')),'[]'::jsonb)
 into payments from jsonb_array_elements(coalesce(s.draft->'pay','[]'::jsonb)) p;
 payload=jsonb_build_object('lang',s.draft->>'lang',
 'profile',jsonb_build_object('name',s.draft#>>'{profile,name}','bio',s.draft#>>'{profile,bio}','avatar',s.draft#>>'{profile,avatar}'),
 'design',coalesce(s.draft->'design','{}'::jsonb),'texts',coalesce(s.draft->'texts','{}'::jsonb),
 'shop',jsonb_build_object('currency',s.draft#>>'{shop,currency}','whatsapp',s.draft#>>'{shop,whatsapp}','telegram',s.draft#>>'{shop,telegram}','email',s.draft#>>'{shop,email}','payUrl',s.draft#>>'{shop,payUrl}'),
 'sub',coalesce(s.draft->'sub','{}'::jsonb),'products',products,'links',links,'pay',payments);
 insert into public.rabiti_pages(slug,payload) values(s.slug,payload)
 on conflict(slug) do update set payload=excluded.payload,published_at=now();
 return s.slug;
end $$;

-- Anonymous buyers authenticate with an unguessable code and a device receipt.
-- The row lock makes simultaneous redemption safe; repeating the same receipt is idempotent.
create function rabiti_private.rabiti_redeem(p_slug text,p_product_id text,p_code text,p_receipt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row rabiti_private.delivery_codes; h text; rh text; result jsonb; page jsonb; normalized text;
begin
 if length(p_slug)>40 or length(p_product_id)>80 or length(p_code)>100 or p_receipt !~ '^[a-f0-9]{64}$' then return null; end if;
 select payload into page from public.rabiti_pages where slug=p_slug for share;
 if not found or not exists(select 1 from jsonb_array_elements(page->'products') p where p->>'id'=p_product_id and p->>'mode'='paid') then return null; end if;
 normalized=regexp_replace(upper(coalesce(p_code,'')),'[^A-Z0-9]','','g');
 if normalized !~ '^[A-Z0-9]{12,64}$' or p_receipt is null then return null; end if;
 h=encode(sha256(convert_to(normalized,'UTF8')),'hex');rh=encode(sha256(convert_to(p_receipt,'UTF8')),'hex');
 select * into row from rabiti_private.delivery_codes where slug=p_slug and product_id=p_product_id and code_hash=h for update;
 if not found or row.revoked or (row.claim_hash is null and not row.active) then return null; end if;
 if row.claim_hash is not null and row.claim_hash<>rh then return null; end if;
 if row.claim_hash is null then update rabiti_private.delivery_codes set claim_hash=rh,redeemed_at=now() where slug=p_slug and product_id=p_product_id and code_hash=h; end if;
 select jsonb_build_object('source',source,'filename',filename) into result from rabiti_private.deliveries where slug=p_slug and product_id=p_product_id and version=row.version;
 return result;
end $$;
create function rabiti_private.rabiti_download(p_slug text,p_product_id text,p_receipt text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare rh text; result jsonb; page jsonb;
begin
 if p_receipt is null or p_receipt !~ '^[a-f0-9]{64}$' then return null; end if;
 select payload into page from public.rabiti_pages where slug=p_slug for share;
 if not found or not exists(select 1 from jsonb_array_elements(page->'products') p where p->>'id'=p_product_id and p->>'mode'='paid') then return null; end if;
 rh=encode(sha256(convert_to(p_receipt,'UTF8')),'hex');
 select jsonb_build_object('source',d.source,'filename',d.filename) into result
 from rabiti_private.delivery_codes c join rabiti_private.deliveries d using(slug,product_id,version)
 where c.slug=p_slug and c.product_id=p_product_id and c.claim_hash=rh and not c.revoked
 order by c.redeemed_at desc limit 1;
 return result;
end $$;
create function rabiti_private.rabiti_code_status(p_product_id text) returns jsonb
language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('hash',c.code_hash,'redeemed_at',c.redeemed_at,'active',c.active,'revoked',c.revoked)),'[]'::jsonb)
 from rabiti_private.delivery_codes c join public.rabiti_stores s using(slug)
 where s.owner_id=auth.uid() and c.product_id=p_product_id;
$$;
revoke all on function rabiti_private.rabiti_redeem(text,text,text,text),rabiti_private.rabiti_download(text,text,text),rabiti_private.rabiti_code_status(text) from public,anon,authenticated;
grant usage on schema rabiti_private to anon;
grant execute on function rabiti_private.rabiti_redeem(text,text,text,text),rabiti_private.rabiti_download(text,text,text) to anon,authenticated;
grant execute on function rabiti_private.rabiti_code_status(text) to authenticated;
create function public.rabiti_redeem(p_slug text,p_product_id text,p_code text,p_receipt text) returns jsonb
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_redeem(p_slug,p_product_id,p_code,p_receipt)$$;
create function public.rabiti_download(p_slug text,p_product_id text,p_receipt text) returns jsonb
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_download(p_slug,p_product_id,p_receipt)$$;
create function public.rabiti_code_status(p_product_id text) returns jsonb
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_code_status(p_product_id)$$;
revoke all on function public.rabiti_redeem(text,text,text,text),public.rabiti_download(text,text,text),public.rabiti_code_status(text) from public,anon,authenticated;
grant execute on function public.rabiti_redeem(text,text,text,text),public.rabiti_download(text,text,text) to anon,authenticated;
grant execute on function public.rabiti_code_status(text) to authenticated;
commit;
