-- 0001_schema.sql — ChargeAdvisor core schema (spec §4.2).
-- Region: eu-central-1. Never edit after production apply — create a new migration.

-- ---------------------------------------------------------------------------
-- Extensions (spec §4.1)
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS cube;
CREATE EXTENSION IF NOT EXISTS earthdistance;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_audit (pgaudit) must be enabled from the Supabase dashboard
-- (Database → Extensions). The DO block below tries anyway and ignores
-- failure so this migration works both locally and on hosted projects.
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pgaudit;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pgaudit not available here — enable it from the Supabase dashboard (spec §4.1)';
END;
$$;

-- ---------------------------------------------------------------------------
-- updated_at helper (moddatetime-style) — attached to mutable tables below
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- profiles — extends Supabase auth.users (spec §4.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                TEXT NOT NULL,
  display_name         TEXT,
  country_code         CHAR(2)      NOT NULL DEFAULT 'FR',
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at           TIMESTAMPTZ,          -- soft delete; GDPR erasure step 1 (spec §8.3)
  gdpr_consent_at      TIMESTAMPTZ,          -- timestamp of user consent to T&C + privacy policy
  gdpr_consent_version TEXT                  -- e.g. '2026-07-v1'; version of policy accepted
);

-- Auto-create profile on first auth.users insert (spec §4.2)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- badges — user's registered eMSP subscriptions (spec §4.2)
-- Max 20 badges per user enforced at API layer (BADGE_LIMIT_EXCEEDED).
-- ---------------------------------------------------------------------------
CREATE TABLE public.badges (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID  NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emsp_id    TEXT  NOT NULL,   -- FK to emsps.id, e.g. 'chargemap-pass'
  plan_id    TEXT  NOT NULL,   -- FK to emsp_plans.id, e.g. 'chargemap-pass-pro'
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, emsp_id, plan_id)
);

