-- ═══════════════════════════════════════════════════════════════
-- OmniProcure — Supabase Schema Migration
-- Run this in your Supabase SQL editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- 1. search_cache (already exists — adding if not present)
create table if not exists search_cache (
  mpn_normalized    text primary key,
  results           jsonb not null default '[]',
  claude_recommendation jsonb,
  variant_results   jsonb not null default '[]',
  equivalent_ics    jsonb not null default '[]',
  updated_at        timestamptz not null default now(),
  hit_count         integer not null default 1
);

-- 2. audit_trail — immutable SOC 2 log
create table if not exists audit_trail (
  id          bigserial primary key,
  action      text not null,
  supplier    text,
  mpn         text,
  unit_price  numeric(12, 6),
  total_value numeric(14, 2),
  decision    text,
  details     text,
  created_at  timestamptz not null default now()
);
create index if not exists audit_trail_action_idx on audit_trail(action);
create index if not exists audit_trail_mpn_idx on audit_trail(mpn);
create index if not exists audit_trail_created_idx on audit_trail(created_at desc);

-- 3. hitl_queue — human-in-the-loop approval queue
create table if not exists hitl_queue (
  id                 text primary key,
  action             text not null,
  supplier           text not null,
  mpn                text not null,
  price              numeric(12, 6),
  currency           text not null default 'USD',
  stock              integer not null default 0,
  moq                integer not null default 1,
  lead_time          text,
  region             text,
  url                text,
  total_value        numeric(14, 2),
  reason             text,
  ai_recommendation  text,
  status             text not null default 'pending'
                     check (status in ('pending','approved','rejected','modified')),
  modified_note      text,
  created_at         timestamptz not null default now(),
  decided_at         timestamptz
);
create index if not exists hitl_queue_status_idx on hitl_queue(status);
create index if not exists hitl_queue_created_idx on hitl_queue(created_at desc);

-- 4. bom_uploads — persisted BOM parsing results
create table if not exists bom_uploads (
  id          bigserial primary key,
  filename    text,
  line_items  jsonb not null default '[]',
  item_count  integer not null default 0,
  uploaded_at timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null
);

-- 5. watchlist — parts being monitored for price/stock
create table if not exists watchlist (
  id          bigserial primary key,
  mpn         text not null unique,
  label       text,
  alert_threshold_stock  integer not null default 100,
  alert_threshold_weeks  integer not null default 8,
  last_checked_at        timestamptz,
  last_alert_at          timestamptz,
  added_at    timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null
);

-- 6. po_history — generated purchase orders
create table if not exists po_history (
  id          bigserial primary key,
  po_number   text unique not null,
  supplier    text not null,
  mpn         text not null,
  unit_price  numeric(12, 6),
  moq         integer,
  total_value numeric(14, 2),
  po_text     text,
  hitl_id     text references hitl_queue(id) on delete set null,
  generated_at timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null
);

-- ── RLS: enable for all tables ────────────────────────────────
alter table audit_trail   enable row level security;
alter table hitl_queue    enable row level security;
alter table bom_uploads   enable row level security;
alter table watchlist     enable row level security;
alter table po_history    enable row level security;

-- Service role bypasses RLS — your API routes use service role key, so no policies needed.
-- If you want user-scoped reads in the future, add policies here.-- Supabase migration SQL
-- Run this once in Supabase SQL editor to set up the database schema

-- TODO: Add table creation statements, indexes, etc.
-- Example:
-- CREATE TABLE search_cache (
--   mpn_normalized TEXT PRIMARY KEY,
--   results JSONB,
--   claude_recommendation JSONB,
--   variant_results JSONB,
--   equivalent_ics JSONB,
--   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--   hit_count INTEGER DEFAULT 0
-- );