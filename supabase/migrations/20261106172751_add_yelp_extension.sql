-- Yelp integration for the TGD browser extension.
create index if not exists listings_visible_yelp_id_idx
  on public.listings (yelp_id)
  where visible is true and yelp_id is not null and btrim(yelp_id) <> '';

create table if not exists public.greek_owned_yelp_extension_suggestions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied')),
  yelp_id text not null
    check (length(btrim(yelp_id)) between 1 and 255),
  business_name text not null
    check (length(btrim(business_name)) between 1 and 200),
  address text
    check (address is null or length(address) <= 300),
  yelp_url text not null
    check (length(yelp_url) <= 2048),
  relationship text not null
    check (relationship in ('owner', 'family_friend', 'knows')),
  note text
    check (note is null or length(note) <= 500),
  reviewed_at timestamptz,
  review_notes text
    check (review_notes is null or length(review_notes) <= 2000)
);

alter table public.greek_owned_yelp_extension_suggestions enable row level security;
revoke all on public.greek_owned_yelp_extension_suggestions from public, anon, authenticated;
grant select, insert, update on public.greek_owned_yelp_extension_suggestions to service_role;

create index if not exists greek_owned_yelp_extension_suggestions_pending_created_idx
  on public.greek_owned_yelp_extension_suggestions (created_at desc)
  where status = 'pending';

create unique index if not exists greek_owned_yelp_extension_suggestions_one_pending_id_idx
  on public.greek_owned_yelp_extension_suggestions (yelp_id)
  where status = 'pending';

comment on table public.greek_owned_yelp_extension_suggestions is
  'Human-reviewed suggestions submitted from the TGD Yelp extension. No submitter name, email, phone, IP address, or Yelp account information is collected.';