-- ---------------------------------------------------------------------------
-- emsps — eMSP provider catalogue (spec §4.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.emsps (
  id            TEXT PRIMARY KEY,       -- slug: 'chargemap-pass', 'ionity', 'plugsurfing'
  display_name  TEXT  NOT NULL,
  logo_url      TEXT,
  website_url   TEXT,
  affiliate_url TEXT,                   -- UTM-tagged referral URL (Phase 2, spec §7.4)
  country_codes TEXT[] NOT NULL,        -- ['FR','DE','NL'] countries where active
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_emsps_updated_at
  BEFORE UPDATE ON public.emsps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- emsp_plans — subscription tiers per eMSP (spec §4.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.emsp_plans (
  id               TEXT PRIMARY KEY,   -- e.g. 'chargemap-pass-pro', 'ionity-plus'
  emsp_id          TEXT  NOT NULL REFERENCES public.emsps(id),
  display_name     TEXT  NOT NULL,     -- e.g. 'Pass Pro', 'IONITY+'
  monthly_fee_eur  NUMERIC(8,2),       -- NULL = free tier / pay-as-you-go
  annual_fee_eur   NUMERIC(8,2),       -- NULL if no annual option
  description      TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_emsp_plans_updated_at
  BEFORE UPDATE ON public.emsp_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- stations — EV charging stations (spec §4.2)
-- ---------------------------------------------------------------------------
CREATE TABLE public.stations (
  id              TEXT PRIMARY KEY,    -- OCPI EVSE ID, e.g. 'FR*CM*E12345'
  cpo_id          TEXT NOT NULL,       -- slug, e.g. 'totalenergies', 'ionity', 'recharge'
  display_name    TEXT NOT NULL,
  address         TEXT,
  city            TEXT,
  country_code    CHAR(2) NOT NULL,
  lat             DOUBLE PRECISION NOT NULL,
  lng             DOUBLE PRECISION NOT NULL,
  connector_types TEXT[]  NOT NULL,    -- ['CCS2','CHAdeMO','Type2','Type2_cable']
  max_power_kw    NUMERIC(6,1),
  num_connectors  SMALLINT,
  data_source     TEXT NOT NULL,       -- 'manual','qualicharge','ocpi','chargeprice'
  raw_data        JSONB,               -- original payload from external source (do not query)
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Geospatial index (requires cube + earthdistance extensions) — spec §4.2/§6.3
CREATE INDEX idx_stations_geo     ON public.stations
  USING gist (ll_to_earth(lat, lng));

CREATE INDEX idx_stations_country ON public.stations(country_code);
CREATE INDEX idx_stations_cpo     ON public.stations(cpo_id);

CREATE TRIGGER trg_stations_updated_at
  BEFORE UPDATE ON public.stations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- tariffs — the core data asset (spec §4.2, §7)
-- station_id NULL = all stations of that CPO; connector_type NULL = all types.
-- ---------------------------------------------------------------------------
CREATE TABLE public.tariffs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  emsp_plan_id        TEXT    NOT NULL REFERENCES public.emsp_plans(id),
  cpo_id              TEXT    NOT NULL,
  station_id          TEXT,            -- NULL = all stations of this CPO
  connector_type      TEXT,            -- NULL = all types; 'CCS2','CHAdeMO','Type2'
  max_power_kw_min    NUMERIC(6,1),    -- NULL = no lower power band
  max_power_kw_max    NUMERIC(6,1),    -- NULL = no upper power band

  -- Pricing components (all nullable — only set applicable components)
  session_fee_eur     NUMERIC(8,4),    -- flat fee per session start (€)
  per_kwh_eur         NUMERIC(8,4),    -- price per kWh (€)
  per_min_eur         NUMERIC(8,4),    -- price per minute while actively charging (€)
  idle_fee_per_min_eur NUMERIC(8,4),   -- price per minute while connected but not charging
  idle_fee_grace_min  SMALLINT,        -- free idle minutes before idle fees kick in

  -- Time-of-use pricing (optional; see spec §4.2 TOU JSONB schema)
  tou_schedule        JSONB,

  -- Caps and inclusions
  session_cap_eur     NUMERIC(8,2),    -- max charge per session (rare)
  monthly_kwh_free    NUMERIC(8,2),    -- free kWh included in subscription per month

  -- Metadata
  currency            CHAR(3) NOT NULL DEFAULT 'EUR',
  valid_from          DATE,            -- NULL = no start constraint
  valid_to            DATE,            -- NULL = currently active
  data_source         TEXT    NOT NULL, -- 'manual','chargeprice','ocpi','affiliate'
  confidence_score    SMALLINT NOT NULL DEFAULT 80
                        CHECK (confidence_score BETWEEN 0 AND 100),
  last_verified_at    TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tariffs_plan_cpo  ON public.tariffs(emsp_plan_id, cpo_id);
CREATE INDEX idx_tariffs_station   ON public.tariffs(station_id)
  WHERE station_id IS NOT NULL;
CREATE INDEX idx_tariffs_active    ON public.tariffs(valid_from, valid_to)
  WHERE valid_to IS NULL;

-- Upsert conflict target for scripts/import-tariffs.ts + Chargeprice sync
-- (spec §7.1). PostgREST's on_conflict needs real columns (not expressions),
-- so we use a plain UNIQUE constraint; NULLS NOT DISTINCT (Postgres 15+)
-- makes two rows with the same NULL wildcard slots collide as intended.
ALTER TABLE public.tariffs
  ADD CONSTRAINT tariffs_upsert_key
  UNIQUE NULLS NOT DISTINCT (emsp_plan_id, cpo_id, station_id, connector_type,
                             max_power_kw_min, max_power_kw_max);

CREATE TRIGGER trg_tariffs_updated_at
  BEFORE UPDATE ON public.tariffs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- recommendations — logged at query time (spec §4.2, §6.4)
-- ---------------------------------------------------------------------------
CREATE TABLE public.recommendations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  station_id           TEXT NOT NULL,
  recommended_plan_id  TEXT NOT NULL REFERENCES public.emsp_plans(id),
  estimated_kwh_eur    NUMERIC(8,4),    -- per-kWh component used in estimate
  estimated_total_eur  NUMERIC(8,2),    -- full session cost estimate (30 kWh default)
  session_fee_eur      NUMERIC(8,4),
  best_upsell_plan_id  TEXT REFERENCES public.emsp_plans(id),
  upsell_savings_eur   NUMERIC(8,2),    -- savings on a 30 kWh session vs current best badge
  shown_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  source               TEXT NOT NULL DEFAULT 'web' -- 'web','mobile','pwa'
);

CREATE INDEX idx_recs_user    ON public.recommendations(user_id, shown_at DESC);
CREATE INDEX idx_recs_station ON public.recommendations(station_id);

-- ---------------------------------------------------------------------------
-- charge_sessions — crowdsourced actual cost data (spec §4.2, §6.5)
-- ---------------------------------------------------------------------------
CREATE TABLE public.charge_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES public.recommendations(id),
  station_id        TEXT NOT NULL,
  emsp_plan_id      TEXT NOT NULL REFERENCES public.emsp_plans(id),
  reported_cost_eur NUMERIC(8,2) CHECK (reported_cost_eur > 0 AND reported_cost_eur <= 500),
  reported_kwh      NUMERIC(8,2) CHECK (reported_kwh > 0 AND reported_kwh <= 200),
  computed_kwh_cost NUMERIC(8,4) GENERATED ALWAYS AS (
    CASE WHEN reported_kwh > 0
    THEN reported_cost_eur / reported_kwh
    ELSE NULL END
  ) STORED,
  session_date      DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  source            TEXT NOT NULL DEFAULT 'web'
);

CREATE INDEX idx_sessions_user    ON public.charge_sessions(user_id, session_date DESC);
CREATE INDEX idx_sessions_station ON public.charge_sessions(station_id, emsp_plan_id);

-- ---------------------------------------------------------------------------
-- push_tokens (spec §4.2, §6.6)
-- ---------------------------------------------------------------------------
CREATE TABLE public.push_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token        TEXT NOT NULL,
  platform     TEXT NOT NULL CHECK (platform IN ('web','ios','android')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  UNIQUE(user_id, token)
);

-- ---------------------------------------------------------------------------
-- waitlist — Phase 0, pre-auth (spec §4.2, §5.3)
-- ---------------------------------------------------------------------------
CREATE TABLE public.waitlist (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  source       TEXT,              -- 'landing','product-hunt','twitter'
  utm_source   TEXT,
  utm_medium   TEXT,
  utm_campaign TEXT,
  country      TEXT,              -- from Vercel's x-vercel-ip-country header
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
