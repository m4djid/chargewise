-- 0002_rls.sql — Row Level Security policies (spec §8.2).
-- Every public table has RLS enabled; the launch checklist (spec §13) verifies
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity=false
-- returns 0 rows. The service role bypasses RLS, so "service role only"
-- operations need no policy at all.

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emsps           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emsp_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tariffs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles — SELECT/UPDATE own row. INSERT happens via the SECURITY DEFINER
-- handle_new_user() trigger; DELETE is forbidden (soft delete via UPDATE).
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- badges — own rows; no DELETE (soft delete = UPDATE deleted_at).
-- ---------------------------------------------------------------------------
CREATE POLICY badges_select_own ON public.badges
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY badges_insert_own ON public.badges
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY badges_update_own ON public.badges
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- emsps / emsp_plans / stations / tariffs — read-only catalogue for all
-- authenticated users. Writes are service-role only (bypasses RLS).
-- ---------------------------------------------------------------------------
CREATE POLICY emsps_select_authenticated ON public.emsps
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY emsp_plans_select_authenticated ON public.emsp_plans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY stations_select_authenticated ON public.stations
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY tariffs_select_authenticated ON public.tariffs
  FOR SELECT TO authenticated
  USING (true);

-- ---------------------------------------------------------------------------
-- recommendations / charge_sessions — append-only per user; no UPDATE/DELETE.
-- ---------------------------------------------------------------------------
CREATE POLICY recs_select_own ON public.recommendations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY recs_insert_own ON public.recommendations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY sessions_select_own ON public.charge_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY sessions_insert_own ON public.charge_sessions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- push_tokens — own rows; hard DELETE allowed (deregister, spec §6.7).
-- ---------------------------------------------------------------------------
CREATE POLICY push_tokens_select_own ON public.push_tokens
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY push_tokens_insert_own ON public.push_tokens
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY push_tokens_delete_own ON public.push_tokens
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- waitlist — no user policies. Spec §8.1 restricts the service role key to
-- cron + the internal push trigger, so /api/waitlist cannot use it; instead
-- the anon key calls this SECURITY DEFINER function which encapsulates the
-- INSERT ... ON CONFLICT DO NOTHING + live count (spec §5.3 steps 3–5).
-- Rate limiting stays at the API layer (Upstash, 5 req/IP/min).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.waitlist_join(
  p_email        TEXT,
  p_source       TEXT,
  p_utm_source   TEXT,
  p_utm_medium   TEXT,
  p_utm_campaign TEXT,
  p_country      TEXT
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  v_email := lower(trim(p_email));
  -- Basic shape check only; real validation is zod at the API layer (§5.3).
  IF v_email IS NULL OR position('@' IN v_email) <= 1 THEN
    RAISE EXCEPTION 'invalid_email' USING ERRCODE = '22000';
  END IF;

  INSERT INTO public.waitlist (email, source, utm_source, utm_medium, utm_campaign, country)
  VALUES (v_email, p_source, p_utm_source, p_utm_medium, p_utm_campaign, p_country)
  ON CONFLICT (email) DO NOTHING;

  RETURN (SELECT count(*) FROM public.waitlist);
END;
$$;

REVOKE ALL ON FUNCTION public.waitlist_join(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.waitlist_join(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- nearby_stations — spec §6.3 query as an RPC (earth_box prefilter + exact
-- earth_distance, optional connector overlap, 20 nearest). SECURITY INVOKER:
-- runs under the caller's RLS (stations are readable by authenticated).
-- Coordinates are never persisted or logged (spec §8.3 data minimisation).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nearby_stations(
  p_lat             FLOAT8,
  p_lng             FLOAT8,
  p_radius_km       NUMERIC,
  p_connector_types TEXT[] DEFAULT NULL
) RETURNS TABLE (
  id              TEXT,
  cpo_id          TEXT,
  display_name    TEXT,
  address         TEXT,
  city            TEXT,
  country_code    CHAR(2),
  lat             FLOAT8,
  lng             FLOAT8,
  connector_types TEXT[],
  max_power_kw    NUMERIC(6,1),
  num_connectors  SMALLINT,
  data_source     TEXT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ,
  distance_km     NUMERIC
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT s.*,
    ROUND((earth_distance(
      ll_to_earth(p_lat, p_lng),
      ll_to_earth(s.lat, s.lng)
    ) / 1000)::numeric, 2) AS distance_km
  FROM public.stations s
  WHERE
    earth_box(ll_to_earth(p_lat, p_lng), (p_radius_km * 1000)::float8)
      @> ll_to_earth(s.lat, s.lng)
    AND earth_distance(
      ll_to_earth(p_lat, p_lng),
      ll_to_earth(s.lat, s.lng)
    ) <= (p_radius_km * 1000)::float8
    AND (p_connector_types IS NULL OR s.connector_types && p_connector_types)
  ORDER BY earth_distance(ll_to_earth(p_lat, p_lng), ll_to_earth(s.lat, s.lng)) ASC
  LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.nearby_stations(FLOAT8, FLOAT8, NUMERIC, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nearby_stations(FLOAT8, FLOAT8, NUMERIC, TEXT[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.nearby_stations(FLOAT8, FLOAT8, NUMERIC, TEXT[]) TO authenticated;

-- ---------------------------------------------------------------------------
-- Crowdsourced tariff confidence scoring (spec §6.5 step 3, §4.2 ⚑ note).
-- AFTER INSERT on charge_sessions: resolve the active tariff for the reported
-- plan at the station's CPO (most specific first: station match > CPO-wide);
-- if computed_kwh_cost diverges >20% from its per_kwh_eur, decrement its
-- confidence_score by 10 (floor 0). SECURITY DEFINER because users cannot
-- UPDATE tariffs under RLS.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.score_tariff_confidence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cpo_id        TEXT;
  v_tariff_id     UUID;
  v_per_kwh_eur   NUMERIC;
BEGIN
  IF NEW.computed_kwh_cost IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.cpo_id INTO v_cpo_id FROM public.stations s WHERE s.id = NEW.station_id;
  IF v_cpo_id IS NULL THEN
    RETURN NEW;  -- unknown station: nothing to score
  END IF;

  -- Most specific active tariff with a per-kWh price: prefer an exact
  -- station_id match over a CPO-wide row (spec §4.2 precedence, simplified
  -- to the kWh component we can actually compare against).
  SELECT t.id, t.per_kwh_eur
    INTO v_tariff_id, v_per_kwh_eur
  FROM public.tariffs t
  WHERE t.emsp_plan_id = NEW.emsp_plan_id
    AND t.cpo_id = v_cpo_id
    AND (t.station_id IS NULL OR t.station_id = NEW.station_id)
    AND (t.valid_to IS NULL OR t.valid_to >= CURRENT_DATE)
    AND (t.valid_from IS NULL OR t.valid_from <= CURRENT_DATE)
    AND t.per_kwh_eur IS NOT NULL
  ORDER BY (t.station_id IS NOT NULL) DESC,
           (t.connector_type IS NOT NULL) DESC,
           t.updated_at DESC
  LIMIT 1;

  IF v_tariff_id IS NULL OR v_per_kwh_eur IS NULL OR v_per_kwh_eur = 0 THEN
    RETURN NEW;
  END IF;

  IF abs(NEW.computed_kwh_cost - v_per_kwh_eur) / v_per_kwh_eur > 0.20 THEN
    UPDATE public.tariffs
       SET confidence_score = GREATEST(0, confidence_score - 10)
     WHERE id = v_tariff_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_score_tariff_confidence
  AFTER INSERT ON public.charge_sessions
  FOR EACH ROW EXECUTE FUNCTION public.score_tariff_confidence();
