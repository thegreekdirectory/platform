-- Google Maps extension suggestion queue and rate limiting.
create index if not exists listings_visible_google_place_id_idx on public.listings(google_place_id) where visible=true and google_place_id is not null and google_place_id<>'';
create table if not exists public.greek_owned_extension_suggestions(
 id uuid primary key default gen_random_uuid(),created_at timestamptz not null default now(),
 status text not null default 'pending' check(status in('pending','approved','denied')),
 google_place_id text not null,business_name text not null,address text,maps_url text,
 relationship text not null check(relationship in('owner','family_friend','knows')),note text,reviewed_at timestamptz,review_notes text
);
alter table public.greek_owned_extension_suggestions enable row level security;
revoke all on public.greek_owned_extension_suggestions from public,anon,authenticated;
grant select,insert,update on public.greek_owned_extension_suggestions to service_role;
create index if not exists greek_owned_extension_suggestions_pending_created_idx on public.greek_owned_extension_suggestions(created_at desc) where status='pending';
create unique index if not exists greek_owned_extension_suggestions_one_pending_place_idx on public.greek_owned_extension_suggestions(google_place_id) where status='pending';
create table if not exists public.greek_owned_extension_rate_limits(installation_id uuid primary key,window_started_at timestamptz not null,request_count integer not null default 0,updated_at timestamptz not null default now());
alter table public.greek_owned_extension_rate_limits enable row level security;
revoke all on public.greek_owned_extension_rate_limits from public,anon,authenticated;
grant select,insert,update on public.greek_owned_extension_rate_limits to service_role;
create or replace function public.consume_greek_owned_extension_quota(p_installation_id uuid,p_max_requests integer default 90,p_window_seconds integer default 60) returns boolean
language plpgsql set search_path=pg_catalog,public as $$
declare v_now timestamptz:=clock_timestamp();v_max integer:=least(greatest(coalesce(p_max_requests,90),1),600);v_window integer:=least(greatest(coalesce(p_window_seconds,60),1),3600);v_count integer;
begin
 if p_installation_id is null then return false;end if;
 insert into public.greek_owned_extension_rate_limits as old(installation_id,window_started_at,request_count,updated_at) values(p_installation_id,v_now,1,v_now)
 on conflict(installation_id) do update set window_started_at=case when old.window_started_at<=v_now-make_interval(secs=>v_window) then v_now else old.window_started_at end,
 request_count=case when old.window_started_at<=v_now-make_interval(secs=>v_window) then 1 else least(old.request_count+1,v_max+1) end,updated_at=v_now returning request_count into v_count;
 return v_count<=v_max;
end $$;
revoke all on function public.consume_greek_owned_extension_quota(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.consume_greek_owned_extension_quota(uuid,integer,integer) to service_role;
