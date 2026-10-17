begin;
create or replace function rabiti_private.rabiti_publish(p_revision integer) returns text
language plpgsql security definer set search_path='' as $$
declare s public.rabiti_stores; products jsonb; links jsonb; payments jsonb; payload jsonb;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
 select * into s from public.rabiti_stores where owner_id=auth.uid() for update;
 if not found then raise exception 'STORE_REQUIRED'; end if;
 if s.revision<>p_revision then raise exception 'REVISION_CONFLICT'; end if;
 perform 1 from public.rabiti_pages where slug=s.slug for update;
 if exists(select 1 from jsonb_array_elements(coalesce(s.draft->'products','[]'::jsonb)) p
 where p->>'mode'='checkout' and coalesce(p->>'on','1')<>'0'
 and (length(coalesce(p->>'link',''))>2000 or coalesce(p->>'link','') !~* '^https://([a-z0-9-]+\.)?gumroad\.com/l/[a-z0-9_-]+([?#][^[:space:]]*)?$')) then
 raise exception 'INVALID_CHECKOUT_URL'; end if;
 perform rabiti_private.sync_paid(s.slug,s.draft);
 select coalesce(jsonb_agg(jsonb_build_object('id',p->>'id','t',p->>'t','d',p->>'d',
 'pr',p->>'pr','cur',p->>'cur','imgs',p->'imgs','on',1,'mode',p->>'mode',
 'link',case when p->>'mode' in ('link','checkout') then p->>'link' else '' end,
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
commit;
