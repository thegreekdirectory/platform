# Supabase Database Audit Report
## Project: The Greek Directory (`luetekzqrrgdxtopzvqw`)

**Generated:** 2026-05-27
**Last Updated:** 2026-11-06 (Yelp browser-extension backend added; earlier audit sections retain their original snapshot dates)
**Database Host:** `db.luetekzqrrgdxtopzvqw.supabase.co`
**API URL:** `https://luetekzqrrgdxtopzvqw.supabase.co`
**Region:** `us-west-2`
**Status:** `ACTIVE_HEALTHY`
**PostgreSQL Version:** `17.6.1.063` (Engine: 17, Channel: GA)
**Organization ID:** `hagpqllpuxzcqacxmxdj`
**Created:** `2026-01-13T23:40:47Z`

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Schemas Overview](#2-schemas-overview)
3. [Public Schema — Tables (Full Detail)](#3-public-schema--tables-full-detail)
   - [listings](#31-table-public-listings)
   - [business_owners](#32-table-public-business_owners)
   - [listing_analytics](#33-table-public-listing_analytics)
   - [listing_analytics_summary](#34-table-public-listing_analytics_summary)
   - [listing_requests](#35-table-public-listing_requests)
   - [listing_suggestions](#36-table-public-listing_suggestions)
   - [shortlinks](#37-table-public-shortlinks)
   - [shortlink_events](#38-table-public-shortlink_events)
   - [category_subcategories](#39-table-public-category_subcategories)
4. [Auth Schema — Tables Summary](#4-auth-schema--tables-summary)
5. [Storage Schema — Tables Summary](#5-storage-schema--tables-summary)
6. [RLS Policies — Per Table](#6-rls-policies--per-table)
7. [Public SQL Functions](#7-public-sql-functions)
8. [Triggers](#8-triggers)
9. [Event Triggers](#9-event-triggers)
10. [Indexes](#10-indexes)
11. [Sequences](#11-sequences)
12. [Views](#12-views)
13. [Edge Functions (Full Source)](#13-edge-functions-full-source)
14. [Installed Extensions](#14-installed-extensions)
15. [Migration History](#15-migration-history)
16. [Security Advisors](#16-security-advisors)
17. [Performance Advisors](#17-performance-advisors)
18. [Architecture Notes & Patterns](#18-architecture-notes--patterns)
19. [Yelp Extension Integration](#19-yelp-extension-integration)

---

## 1. Project Overview

**The Greek Directory** is a business directory platform focused on Greek-owned or Greek-themed businesses across the United States. The database backs a multi-tier listing product with public browsing, business owner authentication, analytics tracking, shortlink management, and an admin proxy layer.

**Key data facts (as of audit date):**
| Table | Row Count |
|---|---|
| `public.listings` | 54 |
| `public.business_owners` | 54 |
| `public.listing_analytics` | 169 |
| `public.listing_analytics_summary` | 54 |
| `public.shortlinks` | 431 |
| `public.shortlink_events` | 103 |
| `public.category_subcategories` | 14 |
| `public.listing_requests` | 0 |
| `public.listing_suggestions` | 0 |
| `auth.users` | 2 |
| `auth.schema_migrations` | 76 |

---

## 2. Schemas Overview

| Schema | Purpose |
|---|---|
| `public` | Application data: listings, owners, analytics, shortlinks, categories |
| `auth` | Supabase Auth: users, sessions, MFA, SSO, OAuth, identities |
| `storage` | Supabase Storage: buckets, objects, multipart uploads, vectors, analytics |
| `extensions` | Installed Postgres extensions: `pgcrypto`, `pg_stat_statements`, `pg_trgm`, `uuid-ossp`, `wrappers` |
| `vault` | Supabase Vault (`supabase_vault` extension) for encrypted secrets |

---

## 3. Public Schema — Tables (Full Detail)

### 3.1 Table: `public.listings`

**Comment:** Core business listings table
**RLS Enabled:** Yes
**Row Count:** 54
**Primary Key:** `id` (uuid)

#### Column Definitions

| Column | Type | Nullable | Default | Notes / Constraints |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | Primary key |
| `slug` | `text` | NOT NULL | — | UNIQUE; URL-safe identifier |
| `business_name` | `text` | NOT NULL | — | |
| `tagline` | `text` | NULL | — | |
| `description` | `text` | NULL | — | |
| `category` | `text` | NOT NULL | — | |
| `subcategories` | `text[]` | NULL | `'{}'::text[]` | Array of subcategory labels |
| `primary_subcategory` | `text` | NULL | — | |
| `tier` | `text` | NULL | `'FREE'::text` | CHECK: `IN ('FREE','VERIFIED','FEATURED','PREMIUM')`. Comment: Subscription tier |
| `verified` | `boolean` | NULL | `false` | Comment: Whether listing has been verified |
| `visible` | `boolean` | NULL | `true` | Comment: Whether listing is publicly visible |
| `is_chain` | `boolean` | NULL | `false` | Comment: Whether this is part of a chain business |
| `chain_name` | `text` | NULL | — | |
| `chain_id` | `text` | NULL | — | Comment: Shared ID for all locations in a chain |
| `more_listings_title_custom` | `text` | NULL | — | Custom title for the More Listings section; defaults to `More Locations` when blank or NULL |
| `address` | `text` | NULL | — | |
| `city` | `text` | NULL | — | |
| `state` | `text` | NULL | — | |
| `zip_code` | `text` | NULL | — | |
| `country` | `text` | NULL | `'USA'::text` | |
| `coordinates` | `jsonb` | NULL | — | Lat/lng object |
| `places_url_ending` | `text[]` | NULL | `'{}'::text[]` | Comment: Array of local page slug paths this listing belongs to |
| `phone` | `text` | NULL | — | |
| `email` | `text` | NULL | — | |
| `website` | `text` | NULL | — | |
| `hours` | `jsonb` | NULL | `'{}'::jsonb` | Business hours object |
| `social_media` | `jsonb` | NULL | `'{}'::jsonb` | Social media links object |
| `reviews` | `jsonb` | NULL | `'{}'::jsonb` | Reviews data object |
| `logo` | `text` | NULL | — | URL to logo image |
| `photos` | `text[]` | NULL | `'{}'::text[]` | Array of photo URLs |
| `video` | `text` | NULL | — | Video URL |
| `meta_description` | `text` | NULL | — | SEO meta description |
| `is_claimed` | `boolean` | NULL | `false` | Comment: Whether the listing has been claimed by a business owner |
| `additional_info` | `jsonb` | NULL | `'[]'::jsonb` | Flexible extra info array |
| `custom_ctas` | `jsonb` | NULL | `'[]'::jsonb` | Custom call-to-action buttons array |
| `pricing` | `smallint` | NULL | — | Price level indicator |
| `coming_soon` | `boolean` | NOT NULL | `false` | |
| `timezone` | `text` | NOT NULL | `'America/Chicago'::text` | CHECK: `timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)+$'`. Comment: IANA timezone name |
| `hours_label_custom` | `text` | NULL | — | Custom label for the hours section |
| `hours_disclaimer_custom` | `text` | NULL | — | Custom disclaimer for hours |
| `custom_schema_properties` | `text` | NULL | — | Additional JSON-LD schema properties |
| `updated_by_role` | `text` | NULL | — | Tracks who last updated: `owner`, `admin`, etc. |
| `temporarily_closed` | `boolean` | NOT NULL | `false` | |
| `permanently_closed` | `boolean` | NOT NULL | `false` | |
| `created_at` | `timestamptz` | NULL | `now()` | |
| `updated_at` | `timestamptz` | NULL | `now()` | Auto-updated by trigger |

#### Unique Constraints
- `listings_slug_key` on `slug`

#### Foreign Keys (referencing this table)
- `listing_analytics_summary.listing_id → listings.id`
- `shortlinks.listing_refer_id → listings.id`
- `listing_analytics.listing_id → listings.id`
- `business_owners.listing_id → listings.id`

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.listings (
  id                       uuid         NOT NULL DEFAULT gen_random_uuid(),
  slug                     text         NOT NULL,
  business_name            text         NOT NULL,
  tagline                  text,
  description              text,
  category                 text         NOT NULL,
  subcategories            text[]                DEFAULT '{}'::text[],
  primary_subcategory      text,
  tier                     text                  DEFAULT 'FREE'::text
                                        CHECK (tier = ANY (ARRAY['FREE','VERIFIED','FEATURED','PREMIUM'])),
  verified                 boolean               DEFAULT false,
  visible                  boolean               DEFAULT true,
  is_chain                 boolean               DEFAULT false,
  chain_name               text,
  chain_id                 text,
  more_listings_title_custom text,
  address                  text,
  city                     text,
  state                    text,
  zip_code                 text,
  country                  text                  DEFAULT 'USA'::text,
  coordinates              jsonb,
  places_url_ending        text[]                DEFAULT '{}'::text[],
  phone                    text,
  email                    text,
  website                  text,
  hours                    jsonb                 DEFAULT '{}'::jsonb,
  social_media             jsonb                 DEFAULT '{}'::jsonb,
  reviews                  jsonb                 DEFAULT '{}'::jsonb,
  logo                     text,
  photos                   text[]                DEFAULT '{}'::text[],
  video                    text,
  meta_description         text,
  is_claimed               boolean               DEFAULT false,
  additional_info          jsonb                 DEFAULT '[]'::jsonb,
  custom_ctas              jsonb                 DEFAULT '[]'::jsonb,
  pricing                  smallint,
  coming_soon              boolean      NOT NULL DEFAULT false,
  timezone                 text         NOT NULL DEFAULT 'America/Chicago'::text
                                        CHECK (timezone ~ '^[A-Za-z_]+(?:/[A-Za-z0-9_+\-]+)+$'),
  hours_label_custom       text,
  hours_disclaimer_custom  text,
  custom_schema_properties text,
  updated_by_role          text,
  temporarily_closed       boolean      NOT NULL DEFAULT false,
  permanently_closed       boolean      NOT NULL DEFAULT false,
  created_at               timestamptz           DEFAULT now(),
  updated_at               timestamptz           DEFAULT now(),
  CONSTRAINT listings_pkey PRIMARY KEY (id),
  CONSTRAINT listings_slug_key UNIQUE (slug)
);

COMMENT ON TABLE public.listings IS 'Core business listings table';
COMMENT ON COLUMN public.listings.tier IS 'Subscription tier: FREE, VERIFIED, FEATURED, or PREMIUM';
COMMENT ON COLUMN public.listings.verified IS 'Whether listing has been verified';
COMMENT ON COLUMN public.listings.visible IS 'Whether listing is publicly visible';
COMMENT ON COLUMN public.listings.is_chain IS 'Whether this is part of a chain business';
COMMENT ON COLUMN public.listings.chain_id IS 'Shared ID for all locations in a chain';
COMMENT ON COLUMN public.listings.more_listings_title_custom IS 'Custom title for the More Listings section on listing pages; defaults to More Locations when blank or NULL';
COMMENT ON COLUMN public.listings.places_url_ending IS 'Array of local page slug paths this listing belongs to, e.g. {"/chicago","/illinois"}. Used for future Local Pages feature.';
COMMENT ON COLUMN public.listings.is_claimed IS 'Whether the listing has been claimed by a business owner';
COMMENT ON COLUMN public.listings.timezone IS 'IANA timezone name used for server-authoritative hours and open/closed status calculations (example: America/Chicago).';

ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
```

---

### 3.2 Table: `public.business_owners`

**Comment:** Business owner information and authentication
**RLS Enabled:** Yes
**Row Count:** 54
**Primary Key:** `id` (bigint, sequence)

#### Column Definitions

| Column | Type | Nullable | Default | Notes / Constraints |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval('business_owners_id_seq')` | Primary key |
| `listing_id` | `uuid` | NOT NULL | — | FK → `listings.id` |
| `full_name` | `text` | NULL | — | |
| `title` | `text` | NULL | — | Job title |
| `from_greece` | `text` | NULL | — | Origin info |
| `owner_email` | `text` | NULL | — | Used for auth matching |
| `owner_phone` | `text` | NULL | — | |
| `owner_user_id` | `text` | NULL | — | UNIQUE; Comment: Unique identifier for authenticated business owner |
| `confirmation_key` | `text` | NULL | — | Comment: Key used to claim unclaimed listings |
| `name_title_visible` | `boolean` | NOT NULL | `true` | |
| `owner_email_visible` | `boolean` | NOT NULL | `true` | |
| `email_visible` | `boolean` | NULL | — | |
| `phone_visible` | `boolean` | NULL | — | |
| `claim_attempts` | `integer` | NOT NULL | `0` | Comment: Number of failed confirmation key attempts. Reset on success. |
| `claim_locked_until` | `timestamptz` | NULL | — | Comment: Timestamp until which claim attempts are locked out after 5 failures. |
| `created_at` | `timestamptz` | NULL | `now()` | |
| `updated_at` | `timestamptz` | NULL | `now()` | Auto-updated by trigger |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.business_owners (
  id                   bigint      NOT NULL DEFAULT nextval('business_owners_id_seq'::regclass),
  listing_id           uuid        NOT NULL,
  full_name            text,
  title                text,
  from_greece          text,
  owner_email          text,
  owner_phone          text,
  owner_user_id        text                 UNIQUE,
  confirmation_key     text,
  name_title_visible   boolean     NOT NULL DEFAULT true,
  owner_email_visible  boolean     NOT NULL DEFAULT true,
  email_visible        boolean,
  phone_visible        boolean,
  claim_attempts       integer     NOT NULL DEFAULT 0,
  claim_locked_until   timestamptz,
  created_at           timestamptz          DEFAULT now(),
  updated_at           timestamptz          DEFAULT now(),
  CONSTRAINT business_owners_pkey       PRIMARY KEY (id),
  CONSTRAINT business_owners_owner_user_id_key UNIQUE (owner_user_id),
  CONSTRAINT business_owners_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES public.listings(id)
);

COMMENT ON TABLE public.business_owners IS 'Business owner information and authentication';
COMMENT ON COLUMN public.business_owners.owner_user_id IS 'Unique identifier for authenticated business owner';
COMMENT ON COLUMN public.business_owners.confirmation_key IS 'Key used to claim unclaimed listings';
COMMENT ON COLUMN public.business_owners.claim_attempts IS 'Number of failed confirmation key attempts. Reset on success.';
COMMENT ON COLUMN public.business_owners.claim_locked_until IS 'Timestamp until which claim attempts are locked out after 5 failures.';

ALTER TABLE public.business_owners ENABLE ROW LEVEL SECURITY;
```

---

### 3.3 Table: `public.listing_analytics`

**Comment:** Individual analytics events for listing pages (views, clicks, shares)
**RLS Enabled:** Yes
**Row Count:** 169
**Primary Key:** `id` (bigint, sequence)

#### Column Definitions

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval('listing_analytics_id_seq')` | Primary key |
| `listing_id` | `uuid` | NOT NULL | — | FK → `listings.id` |
| `action` | `text` | NOT NULL | — | Comment: Type of event: `view`, `call`, `website`, `directions`, `share`, `video` |
| `platform` | `text` | NULL | — | Comment: Share platform: `facebook`, `twitter`, `linkedin`, `sms`, `email`, `native` |
| `timestamp` | `timestamptz` | NULL | `now()` | |
| `user_agent` | `text` | NULL | — | |
| `created_at` | `timestamptz` | NULL | `now()` | |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.listing_analytics (
  id         bigint      NOT NULL DEFAULT nextval('listing_analytics_id_seq'::regclass),
  listing_id uuid        NOT NULL,
  action     text        NOT NULL,
  platform   text,
  "timestamp" timestamptz        DEFAULT now(),
  user_agent text,
  created_at timestamptz        DEFAULT now(),
  CONSTRAINT listing_analytics_pkey PRIMARY KEY (id),
  CONSTRAINT listing_analytics_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES public.listings(id)
);

COMMENT ON TABLE public.listing_analytics IS 'Individual analytics events for listing pages (views, clicks, shares)';
COMMENT ON COLUMN public.listing_analytics.action IS 'Type of event: view, call, website, directions, share, video';
COMMENT ON COLUMN public.listing_analytics.platform IS 'Share platform: facebook, twitter, linkedin, sms, email, native (only for share actions)';

ALTER TABLE public.listing_analytics ENABLE ROW LEVEL SECURITY;
```

---

### 3.4 Table: `public.listing_analytics_summary`

**Comment:** (none — materialized-style summary table)
**RLS Enabled:** Yes
**Row Count:** 54
**Primary Key:** `listing_id` (uuid)

This table is a pre-aggregated analytics summary maintained via the `increment_listing_analytics` SECURITY DEFINER trigger function. It stores window-based counters (7d, 14d, 1m, 3m, 6m, 1y, 2y, all) for every tracked action type per listing.

#### Tracked Action Types & Their Column Groups

| Action | Column Group Pattern |
|---|---|
| `view` | `views_{window}` |
| `call` | `call_clicks_{window}` |
| `email` | `email_clicks_{window}` |
| `website` | `website_clicks_{window}` |
| `directions` | `directions_clicks_{window}` |
| `custom_cta_1` | `custom_cta_1_{window}` |
| `custom_cta_2` | `custom_cta_2_{window}` |
| `share` | `share_clicks_{window}` |

**Windows:** `7d`, `14d`, `1m`, `3m`, `6m`, `1y`, `2y`, `all` (8 per action type)

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.listing_analytics_summary (
  listing_id              uuid    NOT NULL,
  -- views
  views_7d                integer NOT NULL DEFAULT 0,
  views_14d               integer NOT NULL DEFAULT 0,
  views_1m                integer NOT NULL DEFAULT 0,
  views_3m                integer NOT NULL DEFAULT 0,
  views_6m                integer NOT NULL DEFAULT 0,
  views_1y                integer NOT NULL DEFAULT 0,
  views_2y                integer NOT NULL DEFAULT 0,
  views_all               integer NOT NULL DEFAULT 0,
  -- call_clicks
  call_clicks_7d          integer NOT NULL DEFAULT 0,
  call_clicks_14d         integer NOT NULL DEFAULT 0,
  call_clicks_1m          integer NOT NULL DEFAULT 0,
  call_clicks_3m          integer NOT NULL DEFAULT 0,
  call_clicks_6m          integer NOT NULL DEFAULT 0,
  call_clicks_1y          integer NOT NULL DEFAULT 0,
  call_clicks_2y          integer NOT NULL DEFAULT 0,
  call_clicks_all         integer NOT NULL DEFAULT 0,
  -- email_clicks
  email_clicks_7d         integer NOT NULL DEFAULT 0,
  email_clicks_14d        integer NOT NULL DEFAULT 0,
  email_clicks_1m         integer NOT NULL DEFAULT 0,
  email_clicks_3m         integer NOT NULL DEFAULT 0,
  email_clicks_6m         integer NOT NULL DEFAULT 0,
  email_clicks_1y         integer NOT NULL DEFAULT 0,
  email_clicks_2y         integer NOT NULL DEFAULT 0,
  email_clicks_all        integer NOT NULL DEFAULT 0,
  -- website_clicks
  website_clicks_7d       integer NOT NULL DEFAULT 0,
  website_clicks_14d      integer NOT NULL DEFAULT 0,
  website_clicks_1m       integer NOT NULL DEFAULT 0,
  website_clicks_3m       integer NOT NULL DEFAULT 0,
  website_clicks_6m       integer NOT NULL DEFAULT 0,
  website_clicks_1y       integer NOT NULL DEFAULT 0,
  website_clicks_2y       integer NOT NULL DEFAULT 0,
  website_clicks_all      integer NOT NULL DEFAULT 0,
  -- directions_clicks
  directions_clicks_7d    integer NOT NULL DEFAULT 0,
  directions_clicks_14d   integer NOT NULL DEFAULT 0,
  directions_clicks_1m    integer NOT NULL DEFAULT 0,
  directions_clicks_3m    integer NOT NULL DEFAULT 0,
  directions_clicks_6m    integer NOT NULL DEFAULT 0,
  directions_clicks_1y    integer NOT NULL DEFAULT 0,
  directions_clicks_2y    integer NOT NULL DEFAULT 0,
  directions_clicks_all   integer NOT NULL DEFAULT 0,
  -- custom_cta_1
  custom_cta_1_7d         integer NOT NULL DEFAULT 0,
  custom_cta_1_14d        integer NOT NULL DEFAULT 0,
  custom_cta_1_1m         integer NOT NULL DEFAULT 0,
  custom_cta_1_3m         integer NOT NULL DEFAULT 0,
  custom_cta_1_6m         integer NOT NULL DEFAULT 0,
  custom_cta_1_1y         integer NOT NULL DEFAULT 0,
  custom_cta_1_2y         integer NOT NULL DEFAULT 0,
  custom_cta_1_all        integer NOT NULL DEFAULT 0,
  -- custom_cta_2
  custom_cta_2_7d         integer NOT NULL DEFAULT 0,
  custom_cta_2_14d        integer NOT NULL DEFAULT 0,
  custom_cta_2_1m         integer NOT NULL DEFAULT 0,
  custom_cta_2_3m         integer NOT NULL DEFAULT 0,
  custom_cta_2_6m         integer NOT NULL DEFAULT 0,
  custom_cta_2_1y         integer NOT NULL DEFAULT 0,
  custom_cta_2_2y         integer NOT NULL DEFAULT 0,
  custom_cta_2_all        integer NOT NULL DEFAULT 0,
  -- share_clicks
  share_clicks_7d         integer NOT NULL DEFAULT 0,
  share_clicks_14d        integer NOT NULL DEFAULT 0,
  share_clicks_1m         integer NOT NULL DEFAULT 0,
  share_clicks_3m         integer NOT NULL DEFAULT 0,
  share_clicks_6m         integer NOT NULL DEFAULT 0,
  share_clicks_1y         integer NOT NULL DEFAULT 0,
  share_clicks_2y         integer NOT NULL DEFAULT 0,
  share_clicks_all        integer NOT NULL DEFAULT 0,
  -- metadata
  updated_at              timestamptz      DEFAULT now(),
  CONSTRAINT listing_analytics_summary_pkey PRIMARY KEY (listing_id),
  CONSTRAINT listing_analytics_summary_listing_id_fkey
    FOREIGN KEY (listing_id) REFERENCES public.listings(id)
);

ALTER TABLE public.listing_analytics_summary ENABLE ROW LEVEL SECURITY;
```

---

### 3.5 Table: `public.listing_requests`

**RLS Enabled:** Yes
**Row Count:** 0
**Primary Key:** `id` (bigint, identity BY DEFAULT)

This table mirrors `listings` and `business_owners` structure for intake of new listing submission requests before admin review/approval.

#### Column Definitions

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `bigint` | NOT NULL | identity BY DEFAULT |
| `created_at` | `timestamptz` | NOT NULL | `now()` |
| `updated_at` | `timestamptz` | NOT NULL | `now()` |
| `business_name` | `text` | NOT NULL | — |
| `slug` | `text` | NULL | — |
| `tagline` | `text` | NOT NULL | — |
| `description` | `text` | NOT NULL | — |
| `category` | `text` | NOT NULL | — |
| `subcategories` | `text[]` | NOT NULL | `'{}'::text[]` |
| `primary_subcategory` | `text` | NULL | — |
| `is_chain` | `boolean` | NOT NULL | `false` |
| `chain_name` | `text` | NULL | — |
| `chain_id` | `text` | NULL | — |
| `address` | `text` | NULL | — |
| `city` | `text` | NULL | — |
| `state` | `text` | NULL | — |
| `zip_code` | `text` | NULL | — |
| `country` | `text` | NULL | `'USA'::text` |
| `phone` | `text` | NULL | — |
| `email` | `text` | NULL | — |
| `website` | `text` | NULL | — |
| `logo` | `text` | NULL | — |
| `photos` | `text[]` | NULL | `'{}'::text[]` |
| `video` | `text` | NULL | — |
| `hours` | `jsonb` | NULL | `'{}'::jsonb` |
| `social_media` | `jsonb` | NULL | `'{}'::jsonb` |
| `reviews` | `jsonb` | NULL | `'{}'::jsonb` |
| `additional_info` | `jsonb` | NULL | `'[]'::jsonb` |
| `custom_ctas` | `jsonb` | NULL | `'[]'::jsonb` |
| `owner_name` | `text` | NULL | — |
| `owner_title` | `text` | NULL | — |
| `from_greece` | `text` | NULL | — |
| `owner_email` | `text` | NULL | — |
| `owner_phone` | `text` | NULL | — |
| `owner_name_title_visible` | `boolean` | NOT NULL | `true` |
| `owner_email_visible` | `boolean` | NOT NULL | `false` |
| `owner_phone_visible` | `boolean` | NOT NULL | `false` |
| `owner_contacts` | `jsonb` | NULL | `'[]'::jsonb` |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.listing_requests (
  id                     bigint      GENERATED BY DEFAULT AS IDENTITY,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  business_name          text        NOT NULL,
  slug                   text,
  tagline                text        NOT NULL,
  description            text        NOT NULL,
  category               text        NOT NULL,
  subcategories          text[]      NOT NULL DEFAULT '{}'::text[],
  primary_subcategory    text,
  is_chain               boolean     NOT NULL DEFAULT false,
  chain_name             text,
  chain_id               text,
  address                text,
  city                   text,
  state                  text,
  zip_code               text,
  country                text                 DEFAULT 'USA'::text,
  phone                  text,
  email                  text,
  website                text,
  logo                   text,
  photos                 text[]               DEFAULT '{}'::text[],
  video                  text,
  hours                  jsonb                DEFAULT '{}'::jsonb,
  social_media           jsonb                DEFAULT '{}'::jsonb,
  reviews                jsonb                DEFAULT '{}'::jsonb,
  additional_info        jsonb                DEFAULT '[]'::jsonb,
  custom_ctas            jsonb                DEFAULT '[]'::jsonb,
  owner_name             text,
  owner_title            text,
  from_greece            text,
  owner_email            text,
  owner_phone            text,
  owner_name_title_visible boolean NOT NULL  DEFAULT true,
  owner_email_visible    boolean     NOT NULL DEFAULT false,
  owner_phone_visible    boolean     NOT NULL DEFAULT false,
  owner_contacts         jsonb                DEFAULT '[]'::jsonb,
  CONSTRAINT listing_requests_pkey PRIMARY KEY (id)
);

ALTER TABLE public.listing_requests ENABLE ROW LEVEL SECURITY;
```

---

### 3.6 Table: `public.listing_suggestions`

**RLS Enabled:** Yes
**Row Count:** 0
**Primary Key:** `id` (bigint, sequence)

Accepts community-submitted edits/suggestions for existing listings. Contains a full mirror of listing fields plus suggester contact info and a `status` workflow column.

#### Column Definitions (Key Fields)

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `bigint` | NOT NULL | `nextval('listing_suggestions_id_seq')` | PK |
| `listing_id` | `text` | NOT NULL | — | Target listing ID (as text) |
| `listing_name` | `text` | NULL | — | |
| `suggester_name` | `text` | NOT NULL | — | |
| `suggester_email` | `text` | NOT NULL | — | |
| `suggester_phone` | `text` | NULL | — | |
| `suggester_message` | `text` | NULL | — | |
| `status` | `text` | NOT NULL | `'pending'::text` | Workflow: `pending`, etc. |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |
| *(all listing fields)* | various | NULL | — | business_name, tagline, description, category, subcategories, address, city, state, zip_code, country, phone, email, website, logo, photos, video, hours, social_media, reviews, additional_info, custom_ctas, owner_name, owner_title, from_greece, owner_email, owner_phone, owner_name_title_visible, owner_email_visible, owner_phone_visible, owner_contacts, pricing, coming_soon, primary_subcategory |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.listing_suggestions (
  id                       bigint    NOT NULL DEFAULT nextval('listing_suggestions_id_seq'::regclass),
  listing_id               text      NOT NULL,
  listing_name             text,
  suggester_name           text      NOT NULL,
  suggester_email          text      NOT NULL,
  suggester_phone          text,
  suggester_message        text,
  status                   text      NOT NULL DEFAULT 'pending'::text,
  -- mirrored listing fields (all nullable):
  business_name            text,
  tagline                  text,
  description              text,
  category                 text,
  subcategories            text[],
  primary_subcategory      text,
  pricing                  integer,
  coming_soon              boolean,
  address                  text,
  city                     text,
  state                    text,
  zip_code                 text,
  country                  text,
  phone                    text,
  email                    text,
  website                  text,
  logo                     text,
  photos                   text[],
  video                    text,
  hours                    jsonb,
  social_media             jsonb,
  reviews                  jsonb,
  additional_info          jsonb[],
  custom_ctas              jsonb[],
  owner_name               text,
  owner_title              text,
  from_greece              text,
  owner_email              text,
  owner_phone              text,
  owner_name_title_visible boolean,
  owner_email_visible      boolean,
  owner_phone_visible      boolean,
  owner_contacts           jsonb[],
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_suggestions_pkey PRIMARY KEY (id)
);

ALTER TABLE public.listing_suggestions ENABLE ROW LEVEL SECURITY;
```

---

### 3.7 Table: `public.shortlinks`

**RLS Enabled:** Yes
**Row Count:** 431
**Primary Key:** `id` (uuid)

Stores URL shortlinks for listings and arbitrary redirects. `listing_custom` distinguishes system-generated shortlinks from owner-customized ones.

#### Column Definitions

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | `uuid` | NOT NULL | `gen_random_uuid()` | PK |
| `title` | `text` | NULL | — | |
| `path` | `text` | NOT NULL | — | UNIQUE; the shortlink path segment |
| `redirect_to` | `text` | NOT NULL | — | Destination URL |
| `listing_refer_id` | `uuid` | NULL | — | FK → `listings.id` |
| `listing_custom` | `boolean` | NOT NULL | `false` | Whether owner-customized |
| `created_at` | `timestamptz` | NOT NULL | `now()` | |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.shortlinks (
  id                uuid        NOT NULL DEFAULT gen_random_uuid(),
  title             text,
  path              text        NOT NULL,
  redirect_to       text        NOT NULL,
  listing_refer_id  uuid,
  listing_custom    boolean     NOT NULL DEFAULT false,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shortlinks_pkey     PRIMARY KEY (id),
  CONSTRAINT shortlinks_path_key UNIQUE (path),
  CONSTRAINT shortlinks_listing_refer_id_fkey
    FOREIGN KEY (listing_refer_id) REFERENCES public.listings(id)
);

ALTER TABLE public.shortlinks ENABLE ROW LEVEL SECURITY;
```

---

### 3.8 Table: `public.shortlink_events`

**RLS Enabled:** Yes
**Row Count:** 103
**Primary Key:** `id` (bigint, identity ALWAYS)

Logs every shortlink click event with geo data from Cloudflare/CDN headers.

#### Column Definitions

| Column | Type | Nullable | Default |
|---|---|---|---|
| `id` | `bigint` | NOT NULL | identity ALWAYS |
| `path` | `text` | NOT NULL | — |
| `redirect_url` | `text` | NOT NULL | — |
| `user_agent` | `text` | NULL | — |
| `ip` | `text` | NULL | — |
| `city` | `text` | NULL | — |
| `region` | `text` | NULL | — |
| `country` | `text` | NULL | — |
| `latitude` | `numeric` | NULL | — |
| `longitude` | `numeric` | NULL | — |
| `timezone` | `text` | NULL | — |
| `event_time` | `timestamptz` | NOT NULL | `now()` |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.shortlink_events (
  id           bigint      GENERATED ALWAYS AS IDENTITY,
  path         text        NOT NULL,
  redirect_url text        NOT NULL,
  user_agent   text,
  ip           text,
  city         text,
  region       text,
  country      text,
  latitude     numeric,
  longitude    numeric,
  timezone     text,
  event_time   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shortlink_events_pkey PRIMARY KEY (id)
);

ALTER TABLE public.shortlink_events ENABLE ROW LEVEL SECURITY;
```

---

### 3.9 Table: `public.category_subcategories`

**RLS Enabled:** Yes
**Row Count:** 14
**Primary Key:** `category` (text)

Lookup/reference table defining which subcategories belong to each category, and the JSON-LD schema type map per subcategory.

#### Column Definitions

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `category` | `text` | NOT NULL | — | PK; category name |
| `subcategories` | `text[]` | NOT NULL | `'{}'::text[]` | Array of subcategory labels |
| `schema_type_map` | `jsonb` | NOT NULL | `'{}'::jsonb` | Map of subcategory → JSON-LD `@type` |

#### SQL DDL (Reconstructed)
```sql
CREATE TABLE public.category_subcategories (
  category       text   NOT NULL,
  subcategories  text[] NOT NULL DEFAULT '{}'::text[],
  schema_type_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT category_subcategories_pkey PRIMARY KEY (category)
);

ALTER TABLE public.category_subcategories ENABLE ROW LEVEL SECURITY;
```

---

## 4. Auth Schema — Tables Summary

All `auth.*` tables have RLS enabled. These are managed by Supabase Auth and should not be modified directly.

| Table | Rows | Purpose |
|---|---|---|
| `auth.users` | 2 | Core user accounts; stores login credentials, metadata, MFA status |
| `auth.identities` | 2 | OAuth/SSO identities linked to users |
| `auth.sessions` | 0 | Active user sessions |
| `auth.refresh_tokens` | 0 | JWT refresh token store |
| `auth.mfa_factors` | 0 | TOTP / WebAuthn / Phone MFA factor registrations |
| `auth.mfa_challenges` | 0 | Pending MFA challenge attempts |
| `auth.mfa_amr_claims` | 0 | Authenticator method reference claims |
| `auth.one_time_tokens` | 1 | Pending email confirmation / recovery tokens |
| `auth.flow_state` | 0 | OAuth/SSO login flow metadata |
| `auth.sso_providers` | 0 | SAML/SSO identity provider connections |
| `auth.sso_domains` | 0 | Email domain → SSO provider mapping |
| `auth.saml_providers` | 0 | SAML IdP configurations |
| `auth.saml_relay_states` | 0 | SAML relay state for SP-initiated logins |
| `auth.instances` | 0 | Multi-site instance management |
| `auth.audit_log_entries` | 0 | Audit trail for auth events |
| `auth.schema_migrations` | 76 | Auth system migration versions |
| `auth.oauth_clients` | 0 | OAuth 2.0 client registrations |
| `auth.oauth_authorizations` | 0 | Pending/completed OAuth authorization codes |
| `auth.oauth_consents` | 0 | User consent records for OAuth scopes |
| `auth.oauth_client_states` | 0 | OAuth PKCE states for third-party provider flows |
| `auth.custom_oauth_providers` | 0 | Custom OAuth2/OIDC provider configs |
| `auth.webauthn_credentials` | 0 | Registered WebAuthn/Passkey credentials |
| `auth.webauthn_challenges` | 0 | Pending WebAuthn challenge sessions |

**Notable `auth.users` columns:**
- `id` (uuid, PK), `email`, `encrypted_password`, `role`, `aud`
- `raw_user_meta_data` (jsonb) — user-editable; **do NOT use in RLS policies**
- `raw_app_meta_data` (jsonb) — server-controlled; safe for role assignments
- `confirmed_at` (generated: `LEAST(email_confirmed_at, phone_confirmed_at)`)
- `is_anonymous`, `is_sso_user`, `is_super_admin`
- `email_change_confirm_status` CHECK: `0–2`
- `banned_until` timestamptz

---

## 5. Storage Schema — Tables Summary

| Table | Rows | Purpose |
|---|---|---|
| `storage.buckets` | 0 | Standard storage bucket registry |
| `storage.objects` | 0 | Files stored in standard buckets |
| `storage.s3_multipart_uploads` | 0 | In-progress multipart uploads |
| `storage.s3_multipart_uploads_parts` | 0 | Individual parts of multipart uploads |
| `storage.buckets_analytics` | 1 | ANALYTICS-type bucket registry (Iceberg format) |
| `storage.buckets_vectors` | 0 | VECTOR-type bucket registry |
| `storage.vector_indexes` | 0 | Vector index configurations |
| `storage.migrations` | 61 | Storage system migration versions |

**Note:** There is 1 analytics bucket provisioned but 0 standard or vector buckets. No objects have been stored yet.

---

## 6. RLS Policies — Per Table

### 6.1 `public.listings`

| Policy Name | Command | Roles | Type | USING / WITH CHECK |
|---|---|---|---|---|
| `tgd_listings_select` | SELECT | public | PERMISSIVE | `(visible = true) OR analytics_is_admin() OR id IN (SELECT bo.listing_id FROM business_owners bo WHERE (bo.owner_email IS NOT NULL AND bo.owner_email = (SELECT auth.email())))` |
| `tgd_listings_update` | UPDATE | public | PERMISSIVE | `analytics_is_admin() OR id IN (SELECT bo.listing_id FROM business_owners bo WHERE (bo.owner_email IS NOT NULL AND bo.owner_email = (SELECT auth.email())))` |
| `tgd_listings_admin_insert` | INSERT | public | PERMISSIVE | WITH CHECK: `analytics_is_admin()` |
| `tgd_listings_admin_delete` | DELETE | public | PERMISSIVE | `analytics_is_admin()` |

**Full SQL:**
```sql
-- SELECT policy
CREATE POLICY tgd_listings_select ON public.listings
  AS PERMISSIVE FOR SELECT TO public
  USING (
    (visible = true)
    OR analytics_is_admin()
    OR (id IN (
      SELECT bo.listing_id FROM business_owners bo
      WHERE (bo.owner_email IS NOT NULL)
        AND (bo.owner_email = (SELECT auth.email()))
    ))
  );

-- UPDATE policy
CREATE POLICY tgd_listings_update ON public.listings
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    analytics_is_admin()
    OR (id IN (
      SELECT bo.listing_id FROM business_owners bo
      WHERE (bo.owner_email IS NOT NULL)
        AND (bo.owner_email = (SELECT auth.email()))
    ))
  )
  WITH CHECK (
    analytics_is_admin()
    OR (id IN (
      SELECT bo.listing_id FROM business_owners bo
      WHERE (bo.owner_email IS NOT NULL)
        AND (bo.owner_email = (SELECT auth.email()))
    ))
  );

-- INSERT policy (admin only)
CREATE POLICY tgd_listings_admin_insert ON public.listings
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (analytics_is_admin());

-- DELETE policy (admin only)
CREATE POLICY tgd_listings_admin_delete ON public.listings
  AS PERMISSIVE FOR DELETE TO public
  USING (analytics_is_admin());
```

---

### 6.2 `public.business_owners`

| Policy Name | Command | Roles | Type | Notes |
|---|---|---|---|---|
| `tgd_owners_select` | SELECT | public | PERMISSIVE | admin OR unclaimed (confirmation_key NOT NULL AND owner_user_id IS NULL) OR owner_email match |
| `tgd_owners_update` | UPDATE | public | PERMISSIVE | USING: same as select; WITH CHECK: admin OR owner_email match |
| `tgd_owners_admin_insert` | INSERT | public | PERMISSIVE | WITH CHECK: `analytics_is_admin()` |
| `tgd_owners_admin_delete` | DELETE | public | PERMISSIVE | `analytics_is_admin()` |

**Full SQL:**
```sql
-- SELECT policy
CREATE POLICY tgd_owners_select ON public.business_owners
  AS PERMISSIVE FOR SELECT TO public
  USING (
    analytics_is_admin()
    OR ((confirmation_key IS NOT NULL) AND (owner_user_id IS NULL))
    OR ((owner_email IS NOT NULL) AND (owner_email = (SELECT auth.email())))
  );

-- UPDATE policy
CREATE POLICY tgd_owners_update ON public.business_owners
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    analytics_is_admin()
    OR ((confirmation_key IS NOT NULL) AND (owner_user_id IS NULL))
    OR ((owner_email IS NOT NULL) AND (owner_email = (SELECT auth.email())))
  )
  WITH CHECK (
    analytics_is_admin()
    OR ((owner_email IS NOT NULL) AND (owner_email = (SELECT auth.email())))
  );

-- INSERT (admin only)
CREATE POLICY tgd_owners_admin_insert ON public.business_owners
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (analytics_is_admin());

-- DELETE (admin only)
CREATE POLICY tgd_owners_admin_delete ON public.business_owners
  AS PERMISSIVE FOR DELETE TO public
  USING (analytics_is_admin());
```

---

### 6.3 `public.listing_analytics`

| Policy Name | Command | Roles | Notes |
|---|---|---|---|
| `listing_analytics_public_select` | SELECT | public | `USING (true)` — fully public |
| `listing_analytics_anon_insert` | INSERT | public | WITH CHECK: `listing_id IS NOT NULL AND action = ANY (ARRAY['view','call','website','directions','email','share','video','custom_cta_1','custom_cta_2'])` |
| `listing_analytics_admin_update` | UPDATE | public | admin or service_role only |
| `listing_analytics_admin_delete` | DELETE | public | admin or service_role only |

**Full SQL:**
```sql
CREATE POLICY listing_analytics_public_select ON public.listing_analytics
  AS PERMISSIVE FOR SELECT TO public USING (true);

CREATE POLICY listing_analytics_anon_insert ON public.listing_analytics
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    (listing_id IS NOT NULL)
    AND (action = ANY (ARRAY[
      'view'::text, 'call'::text, 'website'::text, 'directions'::text,
      'email'::text, 'share'::text, 'video'::text,
      'custom_cta_1'::text, 'custom_cta_2'::text
    ]))
  );

CREATE POLICY listing_analytics_admin_update ON public.listing_analytics
  AS PERMISSIVE FOR UPDATE TO public
  USING (
    ((SELECT auth.jwt() AS jwt) ->> 'role' = 'admin')
    OR ((SELECT auth.role() AS role) = 'service_role')
  )
  WITH CHECK (
    ((SELECT auth.jwt() AS jwt) ->> 'role' = 'admin')
    OR ((SELECT auth.role() AS role) = 'service_role')
  );

CREATE POLICY listing_analytics_admin_delete ON public.listing_analytics
  AS PERMISSIVE FOR DELETE TO public
  USING (
    ((SELECT auth.jwt() AS jwt) ->> 'role' = 'admin')
    OR ((SELECT auth.role() AS role) = 'service_role')
  );
```

---

### 6.4 `public.listing_analytics_summary`

| Policy Name | Command | Roles | Notes |
|---|---|---|---|
| `listing_analytics_summary_public_select` | SELECT | public | `USING (true)` — fully public |

*No INSERT/UPDATE/DELETE policies — all writes go through `SECURITY DEFINER` functions and the service role.*

---

### 6.5 `public.listing_requests`

| Policy Name | Command | Notes |
|---|---|---|
| `tgd_requests_admin_select` | SELECT | `analytics_is_admin()` only |
| `tgd_requests_public_insert` | INSERT | Public may insert if: `length(TRIM(business_name)) > 0 AND length(TRIM(tagline)) > 0 AND length(TRIM(description)) > 0 AND length(TRIM(category)) > 0` |
| `tgd_requests_admin_update` | UPDATE | `analytics_is_admin()` |
| `tgd_requests_admin_delete` | DELETE | `analytics_is_admin()` |

**Full SQL:**
```sql
CREATE POLICY tgd_requests_admin_select ON public.listing_requests
  AS PERMISSIVE FOR SELECT TO public USING (analytics_is_admin());

CREATE POLICY tgd_requests_public_insert ON public.listing_requests
  AS PERMISSIVE FOR INSERT TO public
  WITH CHECK (
    (length(TRIM(BOTH FROM business_name)) > 0)
    AND (length(TRIM(BOTH FROM tagline)) > 0)
    AND (length(TRIM(BOTH FROM description)) > 0)
    AND (length(TRIM(BOTH FROM category)) > 0)
  );

CREATE POLICY tgd_requests_admin_update ON public.listing_requests
  AS PERMISSIVE FOR UPDATE TO public
  USING (analytics_is_admin()) WITH CHECK (analytics_is_admin());

CREATE POLICY tgd_requests_admin_delete ON public.listing_requests
  AS PERMISSIVE FOR DELETE TO public USING (analytics_is_admin());
```

---

### 6.6 `public.listing_suggestions`

| Policy Name | Command | Roles | Notes |
|---|---|---|---|
| `Public can insert suggestions` | INSERT | anon, authenticated | WITH CHECK: `true` — **⚠️ Completely unrestricted** |

*No SELECT, UPDATE, or DELETE policies defined.*

---

### 6.7 `public.shortlinks`

| Policy Name | Command | Roles | Notes |
|---|---|---|---|
| `shortlinks_public_select` | SELECT | public | `USING (true)` |
| `Allow public read access` | SELECT | anon | `USING (true)` — **⚠️ Duplicate policy** |
| `shortlinks_service_insert` | INSERT | public | WITH CHECK: `analytics_is_admin()` |
| `shortlinks_service_update` | UPDATE | public | `analytics_is_admin()` |
| `shortlinks_service_delete` | DELETE | public | `analytics_is_admin()` |

---

### 6.8 `public.shortlink_events`

| Policy Name | Command | Notes |
|---|---|---|
| `shortlink_events_anon_select` | SELECT | `USING (true)` |
| `shortlink_events_anon_insert` | INSERT | WITH CHECK: `length(TRIM(path)) > 0 AND length(TRIM(redirect_url)) > 0` |

---

### 6.9 `public.category_subcategories`

| Policy Name | Command | Notes |
|---|---|---|
| `tgd_subcategories_select` | SELECT | `USING (true)` — fully public |
| `tgd_subcategories_admin_insert` | INSERT | `analytics_is_admin()` |
| `tgd_subcategories_admin_update` | UPDATE | `analytics_is_admin()` |
| `tgd_subcategories_admin_delete` | DELETE | `analytics_is_admin()` |

---

## 7. Public SQL Functions

### 7.1 `analytics_is_admin()` → boolean

**Language:** SQL | **Volatility:** STABLE | **Security:** INVOKER | **search_path:** `public`

Admin gate used across all RLS policies. Returns `true` for `service_role`, JWT role `admin`, or app_metadata role `admin`/`super_admin`.

```sql
CREATE OR REPLACE FUNCTION public.analytics_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    coalesce(auth.jwt() ->> 'role', '') IN ('service_role', 'admin')
    OR coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') IN ('admin', 'super_admin');
$$;
```

---

### 7.2 `analytics_is_approved_path()` → boolean

**Language:** SQL | **Volatility:** STABLE | **Security:** INVOKER | **search_path:** `public`

Extends admin check with path-based allow-listing for analytics write origins.

```sql
CREATE OR REPLACE FUNCTION public.analytics_is_approved_path()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    public.analytics_is_admin()
    OR coalesce(auth.jwt() ->> 'path', '') IN ('/listings', '/listing', '/listing.html');
$$;
```

---

### 7.3 `analytics_is_listing_owner(target_listing_id uuid)` → boolean

**Language:** SQL | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`

Checks if the calling auth user owns a specific listing by `owner_user_id`. ⚠️ Callable by `anon` — see Security Advisors. Note: `business_owners.owner_user_id` is currently unpopulated for all rows; this function always returns false for non-admin callers.

```sql
CREATE OR REPLACE FUNCTION public.analytics_is_listing_owner(target_listing_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_owners bo
    WHERE bo.listing_id = target_listing_id
      AND bo.owner_user_id::text = (SELECT auth.uid())::text
  );
$$;
```

---

### 7.4 `current_owner_listing_ids()` → TABLE(listing_id text)

**Language:** SQL | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`

Returns all listing IDs owned by the current authenticated user, matching by `owner_user_id` OR email. Used by KPI attribution RPCs.

```sql
CREATE OR REPLACE FUNCTION public.current_owner_listing_ids()
RETURNS TABLE(listing_id text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT bo.listing_id::text AS listing_id
  FROM public.business_owners bo
  WHERE (
    bo.owner_user_id = (SELECT auth.uid())::text
    OR lower(coalesce(bo.owner_email, '')) = lower(coalesce((SELECT auth.jwt()) ->> 'email', ''))
  );
$$;
```

---

### 7.5 `generate_slug(business_name text)` → text

**Language:** plpgsql | **Volatility:** IMMUTABLE | **Security:** INVOKER | **search_path:** `public`
**Comment:** Generates URL-safe slug from business name

```sql
CREATE OR REPLACE FUNCTION public.generate_slug(business_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $$
BEGIN
  RETURN lower(regexp_replace(business_name, '[^a-zA-Z0-9]+', '-', 'g'));
END;
$$;
```

---

### 7.6 `get_category_counts()` → TABLE(category text, count bigint)

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get listing counts per category

```sql
CREATE OR REPLACE FUNCTION public.get_category_counts()
RETURNS TABLE(category text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.category,
    COUNT(*)::BIGINT
  FROM public.listings l
  WHERE l.visible = true
  GROUP BY l.category
  ORDER BY l.category ASC;
END;
$$;
```

---

### 7.7 `get_chain_locations(p_chain_id text, exclude_listing_id bigint)` → SETOF listings

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get all locations for a chain business

> **Note:** The `exclude_listing_id` parameter is typed `bigint` but `listings.id` is now `uuid`. This function may be outdated following the `listings_id_int8_to_uuid` migration.

```sql
CREATE OR REPLACE FUNCTION public.get_chain_locations(
  p_chain_id text,
  exclude_listing_id bigint DEFAULT NULL::bigint
)
RETURNS SETOF listings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE
    visible = true
    AND chain_id = p_chain_id
    AND (exclude_listing_id IS NULL OR id != exclude_listing_id)
  ORDER BY city ASC, business_name ASC;
END;
$$;
```

---

### 7.8 `get_featured_listings(limit_count integer)` → SETOF listings

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get featured and premium listings

```sql
CREATE OR REPLACE FUNCTION public.get_featured_listings(limit_count integer DEFAULT 10)
RETURNS SETOF listings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE
    visible = true
    AND tier IN ('FEATURED', 'PREMIUM')
  ORDER BY
    CASE tier
      WHEN 'PREMIUM'  THEN 1
      WHEN 'FEATURED' THEN 2
    END,
    RANDOM()
  LIMIT limit_count;
END;
$$;
```

---

### 7.9 `get_listing_analytics(p_listing_id bigint)` → TABLE(...)

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Retrieves analytics summary for a listing

> **Note:** References `public.analytics_summary` which does not exist in the current schema. This function is likely a legacy artifact. The current summary table is `listing_analytics_summary`.

```sql
CREATE OR REPLACE FUNCTION public.get_listing_analytics(p_listing_id bigint)
RETURNS TABLE(
  views bigint, call_clicks bigint, website_clicks bigint,
  direction_clicks bigint, share_clicks bigint, video_plays bigint,
  share_platforms jsonb, last_viewed timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.views, s.call_clicks, s.website_clicks, s.direction_clicks,
    s.share_clicks, s.video_plays, s.share_platforms, s.last_viewed
  FROM public.analytics_summary s
  WHERE s.listing_id = p_listing_id;
END;
$$;
```

---

### 7.10 `get_listings_by_category(category_name text, limit_count integer, offset_count integer)` → SETOF listings

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get all listings in a category, sorted by tier

```sql
CREATE OR REPLACE FUNCTION public.get_listings_by_category(
  category_name text,
  limit_count   integer DEFAULT 50,
  offset_count  integer DEFAULT 0
)
RETURNS SETOF listings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE
    visible = true
    AND category = category_name
  ORDER BY
    CASE tier
      WHEN 'PREMIUM'  THEN 1
      WHEN 'FEATURED' THEN 2
      WHEN 'VERIFIED' THEN 3
      WHEN 'FREE'     THEN 4
    END,
    business_name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;
```

---

### 7.11 `get_listings_by_location(p_city, p_state, limit_count, offset_count)` → SETOF listings

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get all listings in a location

```sql
CREATE OR REPLACE FUNCTION public.get_listings_by_location(
  p_city       text    DEFAULT NULL::text,
  p_state      text    DEFAULT NULL::text,
  limit_count  integer DEFAULT 50,
  offset_count integer DEFAULT 0
)
RETURNS SETOF listings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE
    visible = true
    AND (p_city  IS NULL OR city  ILIKE p_city)
    AND (p_state IS NULL OR state = p_state)
  ORDER BY
    CASE tier
      WHEN 'PREMIUM'  THEN 1
      WHEN 'FEATURED' THEN 2
      WHEN 'VERIFIED' THEN 3
      WHEN 'FREE'     THEN 4
    END,
    business_name ASC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;
```

---

### 7.12 `get_location_counts()` → TABLE(state text, city text, count bigint)

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get listing counts per location

```sql
CREATE OR REPLACE FUNCTION public.get_location_counts()
RETURNS TABLE(state text, city text, count bigint)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.state,
    l.city,
    COUNT(*)::BIGINT
  FROM public.listings l
  WHERE l.visible = true AND l.state IS NOT NULL AND l.city IS NOT NULL
  GROUP BY l.state, l.city
  ORDER BY l.state ASC, l.city ASC;
END;
$$;
```

---

### 7.13 `get_recent_listings(limit_count integer)` → SETOF listings

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Get recently added listings

```sql
CREATE OR REPLACE FUNCTION public.get_recent_listings(limit_count integer DEFAULT 10)
RETURNS SETOF listings
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.listings
  WHERE visible = true
  ORDER BY created_at DESC
  LIMIT limit_count;
END;
$$;
```

---

### 7.14 `increment_listing_analytics()` → trigger

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`

AFTER INSERT trigger function for `listing_analytics`. Increments all 8 time-window counters in `listing_analytics_summary` using `ON CONFLICT DO UPDATE`, atomically, per action type.

```sql
CREATE OR REPLACE FUNCTION public.increment_listing_analytics()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  CASE NEW.action
    WHEN 'view' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, views_7d, views_14d, views_1m, views_3m, views_6m, views_1y, views_2y, views_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        views_7d  = listing_analytics_summary.views_7d  + 1,
        views_14d = listing_analytics_summary.views_14d + 1,
        views_1m  = listing_analytics_summary.views_1m  + 1,
        views_3m  = listing_analytics_summary.views_3m  + 1,
        views_6m  = listing_analytics_summary.views_6m  + 1,
        views_1y  = listing_analytics_summary.views_1y  + 1,
        views_2y  = listing_analytics_summary.views_2y  + 1,
        views_all = listing_analytics_summary.views_all + 1,
        updated_at = now();
    WHEN 'call' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, call_clicks_7d, call_clicks_14d, call_clicks_1m, call_clicks_3m, call_clicks_6m, call_clicks_1y, call_clicks_2y, call_clicks_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        call_clicks_7d  = listing_analytics_summary.call_clicks_7d  + 1,
        call_clicks_14d = listing_analytics_summary.call_clicks_14d + 1,
        call_clicks_1m  = listing_analytics_summary.call_clicks_1m  + 1,
        call_clicks_3m  = listing_analytics_summary.call_clicks_3m  + 1,
        call_clicks_6m  = listing_analytics_summary.call_clicks_6m  + 1,
        call_clicks_1y  = listing_analytics_summary.call_clicks_1y  + 1,
        call_clicks_2y  = listing_analytics_summary.call_clicks_2y  + 1,
        call_clicks_all = listing_analytics_summary.call_clicks_all + 1,
        updated_at = now();
    WHEN 'email' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, email_clicks_7d, email_clicks_14d, email_clicks_1m, email_clicks_3m, email_clicks_6m, email_clicks_1y, email_clicks_2y, email_clicks_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        email_clicks_7d  = listing_analytics_summary.email_clicks_7d  + 1,
        email_clicks_14d = listing_analytics_summary.email_clicks_14d + 1,
        email_clicks_1m  = listing_analytics_summary.email_clicks_1m  + 1,
        email_clicks_3m  = listing_analytics_summary.email_clicks_3m  + 1,
        email_clicks_6m  = listing_analytics_summary.email_clicks_6m  + 1,
        email_clicks_1y  = listing_analytics_summary.email_clicks_1y  + 1,
        email_clicks_2y  = listing_analytics_summary.email_clicks_2y  + 1,
        email_clicks_all = listing_analytics_summary.email_clicks_all + 1,
        updated_at = now();
    WHEN 'website' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, website_clicks_7d, website_clicks_14d, website_clicks_1m, website_clicks_3m, website_clicks_6m, website_clicks_1y, website_clicks_2y, website_clicks_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        website_clicks_7d  = listing_analytics_summary.website_clicks_7d  + 1,
        website_clicks_14d = listing_analytics_summary.website_clicks_14d + 1,
        website_clicks_1m  = listing_analytics_summary.website_clicks_1m  + 1,
        website_clicks_3m  = listing_analytics_summary.website_clicks_3m  + 1,
        website_clicks_6m  = listing_analytics_summary.website_clicks_6m  + 1,
        website_clicks_1y  = listing_analytics_summary.website_clicks_1y  + 1,
        website_clicks_2y  = listing_analytics_summary.website_clicks_2y  + 1,
        website_clicks_all = listing_analytics_summary.website_clicks_all + 1,
        updated_at = now();
    WHEN 'directions' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, directions_clicks_7d, directions_clicks_14d, directions_clicks_1m, directions_clicks_3m, directions_clicks_6m, directions_clicks_1y, directions_clicks_2y, directions_clicks_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        directions_clicks_7d  = listing_analytics_summary.directions_clicks_7d  + 1,
        directions_clicks_14d = listing_analytics_summary.directions_clicks_14d + 1,
        directions_clicks_1m  = listing_analytics_summary.directions_clicks_1m  + 1,
        directions_clicks_3m  = listing_analytics_summary.directions_clicks_3m  + 1,
        directions_clicks_6m  = listing_analytics_summary.directions_clicks_6m  + 1,
        directions_clicks_1y  = listing_analytics_summary.directions_clicks_1y  + 1,
        directions_clicks_2y  = listing_analytics_summary.directions_clicks_2y  + 1,
        directions_clicks_all = listing_analytics_summary.directions_clicks_all + 1,
        updated_at = now();
    WHEN 'share' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, share_clicks_7d, share_clicks_14d, share_clicks_1m, share_clicks_3m, share_clicks_6m, share_clicks_1y, share_clicks_2y, share_clicks_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        share_clicks_7d  = listing_analytics_summary.share_clicks_7d  + 1,
        share_clicks_14d = listing_analytics_summary.share_clicks_14d + 1,
        share_clicks_1m  = listing_analytics_summary.share_clicks_1m  + 1,
        share_clicks_3m  = listing_analytics_summary.share_clicks_3m  + 1,
        share_clicks_6m  = listing_analytics_summary.share_clicks_6m  + 1,
        share_clicks_1y  = listing_analytics_summary.share_clicks_1y  + 1,
        share_clicks_2y  = listing_analytics_summary.share_clicks_2y  + 1,
        share_clicks_all = listing_analytics_summary.share_clicks_all + 1,
        updated_at = now();
    WHEN 'custom_cta_1' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, custom_cta_1_7d, custom_cta_1_14d, custom_cta_1_1m, custom_cta_1_3m, custom_cta_1_6m, custom_cta_1_1y, custom_cta_1_2y, custom_cta_1_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        custom_cta_1_7d  = listing_analytics_summary.custom_cta_1_7d  + 1,
        custom_cta_1_14d = listing_analytics_summary.custom_cta_1_14d + 1,
        custom_cta_1_1m  = listing_analytics_summary.custom_cta_1_1m  + 1,
        custom_cta_1_3m  = listing_analytics_summary.custom_cta_1_3m  + 1,
        custom_cta_1_6m  = listing_analytics_summary.custom_cta_1_6m  + 1,
        custom_cta_1_1y  = listing_analytics_summary.custom_cta_1_1y  + 1,
        custom_cta_1_2y  = listing_analytics_summary.custom_cta_1_2y  + 1,
        custom_cta_1_all = listing_analytics_summary.custom_cta_1_all + 1,
        updated_at = now();
    WHEN 'custom_cta_2' THEN
      INSERT INTO public.listing_analytics_summary (listing_id, custom_cta_2_7d, custom_cta_2_14d, custom_cta_2_1m, custom_cta_2_3m, custom_cta_2_6m, custom_cta_2_1y, custom_cta_2_2y, custom_cta_2_all)
      VALUES (NEW.listing_id, 1, 1, 1, 1, 1, 1, 1, 1)
      ON CONFLICT (listing_id) DO UPDATE SET
        custom_cta_2_7d  = listing_analytics_summary.custom_cta_2_7d  + 1,
        custom_cta_2_14d = listing_analytics_summary.custom_cta_2_14d + 1,
        custom_cta_2_1m  = listing_analytics_summary.custom_cta_2_1m  + 1,
        custom_cta_2_3m  = listing_analytics_summary.custom_cta_2_3m  + 1,
        custom_cta_2_6m  = listing_analytics_summary.custom_cta_2_6m  + 1,
        custom_cta_2_1y  = listing_analytics_summary.custom_cta_2_1y  + 1,
        custom_cta_2_2y  = listing_analytics_summary.custom_cta_2_2y  + 1,
        custom_cta_2_all = listing_analytics_summary.custom_cta_2_all + 1,
        updated_at = now();
    ELSE
      NULL;
  END CASE;
  RETURN NEW;
END;
$$;
```

---

### 7.15 `recalculate_listing_analytics_summary()` → void

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** INVOKER | **search_path:** not set ⚠️

Full recalculation UPDATE from raw `listing_analytics` events. All 56 window columns recomputed via a single aggregated CTE. **Does NOT `SET search_path`** — security advisory warning applies.

*(Full definition omitted for brevity; it aggregates all 8 time windows for all 7 action types in a single FROM clause and performs a bulk UPDATE on `listing_analytics_summary`.)*

---

### 7.16 `refresh_listing_analytics_summary()` → void

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`

Two-step full refresh: (1) ensures every listing has a summary row, (2) recomputes all 56 window columns from raw events via a CTE. This is the authoritative refresh function used after bulk imports or corrections.

*(Full SQL is ~130 lines; logic mirrors `recalculate_listing_analytics_summary` but with COALESCE-defaulted columns and a proper summary-row insert pre-step.)*

---

### 7.17 `rls_auto_enable()` → event_trigger

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `pg_catalog`

Automatically enables RLS on any new table created in the `public` schema. Fires as the `ensure_rls` event trigger on `ddl_command_end`.

```sql
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT * FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
    IF cmd.schema_name IS NOT NULL
       AND cmd.schema_name IN ('public')
       AND cmd.schema_name NOT IN ('pg_catalog','information_schema')
       AND cmd.schema_name NOT LIKE 'pg_toast%'
       AND cmd.schema_name NOT LIKE 'pg_temp%'
    THEN
      BEGIN
        EXECUTE format('ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION WHEN OTHERS THEN
        RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
    END IF;
  END LOOP;
END;
$$;
```

---

### 7.18 `rpc_listing_attribution_campaigns(...)` → TABLE(...)

**Language:** SQL | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`

Attribution campaign rollup for the business portal. Queries `listing_kpi_daily` (referenced but not audited — may be a future/external table) for owner-gated listing data, bucketing low-volume campaigns as "other".

**Parameters:** `p_listing_id text`, `p_start_date date`, `p_end_date date`, `p_source text`, `p_medium text`, `p_other_threshold bigint` (default 10)

**Returns:** `listing_id, attribution_source, attribution_medium, campaign_bucket, attribution_campaign, events, is_other`

---

### 7.19 `rpc_listing_attribution_other_drilldown(...)` → TABLE(...)

**Language:** SQL | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`

Drilldown for the "other" campaign bucket — returns all campaigns below the threshold for a specific listing.

---

### 7.20 `rpc_listing_kpi_rollup(...)` → TABLE(...)

**Language:** SQL | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`

Full KPI rollup from `listing_kpi_daily`. Returns map-opens, pin interactions, button clicks, star adds/removes, and a `button_click_breakdown` jsonb aggregated across filters.

**Parameters:** `p_listing_id`, `p_start_date`, `p_end_date`, `p_tier`, `p_source`, `p_medium`, `p_campaign`

---

### 7.21 `search_listings(search_query text, limit_count integer, offset_count integer)` → TABLE(...)

**Language:** plpgsql | **Volatility:** STABLE | **Security:** DEFINER | **search_path:** `public`, `extensions`
**Comment:** Full-text search across listings with relevance ranking

Uses `pg_trgm` `similarity()` to compute weighted relevance (business_name × 3 + tagline + category + city), filtered by `ILIKE` match on multiple columns including unnested `subcategories`.

```sql
CREATE OR REPLACE FUNCTION public.search_listings(
  search_query  text,
  limit_count   integer DEFAULT 20,
  offset_count  integer DEFAULT 0
)
RETURNS TABLE(
  id bigint, slug text, business_name text, tagline text,
  category text, city text, state text, tier text,
  verified boolean, logo text, relevance real
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id, l.slug, l.business_name, l.tagline,
    l.category, l.city, l.state, l.tier, l.verified, l.logo,
    (
      similarity(l.business_name, search_query) * 3 +
      COALESCE(similarity(l.tagline,   search_query), 0) +
      COALESCE(similarity(l.category,  search_query), 0) +
      COALESCE(similarity(l.city,      search_query), 0)
    )::real AS relevance
  FROM public.listings l
  WHERE
    l.visible = true
    AND (
      l.business_name ILIKE '%' || search_query || '%'
      OR l.tagline    ILIKE '%' || search_query || '%'
      OR l.category   ILIKE '%' || search_query || '%'
      OR l.city       ILIKE '%' || search_query || '%'
      OR l.state      ILIKE '%' || search_query || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(l.subcategories) sc
        WHERE sc ILIKE '%' || search_query || '%'
      )
    )
  ORDER BY relevance DESC, l.tier DESC, l.business_name ASC
  LIMIT limit_count OFFSET offset_count;
END;
$$;
```

> **Note:** Return type declares `id bigint` but `listings.id` is `uuid`. This is a stale return type from before the `listings_id_int8_to_uuid` migration.

---

### 7.22 `set_listing_requests_updated_at()` → trigger

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** INVOKER | **search_path:** `public`

```sql
CREATE OR REPLACE FUNCTION public.set_listing_requests_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

---

### 7.23 `track_analytics(p_listing_id text, p_action text, p_platform text)` → void

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`

> **Legacy overload** — casts `p_listing_id` from text to bigint and references `public.analytics` (does not exist). Effectively dead code.

---

### 7.24 `track_analytics(p_listing_id bigint, p_action text, p_platform text, p_user_agent text)` → void

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`

> **Legacy overload** — inserts into `listing_analytics` then updates `public.analytics` (does not exist). Likely superseded by direct inserts + `increment_listing_analytics` trigger.

---

### 7.25 `track_analytics_event(p_listing_id bigint, p_action text, p_platform text)` → void

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** DEFINER | **search_path:** `public`
**Comment:** Tracks an analytics event for a listing

> Inserts into `public.analytics_events` which does not exist in the current schema. Legacy/dead code.

---

### 7.26 `update_analytics_summary()` → trigger

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** INVOKER | **search_path:** `public`
**Comment:** Automatically updates analytics summary when events are inserted

> References `public.analytics_summary` (does not exist). Legacy/dead code.

---

### 7.27 `update_updated_at_column()` → trigger

**Language:** plpgsql | **Volatility:** VOLATILE | **Security:** INVOKER | **search_path:** `public`

Generic `updated_at` timestamp trigger used by `listings` and `business_owners`.

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;
```

---

## 8. Triggers

| Trigger Name | Table | Event | Timing | Orientation | Function |
|---|---|---|---|---|---|
| `update_business_owners_updated_at` | `business_owners` | UPDATE | BEFORE | ROW | `update_updated_at_column()` |
| `trg_after_analytics_insert` | `listing_analytics` | INSERT | AFTER | ROW | `increment_listing_analytics()` |
| `listing_requests_updated_at` | `listing_requests` | UPDATE | BEFORE | ROW | `set_listing_requests_updated_at()` |
| `update_listings_updated_at` | `listings` | UPDATE | BEFORE | ROW | `update_updated_at_column()` |

**SQL Definitions:**
```sql
-- business_owners updated_at
CREATE TRIGGER update_business_owners_updated_at
  BEFORE UPDATE ON public.business_owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- listing_analytics → increment summary (core analytics pipeline)
CREATE TRIGGER trg_after_analytics_insert
  AFTER INSERT ON public.listing_analytics
  FOR EACH ROW EXECUTE FUNCTION increment_listing_analytics();

-- listing_requests updated_at
CREATE TRIGGER listing_requests_updated_at
  BEFORE UPDATE ON public.listing_requests
  FOR EACH ROW EXECUTE FUNCTION set_listing_requests_updated_at();

-- listings updated_at
CREATE TRIGGER update_listings_updated_at
  BEFORE UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 9. Event Triggers

| Trigger Name | Event | Owner | Function | Status | Tags |
|---|---|---|---|---|---|
| `ensure_rls` | `ddl_command_end` | postgres | `public.rls_auto_enable` | Enabled | CREATE TABLE, CREATE TABLE AS, SELECT INTO |
| `issue_graphql_placeholder` | `sql_drop` | supabase_admin | `set_graphql_placeholder` | Enabled | DROP EXTENSION |
| `issue_pg_cron_access` | `ddl_command_end` | supabase_admin | `grant_pg_cron_access` | Enabled | CREATE EXTENSION |
| `issue_pg_graphql_access` | `ddl_command_end` | supabase_admin | `grant_pg_graphql_access` | Enabled | CREATE FUNCTION |
| `issue_pg_net_access` | `ddl_command_end` | supabase_admin | `grant_pg_net_access` | Enabled | CREATE EXTENSION |
| `pgrst_ddl_watch` | `ddl_command_end` | supabase_admin | `pgrst_ddl_watch` | Enabled | (all DDL) |
| `pgrst_drop_watch` | `sql_drop` | supabase_admin | `pgrst_drop_watch` | Enabled | (all drops) |

The `ensure_rls` event trigger is a custom addition that guarantees RLS is automatically enabled on every new `public` schema table, preventing accidental insecure table creation.

---

## 10. Indexes

### `public.listings`
```sql
-- Primary key
CREATE UNIQUE INDEX listings_pkey ON public.listings USING btree (id);

-- Slug uniqueness + fast lookup
CREATE UNIQUE INDEX listings_slug_key ON public.listings USING btree (slug);
CREATE INDEX idx_listings_slug ON public.listings USING btree (slug);

-- Category filter
CREATE INDEX idx_listings_category ON public.listings USING btree (category);

-- Chain lookups (partial index — only where chain_id is set)
CREATE INDEX idx_listings_chain_id ON public.listings USING btree (chain_id)
  WHERE (chain_id IS NOT NULL);

-- Recency sort
CREATE INDEX idx_listings_created_at ON public.listings USING btree (created_at DESC);

-- Full-text / similarity search (pg_trgm GIN)
CREATE INDEX idx_listings_business_name_trgm ON public.listings
  USING gin (business_name gin_trgm_ops);
```

### `public.business_owners`
```sql
CREATE UNIQUE INDEX business_owners_pkey ON public.business_owners USING btree (id);
CREATE UNIQUE INDEX business_owners_owner_user_id_key ON public.business_owners USING btree (owner_user_id);
CREATE INDEX idx_business_owners_listing_id ON public.business_owners USING btree (listing_id);
CREATE INDEX idx_business_owners_owner_email ON public.business_owners USING btree (owner_email);
CREATE INDEX idx_business_owners_owner_user_id ON public.business_owners USING btree (owner_user_id);
```

### `public.listing_analytics`
```sql
CREATE UNIQUE INDEX listing_analytics_pkey ON public.listing_analytics USING btree (id);
CREATE INDEX idx_listing_analytics_listing_id ON public.listing_analytics USING btree (listing_id);

-- Composite index for the core analytics queries (listing + action + time window filtering)
CREATE INDEX idx_listing_analytics_query_perf ON public.listing_analytics
  USING btree (listing_id, action, "timestamp");
```

### `public.listing_analytics_summary`
```sql
CREATE UNIQUE INDEX listing_analytics_summary_pkey ON public.listing_analytics_summary USING btree (listing_id);
```

### `public.listing_requests`
```sql
CREATE UNIQUE INDEX listing_requests_pkey ON public.listing_requests USING btree (id);
```

### `public.listing_suggestions`
```sql
CREATE UNIQUE INDEX listing_suggestions_pkey ON public.listing_suggestions USING btree (id);

-- ⚠️ All three below are flagged as UNUSED by performance advisors:
CREATE INDEX listing_suggestions_listing_id_idx ON public.listing_suggestions USING btree (listing_id);
CREATE INDEX listing_suggestions_status_idx ON public.listing_suggestions USING btree (status);
CREATE INDEX listing_suggestions_created_at_idx ON public.listing_suggestions USING btree (created_at DESC);
```

### `public.shortlinks`
```sql
CREATE UNIQUE INDEX shortlinks_pkey ON public.shortlinks USING btree (id);
CREATE UNIQUE INDEX shortlinks_path_key ON public.shortlinks USING btree (path);

-- Partial index for listing-scoped shortlink lookups
CREATE INDEX idx_shortlinks_referlisting ON public.shortlinks
  USING btree (listing_refer_id) WHERE (listing_refer_id IS NOT NULL);
```

### `public.shortlink_events`
```sql
CREATE UNIQUE INDEX shortlink_events_pkey ON public.shortlink_events USING btree (id);
```

### `public.category_subcategories`
```sql
CREATE UNIQUE INDEX category_subcategories_pkey ON public.category_subcategories USING btree (category);
```

---

## 11. Sequences

| Sequence | Table / Column | Type | Start | Min | Max | Increment | Cycle |
|---|---|---|---|---|---|---|---|
| `business_owners_id_seq` | `business_owners.id` | bigint | 1 | 1 | 9223372036854775807 | 1 | NO |
| `listing_analytics_id_seq` | `listing_analytics.id` | bigint | 1 | 1 | 9223372036854775807 | 1 | NO |
| `listing_suggestions_id_seq` | `listing_suggestions.id` | bigint | 1 | 1 | 9223372036854775807 | 1 | NO |

*`listing_requests.id` uses `GENERATED BY DEFAULT AS IDENTITY` (inline identity, no named sequence).*
*`shortlink_events.id` uses `GENERATED ALWAYS AS IDENTITY` (inline identity, no named sequence).*
*`listings.id` and `shortlinks.id` use `gen_random_uuid()` — no sequence.*

---

## 12. Views

### `public.shortlink_event_summary`

A simple aggregation view over `shortlink_events`.

```sql
CREATE VIEW public.shortlink_event_summary AS
  SELECT
    path,
    count(*) AS total_events,
    max(event_time) AS last_seen
  FROM shortlink_events
  GROUP BY path;
```

**Columns:** `path text`, `total_events bigint`, `last_seen timestamptz`

*No RLS policy is set on this view. It inherits from `shortlink_events` which is publicly readable.*

---

## 13. Edge Functions (Full Source)

### 13.1 `update-github-file`

| Property | Value |
|---|---|
| **Slug** | `update-github-file` |
| **Version** | 2 |
| **Status** | ACTIVE |
| **verify_jwt** | `true` (requires valid Supabase JWT) |
| **Created** | 2026-05-16 |
| **SHA256** | `2f7b9015...` |

**Purpose:** Receives file content from the application and uses a server-side `GITHUB_TOKEN` secret to update a file in the GitHub repo via the GitHub Contents API. Reads the current file SHA first (required for updates), then PUTs the new base64-encoded content.

**Environment Variables Required:** `GITHUB_TOKEN`

**Source (`update-github-file/index.ts`):**
```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const githubToken = Deno.env.get('GITHUB_TOKEN')
    if (!githubToken) throw new Error('GITHUB_TOKEN not configured')

    const { owner, repo, path, content, message } = await req.json()
    if (!owner || !repo || !path || !content || !message) {
      throw new Error('Missing required parameters')
    }

    // Fetch current file SHA
    const fileInfoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      { headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json' } }
    )
    if (!fileInfoResponse.ok) throw new Error(`Failed to fetch file info: ${fileInfoResponse.status}`)
    const fileInfo = await fileInfoResponse.json()
    const currentSha = fileInfo.sha

    // Encode and update
    const base64Content = btoa(unescape(encodeURIComponent(content)))
    const updateResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      {
        method: 'PUT',
        headers: { 'Authorization': `token ${githubToken}`, 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: base64Content, sha: currentSha }),
      }
    )
    if (!updateResponse.ok) {
      const errorData = await updateResponse.json()
      throw new Error(errorData.message || 'GitHub update failed')
    }

    const result = await updateResponse.json()
    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400,
    })
  }
})
```

---

### 13.2 `admin-proxy`

| Property | Value |
|---|---|
| **Slug** | `admin-proxy` |
| **Version** | 6 |
| **Status** | ACTIVE |
| **verify_jwt** | `false` (uses custom `x-github-token` auth) |
| **Created** | 2026-03-10 |
| **Updated** | 2026-05-19 |
| **SHA256** | `8394418c...` |

**Purpose:** The central admin API proxy for The Greek Directory admin panel. Authenticates via a GitHub PAT (`x-github-token` header validated against the repo API). Uses the Supabase service role key internally. Exposes a full CRUD action dispatch system.

**Environment Variables Required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

**Supported Actions:**

| Action | Operation |
|---|---|
| `listings:list` | SELECT all listings with owner join |
| `listings:insert` | INSERT listing + auto-create analytics summary row |
| `listings:update` | UPDATE listing by `id` |
| `listings:delete` | DELETE listing by `id` |
| `owners:list` | SELECT all (or listing-filtered) business_owners |
| `owners:upsert` | INSERT or UPDATE business_owner by listing_id |
| `owners:delete` | DELETE business_owner by listing_id |
| `requests:list` | SELECT all listing_requests newest-first |
| `requests:update` | UPDATE listing_request by `id` |
| `requests:delete` | DELETE listing_request by `id` |
| `analytics:get` | SELECT summary for one listing |
| `analytics:list` | SELECT all summaries ordered by views_all DESC |
| `analytics:events` | SELECT recent events for a listing (limit param) |
| `subcategories:list` | SELECT all categories ordered |
| `subcategories:insert` | INSERT new subcategory |
| `subcategories:update` | UPDATE subcategory by `id` |
| `subcategories:delete` | DELETE subcategory by `id` |
| `sql:select` | Execute a raw SELECT (via `exec_admin_select` RPC) |
| `shortlinks:get` | SELECT shortlinks for a listing |
| `shortlinks:check` | Check if a path already exists |
| `shortlinks:insert` | INSERT shortlink (with duplicate guard: 409 on conflict) |
| `shortlinks:delete` | DELETE all shortlinks for a listing |

**Source (`index.ts`):** *(Full 300-line source — see Edge Functions section of audit.)*

---

### 13.3 `listing-server-time`

| Property | Value |
|---|---|
| **Slug** | `listing-server-time` |
| **Version** | 2 |
| **Status** | ACTIVE |
| **verify_jwt** | `true` |
| **Created** | 2026-05-04 |
| **Updated** | 2026-05-05 |

**Purpose:** Returns the current server UTC timestamp as `{ nowUtc: string }`. Used by listing pages to determine authoritative server time for open/closed status calculations, bypassing any client-side clock drift. Fully cache-busted via no-store headers.

**Source (`index.ts`):**
```typescript
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info'
    }});
  }

  const nowUtc = new Date().toISOString();

  return new Response(JSON.stringify({ nowUtc }), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info'
    }
  });
});
```

---

### 13.4 `update-listing-bp`

| Property | Value |
|---|---|
| **Slug** | `update-listing-bp` |
| **Version** | 1 |
| **Status** | ACTIVE |
| **verify_jwt** | `true` |
| **Created** | 2026-05-17 |

**Purpose:** Business Portal (BP) listing update endpoint. Validates caller JWT, verifies ownership via `business_owners` (matching by `owner_email`), then uses the service role key to bypass RLS for the write. Enforces a strict allowlist of fields owners may update.

**Owner-allowed listing fields:** `tagline`, `description`, `subcategories`, `primary_subcategory`, `pricing`, `coming_soon`, `address`, `city`, `state`, `zip_code`, `country`, `timezone`, `phone`, `email`, `website`, `logo`, `photos`, `video`, `hours`, `hours_label_custom`, `hours_disclaimer_custom`, `hours_updated_at`, `hours_updated_by`, `social_media`, `reviews`, `additional_info`, `custom_ctas`, `updated_by_role`

**Owner-allowed owner fields:** `owner_email`, `owner_phone`, `name_title_visible`, `email_visible`, `phone_visible`, `full_name`, `title`, `from_greece`

**Actions:** `update-listing`, `update-owner`

**Ownership verification logic:**
1. Decode caller's JWT via anon client → get user email
2. Fetch `business_owners` row by `listing_id`
3. If `owner_email` is set and doesn't match → 403
4. If `owner_email` is null (orphaned row) → allow + sync email
5. Apply filtered updates via service role

**Source (`index.ts`):** *(~180 lines of TypeScript — see full source above in Edge Functions data.)*

---

## 14. Installed Extensions

### Active (Installed)

| Extension | Schema | Version | Purpose |
|---|---|---|---|
| `plpgsql` | `pg_catalog` | 1.0 | PL/pgSQL procedural language (default) |
| `pgcrypto` | `extensions` | 1.3 | Cryptographic functions |
| `pg_stat_statements` | `extensions` | 1.11 | SQL statement performance tracking |
| `pg_trgm` | `extensions` | 1.6 | Trigram similarity for full-text search |
| `uuid-ossp` | `extensions` | 1.1 | UUID generation (`uuid_generate_v4()`) |
| `wrappers` | `extensions` | 0.5.7 | Foreign data wrappers (Supabase) |
| `supabase_vault` | `vault` | 0.3.1 | Encrypted secrets storage |

### Available (Not Installed)

Key notable available extensions:

| Extension | Version | Purpose |
|---|---|---|
| `pg_graphql` | 1.5.11 | GraphQL API support |
| `pg_net` | 0.19.5 | Async HTTP requests from SQL |
| `vector` | 0.8.0 | pgvector for AI embeddings |
| `pg_cron` | 1.6.4 | Job scheduling within PostgreSQL |
| `postgis` | 3.3.7 | Geographic/spatial data types |
| `pgsodium` | 3.1.8 | libsodium crypto functions |
| `http` | 1.6 | HTTP client from SQL |
| `pgmq` | 1.5.1 | Message queue on Postgres |
| `pg_partman` | 5.3.1 | Table partitioning management |
| `citext` | 1.6 | Case-insensitive text type |
| `hstore` | 1.8 | Key-value store type |
| `ltree` | 1.3 | Hierarchical tree structures |
| `earthdistance` | 1.2 | Great-circle distance calculations |
| `fuzzystrmatch` | 1.2 | Levenshtein / soundex distance |
| `pg_jsonschema` | 0.3.3 | JSON Schema validation |
| `pgjwt` | 0.2.0 | JWT creation/validation in SQL |
| `unaccent` | 1.1 | Remove accents for text search |

---

## 15. Migration History

Total migrations: **38**
Listed in chronological order (oldest → newest):

| Version | Migration Name | Notes |
|---|---|---|
| `20260309054108` | `drop_obsolete_listings_columns` | Initial cleanup of legacy columns |
| `20260309181250` | `convert_places_url_ending_to_array` | Data type migration |
| `20260309222821` | `places_url_ending_to_array` | Follow-up fix |
| `20260310201527` | `01_function_search_path_hardening` | Security: hardened function search_paths |
| `20260310201622` | `02_rls_performance_wrap_auth_calls` | Performance: wrapped auth calls with SELECT |
| `20260310201651` | `03_indexes_fk_and_duplicates` | Added FK indexes, cleaned duplicates |
| `20260310201727` | `04_datatype_fix_analytics_listing_id` | Data type fix on analytics listing_id |
| `20260310201803` | `05_listing_metrics_events_bigint_migration` | Bigint migration for analytics |
| `20260310201836` | `06_fix_search_listings_cast` | Cast fix in search_listings function |
| `20260310201914` | `07_fix_security_definer_view` | Fixed view security definer |
| `20260310201945` | `08_consolidate_redundant_select_policies` | RLS policy consolidation |
| `20260310202046` | `09_move_pg_trgm_to_extensions_schema` | Moved pg_trgm to extensions schema |
| `20260310202100` | `10_fix_shortlinks_permissive_policies` | Shortlink RLS fix |
| `20260310202131` | `11_consolidate_remaining_permissive_policies` | Further RLS consolidation |
| `20260312215449` | `fix_shortlinks_dangerous_anon_policies` | Security: dangerous anon write removed |
| `20260312215500` | `consolidate_listings_rls_policies` | Listings RLS cleanup |
| `20260312215509` | `consolidate_business_owners_rls_policies` | Owners RLS cleanup |
| `20260312215517` | `fix_category_subcategories_rls_policies` | Subcategories RLS cleanup |
| `20260312215527` | `drop_confirmed_zero_scan_indexes` | Removed unused indexes |
| `20260312215544` | `restore_analytics_events_fk_indexes` | Restored FK indexes for analytics |
| `20260312230358` | `update_rls_policies_use_analytics_is_admin` | Standardized admin function use |
| `20260313160909` | `seed_all_category_subcategories` | Seeded category data |
| `20260313160932` | `seed_category_subcategories_all_categories` | More seeding |
| `20260313182432` | `revert_category_subcategories_to_original` | Rollback of seed |
| `20260313182706` | `reseed_category_subcategories_all_categories` | Re-seed |
| `20260313183134` | `replace_category_subcategories_with_originals` | Data replacement |
| `20260313183203` | `reset_category_subcategories_to_original` | Final reset |
| `20260314022111` | `add_schema_type_map_to_category_subcategories` | Added JSON-LD schema map column |
| `20260321224542` | `fix_listing_analytics_anon_insert` | Fixed anon insert policy on analytics |
| `20260418052812` | `listings_id_int8_to_uuid` | **Major:** Migrated listings.id from bigint to uuid |
| `20260501224820` | `add_referlisting_to_shortlinks` | Added listing_refer_id FK to shortlinks |
| `20260518105629` | `fix_business_owners_rls_jwt_path` | JWT path fix in owners RLS |
| `20260518110858` | `fix_listings_rls_jwt_path` | JWT path fix in listings RLS |
| `20260518183942` | `fix_listing_analytics_summary_rls_security_definer` | Summary table RLS security fix |
| `20260519180644` | `fix_refresh_listing_analytics_summary_where_clause` | WHERE clause bug fix in refresh function |
| `20260520013502` | `restore_full_refresh_listing_analytics_summary_function` | Restored full refresh function body |
| `20260520013731` | `complete_daily_refresh_all_56_columns` | Ensured all 56 columns covered in refresh |
| `20260531220548` | `fix_rls_user_metadata_references` | **Security:** Removed user_metadata from 4 RLS policies; added (SELECT auth.email()) performance wrapper |

---

## 16. Security Advisors

### ~~16.1 ERROR: RLS References User Metadata~~ ✅ RESOLVED

**Severity:** ~~🔴 ERROR~~ → ✅ Resolved by migration `fix_rls_user_metadata_references` (2026-05-31)
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0015_rls_references_user_metadata

The following four RLS policies previously referenced `auth.jwt() -> 'user_metadata'` (user-editable) for ownership checks. All four have been updated to use `owner_email = (SELECT auth.email())` exclusively.

| Table | Policy | Status |
|---|---|---|
| `public.business_owners` | `tgd_owners_select` | ✅ Fixed |
| `public.business_owners` | `tgd_owners_update` | ✅ Fixed |
| `public.listings` | `tgd_listings_select` | ✅ Fixed |
| `public.listings` | `tgd_listings_update` | ✅ Fixed |

**What was removed from each policy:**
```sql
-- Removed (was present in USING and/or WITH CHECK of all four policies):
OR ((owner_user_id IS NOT NULL) AND
    (owner_user_id = ((auth.jwt() -> 'user_metadata'::text) ->> 'owner_user_id'::text)))
```

**Investigation findings that informed the fix:**
- `business_owners.owner_user_id` was `NULL` for all 55 rows — the removed branch never evaluated to `true` in production.
- The `user_metadata.owner_user_id` value format (`example-{listing_id}`) was incompatible with how SECURITY DEFINER helper functions (`analytics_is_listing_owner`, `current_owner_listing_ids`) compared `owner_user_id` against `auth.uid()` — the two mechanisms were never consistent.
- All real owner access was already flowing exclusively through the `owner_email = auth.email()` branch, which is preserved.
- Removing the `user_metadata` branch makes the policies strictly tighter (closes a forgeable path) without restricting any real user.

---

### 16.2 WARN: Function Search Path Mutable

**Severity:** 🟡 WARN
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

| Function | Issue |
|---|---|
| `public.recalculate_listing_analytics_summary` | Missing `SET search_path TO 'public'` |

**Fix:** Add `SET search_path TO 'public'` to the function definition.

---

### 16.3 WARN: RLS Policy Always True (INSERT)

**Severity:** 🟡 WARN
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

| Table | Policy | Issue |
|---|---|---|
| `public.listing_suggestions` | `Public can insert suggestions` | `WITH CHECK (true)` — any user (anon or authenticated) can insert any row with no validation |

**Fix:** Add meaningful field validation (non-empty `suggester_name`, `suggester_email`, `listing_id`) to the WITH CHECK clause.

---

### 16.4 WARN: Public Can Execute SECURITY DEFINER Functions

**Severity:** 🟡 WARN
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

The `anon` role can call these SECURITY DEFINER functions via the REST API (`/rest/v1/rpc/...`). Many are intentional (public listing reads), but several should be reviewed:

| Function | Risk Level | Notes |
|---|---|---|
| `analytics_is_listing_owner` | Medium | Exposes ownership check; could be used to enumerate owners |
| `current_owner_listing_ids` | Medium | Returns ownership data for anonymous callers |
| `get_category_counts` | Low | Public data, acceptable |
| `get_chain_locations` | Low | Public data, acceptable |
| `get_featured_listings` | Low | Public data, intentional |
| `get_listings_by_category` | Low | Public data, intentional |
| `get_listings_by_location` | Low | Public data, intentional |
| `get_location_counts` | Low | Public data, acceptable |
| `get_recent_listings` | Low | Public data, intentional |
| `get_listing_analytics` | Medium | Returns analytics data; function references non-existent table |
| `increment_listing_analytics` | High | Trigger function — should NOT be directly callable |
| `refresh_listing_analytics_summary` | High | Full summary refresh — should be admin-only |
| `rls_auto_enable` | High | DDL event trigger function — should not be publicly callable |
| `rpc_listing_attribution_campaigns` | Medium | Attribution data gated by current_owner_listing_ids |
| `rpc_listing_attribution_other_drilldown` | Medium | Same |
| `rpc_listing_kpi_rollup` | Medium | Same |
| `search_listings` | Low | Public search, intentional |
| `track_analytics` | Medium | Legacy — inserts into non-existent tables |
| `track_analytics_event` | Medium | Legacy — inserts into non-existent table |

**Recommended actions:**
- Revoke `EXECUTE` from `anon` on: `increment_listing_analytics`, `refresh_listing_analytics_summary`, `rls_auto_enable`, `analytics_is_listing_owner`, `current_owner_listing_ids`
- Drop or mark as deprecated: `track_analytics`, `track_analytics_event`, `update_analytics_summary`, `get_listing_analytics`, `track_analytics (text variant)`

---

### 16.5 WARN: Leaked Password Protection Disabled

**Severity:** 🟡 WARN
**Remediation:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

HaveIBeenPwned.org integration is disabled. Enable in Auth settings to prevent compromised passwords.

---

## 17. Performance Advisors

### ~~17.1 WARN: Auth RLS Initialization Plan~~ ✅ RESOLVED

**Severity:** ~~🟡 WARN~~ → ✅ Resolved by migration `fix_rls_user_metadata_references` (2026-05-31)
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan

The following RLS policies previously called `auth.email()` directly (not wrapped in `(SELECT ...)`), causing re-evaluation for every row scanned. All four have been updated to use `(SELECT auth.email())`.

| Table | Policy | Status |
|---|---|---|
| `public.business_owners` | `tgd_owners_select` | ✅ Fixed |
| `public.business_owners` | `tgd_owners_update` | ✅ Fixed |
| `public.listings` | `tgd_listings_select` | ✅ Fixed |
| `public.listings` | `tgd_listings_update` | ✅ Fixed |

**Fix applied:**
```sql
-- Before (re-evaluated per row):
owner_email = auth.email()

-- After (evaluated once per query):
owner_email = (SELECT auth.email())
```

---

### 17.2 INFO: Unused Indexes

| Index | Table | Status |
|---|---|---|
| `listing_suggestions_listing_id_idx` | `listing_suggestions` | Never used |
| `listing_suggestions_status_idx` | `listing_suggestions` | Never used |
| `listing_suggestions_created_at_idx` | `listing_suggestions` | Never used |

Since `listing_suggestions` has 0 rows and has never been queried, these indexes have no usage data. Consider dropping them until the feature is active, then re-creating as needed.

---

### 17.3 WARN: Multiple Permissive SELECT Policies on `shortlinks`

**Severity:** 🟡 WARN
**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

The `anon` role has two separate SELECT policies on `shortlinks` (`Allow public read access` and `shortlinks_public_select`), both with `USING (true)`. PostgreSQL must evaluate both for every query against this table.

**Fix:** Drop `Allow public read access` — it is a duplicate of `shortlinks_public_select`.

---

## 18. Architecture Notes & Patterns

### 18.1 Data Model Summary

```
listings (uuid PK)
  ├─ business_owners (bigint PK, FK → listings.id)
  ├─ listing_analytics (bigint PK, FK → listings.id)
  │    └─ [AFTER INSERT trigger] → listing_analytics_summary (PK = listing_id)
  ├─ listing_analytics_summary (PK = listing_id FK)
  └─ shortlinks (uuid PK, FK → listings.id, nullable)

listing_requests    (intake queue, no FK to listings)
listing_suggestions (community edits, listing_id as text, no FK)
shortlink_events    (click log, path-based, no FK to shortlinks)
category_subcategories (lookup table, PK = category text)
```

### 18.2 Analytics Pipeline

1. **Event insertion:** Client inserts into `listing_analytics` (anon RLS policy validates action type)
2. **Trigger fires:** `trg_after_analytics_insert` (AFTER INSERT, ROW) calls `increment_listing_analytics()`
3. **Atomic upsert:** `listing_analytics_summary` is updated via `ON CONFLICT DO UPDATE`, incrementing all 8 time-window counters for the matching action
4. **Full refresh:** `refresh_listing_analytics_summary()` (SECURITY DEFINER) can recompute all counters from raw events — used for corrections/bulk imports
5. **Read path:** `listing_analytics_summary` is SELECT-open to all (no auth required), surfacing pre-aggregated stats to listing owner dashboards

**Design tradeoff:** The incremental trigger approach means time-window counts (e.g. `views_7d`) become stale as time passes — they increment but never decrement. The `refresh_listing_analytics_summary()` function is needed to recalibrate windows over time. A scheduled `pg_cron` job would be the natural completion of this pattern (not yet installed).

### 18.3 Authentication & Ownership

**Admin access** is determined by `analytics_is_admin()` which checks:
- JWT role = `service_role` or `admin`
- `app_metadata.role` = `admin` or `super_admin`

**Business owner access** is determined by a single mechanism in RLS policies:
- `owner_email` in `business_owners` matched against `(SELECT auth.email())` (safe, server-controlled)

> **Note:** An `owner_user_id` column exists on `business_owners` but is currently unpopulated (`NULL` for all rows). RLS policies previously included a secondary ownership check that matched `owner_user_id` against `auth.jwt() -> 'user_metadata' ->> 'owner_user_id'`. This was removed by migration `fix_rls_user_metadata_references` (2026-05-31) because: (1) `user_metadata` is user-editable and must not be used in security contexts, (2) the column was never populated so the branch was dead code, and (3) the value format stored in `user_metadata` was inconsistent with how SECURITY DEFINER helper functions (`analytics_is_listing_owner`, `current_owner_listing_ids`) compare `owner_user_id` against `auth.uid()`. If `owner_user_id`-based ownership is implemented in the future, it should compare against `auth.uid()` via `app_metadata` (server-controlled) — never `user_metadata`.

**Claim flow:** Unclaimed listings have `owner_user_id = NULL` and a `confirmation_key`. The RLS policy exposes these rows publicly so the claim UI can work. After 5 failed attempts, `claim_locked_until` is set.

**Business Portal writes:** The `update-listing-bp` edge function handles authenticated owner updates by verifying JWT → email → `business_owners` row match, then writing with the service role key. This bypasses RLS intentionally but enforces field-level restrictions via an allowlist.

### 18.4 Shortlink System

- 431 shortlinks exist for 54 listings (~8 per listing average)
- Each listing has system-generated shortlinks (`listing_custom = false`) and optionally owner-customized ones (`listing_custom = true`)
- The `admin-proxy` edge function enforces that only one shortlink of each type exists per listing (returns 409 on conflict)
- Shortlink click events are logged to `shortlink_events` with geo data; `shortlink_event_summary` view aggregates by path

### 18.5 Admin Proxy Pattern

The `admin-proxy` edge function (`verify_jwt: false`) implements a custom auth layer using a GitHub PAT rather than Supabase JWT. This means:
- The admin panel does NOT go through Supabase Auth
- Authentication is tied to GitHub repo access
- The PAT is validated live against the GitHub API on every request
- All database operations use the service role key, bypassing all RLS

This is a pragmatic pattern for a small team admin tool but has implications:
- GitHub PAT rotation affects admin access
- No per-user audit trail within Supabase (all writes look like service_role)
- The PAT validation adds one extra HTTP round-trip per admin request

### 18.6 Legacy / Dead Code

Several functions reference tables that do not exist in the current schema:
- `public.analytics` — referenced by `track_analytics` (both overloads)
- `public.analytics_events` — referenced by `track_analytics_event`
- `public.analytics_summary` — referenced by `get_listing_analytics` and `update_analytics_summary`

These are artifacts from a previous analytics architecture. They are still deployed as SQL functions and are callable by the `anon` role via REST, but will throw errors when executed. They should be dropped.

### 18.7 Key Schema Evolution

The most significant migration was `listings_id_int8_to_uuid` (2026-04-18) which changed `listings.id` from `bigint` to `uuid`. Several functions still reference the old bigint type:
- `search_listings` return type declares `id bigint`
- `get_chain_locations` parameter `exclude_listing_id bigint`
- `get_listing_analytics` parameter `p_listing_id bigint`
- `track_analytics` (bigint overload)

These should be updated to use `uuid` to match the current schema.

---

## 19. Yelp Extension Integration

**Added:** 2026-11-06  
**Chrome extension version:** 0.3.0  
**Repository path:** `chrome-extension/greek-owned-maps/`  
**Repository branch:** `feature/google-maps-greek-owned-extension`

### 19.1 Existing listing identifier

The Yelp integration uses the existing nullable text column `public.listings.yelp_id`. Its value is the business slug immediately after `/biz/` in the public Yelp business-page URL (for example, `eagle-restaurant-downers-grove`). It is not the separate internal identifier that appears in Yelp's review-writing URL.

Only `visible = true` listings are returned by the lookup function. The database index is:

```sql
listings_visible_yelp_id_idx
  ON public.listings (yelp_id)
  WHERE visible IS TRUE
    AND yelp_id IS NOT NULL
    AND btrim(yelp_id) <> ''
```

**Live counts checked 2026-11-06:** 155 listings total; 78 with a non-empty Yelp ID; 77 visible listings with a non-empty Yelp ID; 78 distinct non-empty Yelp IDs.

### 19.2 Suggestion queue

`public.greek_owned_yelp_extension_suggestions` stores Yelp suggestions separately from the Google Maps queue.

| Column | Purpose |
|---|---|
| `id` | UUID primary key |
| `created_at` | Submission timestamp |
| `status` | `pending`, `approved`, or `denied` |
| `yelp_id` | Yelp business slug |
| `business_name` | Business name |
| `address` | Optional address |
| `yelp_url` | Yelp business-page URL |
| `relationship` | `owner`, `family_friend`, or `knows` |
| `note` | Optional supporting information |
| `reviewed_at` | Review timestamp |
| `review_notes` | Admin notes, up to 2,000 characters |

RLS is enabled. All direct access is revoked from `public`, `anon`, and `authenticated`; the deployed Edge Functions use the service role. There are no public RLS policies on this queue. A partial unique index prevents more than one pending suggestion for the same Yelp ID.

**Live status checked 2026-11-06:** zero suggestion rows at the time of inspection.

### 19.3 Deployed Edge Functions

| Function | Version | JWT verification | Purpose |
|---|---:|---|---|
| `greek-owned-yelp-lookup` | 1 | Disabled | Matches batches of up to 30 Yelp slugs against visible listings and returns TGD slugs |
| `greek-owned-yelp-suggest` | 1 | Disabled | Validates submissions, checks for existing listings, applies per-installation limits, and inserts pending suggestions |
| `greek-owned-yelp-admin` | 1 | Disabled | Lists and reviews suggestions using a GitHub token with repository write access |

The three functions are deployed and active. Their source mirrors are under `supabase/functions/greek-owned-yelp-*/index.ts`.

The lookup endpoint allows 90 requests per installation per minute. Suggestion submissions allow five per installation per hour. Yelp suggestions use a deterministic installation UUID scoped with `:yelp-suggestions`, so the Yelp suggestion quota is separate from the Google Maps suggestion quota. Both integrations use the existing `public.consume_greek_owned_extension_quota(uuid, integer, integer)` function and `public.greek_owned_extension_rate_limits` storage.

The admin endpoint supports:
- `{"action":"list"}` — returns up to 250 pending Yelp suggestions.
- `{"action":"review","id":"...","status":"approved|denied","reviewNotes":"..."}` — records the review decision and optional notes.

Admin requests require an `x-github-token` for a GitHub account with push or admin permission on `thegreekdirectory/platform`. Approval changes only the queue status; it does not automatically create a public directory listing.

### 19.4 Extension behavior

- Yelp business IDs are extracted from the path after `/biz/`; query strings are ignored.
- Yelp search cards receive only a compact Greek-owned badge when the ID matches a visible TGD listing. No suggestion button is added to search results.
- Yelp business pages retain the existing TGD-styled top badge and top suggestion button.
- Listed Yelp businesses receive a separate lower row in the business-information sidebar, styled with Yelp typography, neutral borders, and Yelp-red accents. It includes View listing and Copy link actions.
- Unlisted businesses receive a clone of Yelp's lower native `Suggest an edit` button with the Greek flag and the label `Suggest to The Greek Directory`. Yelp's original button remains intact.
- The same TGD suggestion modal, relationship options, and optional note are used for Google Maps and Yelp.
- Yelp lookup results use a separate three-hour `chrome.storage.session` cache namespace (`y1:`); Google Maps cache behavior is separate.

### 19.5 Migration and source references

- Applied Supabase migration: `20261106172751_add_yelp_extension`
- Repository migration mirror: `supabase/migrations/20261106172751_add_yelp_extension.sql`
- Extension implementation notes: `chrome-extension/greek-owned-maps/YELP.md`
- Extension source: `chrome-extension/greek-owned-maps/yelp-content.js`, `yelp.css`, and the shared `background.js` / `manifest.json`.

**Verification boundary:** The database schema, index, RLS state, deployed Edge Function status/source, and repository files were checked. The provided Yelp HTML snapshots were used to verify the intended selectors. A live Chrome test against Yelp's changing DOM has not been performed.

---

*End of Audit Report — thegreekdirectory's Project (`luetekzqrrgdxtopzvqw`) — Updated 2026-11-06; Yelp extension section appended. Earlier audit sections retain their original snapshot dates.*