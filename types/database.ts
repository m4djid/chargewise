// Row types mirroring supabase/migrations/0001_schema.sql.
// Keep in sync manually until we generate types from the Supabase CLI.

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  country_code: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  gdpr_consent_at: string | null;
  gdpr_consent_version: string | null;
}

export interface Badge {
  id: string;
  user_id: string;
  emsp_id: string;
  plan_id: string;
  is_active: boolean;
  created_at: string;
  deleted_at: string | null;
}

export interface Emsp {
  id: string;
  display_name: string;
  logo_url: string | null;
  website_url: string | null;
  affiliate_url: string | null;
  country_codes: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmspPlan {
  id: string;
  emsp_id: string;
  display_name: string;
  monthly_fee_eur: number | null;
  annual_fee_eur: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Station {
  id: string;
  cpo_id: string;
  display_name: string;
  address: string | null;
  city: string | null;
  country_code: string;
  lat: number;
  lng: number;
  connector_types: string[];
  max_power_kw: number | null;
  num_connectors: number | null;
  data_source: string;
  raw_data: unknown;
  created_at: string;
  updated_at: string;
}

export interface StationWithDistance extends Station {
  distance_km: number;
}

export interface TouPeriod {
  days: number[]; // 1=Mon … 7=Sun (ISO weekday)
  start_time: string; // 'HH:MM'
  end_time: string; // 'HH:MM'
  per_kwh_eur: number | null;
  per_min_eur: number | null;
}

export interface TouSchedule {
  timezone: string;
  periods: TouPeriod[];
}

export interface Tariff {
  id: string;
  emsp_plan_id: string;
  cpo_id: string;
  station_id: string | null;
  connector_type: string | null;
  max_power_kw_min: number | null;
  max_power_kw_max: number | null;
  session_fee_eur: number | null;
  per_kwh_eur: number | null;
  per_min_eur: number | null;
  idle_fee_per_min_eur: number | null;
  idle_fee_grace_min: number | null;
  tou_schedule: TouSchedule | null;
  session_cap_eur: number | null;
  monthly_kwh_free: number | null;
  currency: string;
  valid_from: string | null;
  valid_to: string | null;
  data_source: string;
  confidence_score: number;
  last_verified_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recommendation {
  id: string;
  user_id: string;
  station_id: string;
  recommended_plan_id: string;
  estimated_kwh_eur: number | null;
  estimated_total_eur: number | null;
  session_fee_eur: number | null;
  best_upsell_plan_id: string | null;
  upsell_savings_eur: number | null;
  shown_at: string;
  source: string;
}

export interface ChargeSession {
  id: string;
  user_id: string;
  recommendation_id: string | null;
  station_id: string;
  emsp_plan_id: string;
  reported_cost_eur: number | null;
  reported_kwh: number | null;
  computed_kwh_cost: number | null;
  session_date: string;
  created_at: string;
  source: string;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: 'web' | 'ios' | 'android';
  created_at: string;
  last_used_at: string | null;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  source: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  created_at: string;
}
