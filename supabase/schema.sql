begin;
create schema if not exists rabiti_private;
revoke all on schema rabiti_private from public, anon;
grant usage on schema rabiti_private to authenticated;
create table public.rabiti_stores (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
 draft jsonb not null default '{}'::jsonb check (jsonb_typeof(draft)='object' and octet_length(draft::text)<=8000000),
 revision integer not null default 0,
 updated_at timestamptz not null default now()
);
create table public.rabiti_pages (
 slug text primary key references public.rabiti_stores(slug) on delete cascade,
 payload jsonb not null,
 published_at timestamptz not null default now()
);
alter table public.rabiti_stores enable row level security;
alter table public.rabiti_pages enable row level security;
revoke all on public.rabiti_stores, public.rabiti_pages from anon, authenticated;
grant select, insert, delete on public.rabiti_stores to authenticated;
grant select on public.rabiti_pages to anon, authenticated;
create policy store_owner_read on public.rabiti_stores for select to authenticated using ((select auth.uid())=owner_id);
create policy store_owner_create on public.rabiti_stores for insert to authenticated with check ((select auth.uid())=owner_id and revision=0);
create policy store_owner_delete on public.rabiti_stores for delete to authenticated using ((select auth.uid())=owner_id);
create policy published_read on public.rabiti_pages for select to anon, authenticated using (true);

create function rabiti_private.rabiti_save(p_draft jsonb, p_revision integer) returns integer
language plpgsql security definer set search_path='' as $$
declare new_revision integer;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 update public.rabiti_stores set draft=p_draft, revision=revision+1, updated_at=now()
 where owner_id=auth.uid() and revision=p_revision returning revision into new_revision;
 if new_revision is null then raise exception 'REVISION_CONFLICT'; end if;
 return new_revision;
end $$;

-- Only this function can write the public snapshot. Draft/admin fields are excluded here.
create function rabiti_private.rabiti_publish(p_revision integer) returns text
language plpgsql security definer set search_path='' as $$
declare s public.rabiti_stores; products jsonb; links jsonb; payments jsonb; payload jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into s from public.rabiti_stores where owner_id=auth.uid() for update;
 if not found then raise exception 'STORE_REQUIRED'; end if;
 if s.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 if exists(select 1 from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
 where p->>'mode'='paid' and coalesce(p->>'on','1')<>'0') then
 raise exception 'PAID_DELIVERY_NOT_CONFIGURED'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','t',p->>'t','d',p->>'d',
 'pr',p->>'pr','cur',p->>'cur','imgs',p->'imgs','on',1,'mode',p->>'mode',
 'link',case when p->>'mode'='link' then p->>'link' else '' end,
 'fn',case when p->>'mode'='file' then p->>'fn' else '' end,
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
create function rabiti_private.rabiti_unpublish() returns void
language sql security definer set search_path='' as $$
 delete from public.rabiti_pages where slug in (select slug from public.rabiti_stores where owner_id=auth.uid());
$$;
revoke all on function rabiti_private.rabiti_save(jsonb,integer), rabiti_private.rabiti_publish(integer), rabiti_private.rabiti_unpublish() from public, anon;
grant execute on function rabiti_private.rabiti_save(jsonb,integer), rabiti_private.rabiti_publish(integer), rabiti_private.rabiti_unpublish() to authenticated;
create function public.rabiti_save(p_draft jsonb, p_revision integer) returns integer
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_save(p_draft,p_revision)$$;
create function public.rabiti_publish(p_revision integer) returns text
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_publish(p_revision)$$;
create function public.rabiti_unpublish() returns void
language sql security invoker set search_path='' as $$select rabiti_private.rabiti_unpublish()$$;
revoke all on function public.rabiti_save(jsonb,integer), public.rabiti_publish(integer), public.rabiti_unpublish() from public, anon;
grant execute on function public.rabiti_save(jsonb,integer), public.rabiti_publish(integer), public.rabiti_unpublish() to authenticated;
commit;
