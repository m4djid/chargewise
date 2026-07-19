import { z } from 'zod';

// All request-body / query schemas live here (spec §11.1) so routes and tests
// share one source of truth.

export const waitlistSchema = z.object({
  email: z.string().email(),
  source: z.string().optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
});

export const onboardSchema = z.object({
  gdpr_consent: z.literal(true),
  gdpr_consent_version: z.string().min(1),
  display_name: z.string().max(80).optional(),
  country_code: z.string().length(2).optional(),
});

export const profilePatchSchema = z
  .object({
    display_name: z.string().max(80).nullable().optional(),
    country_code: z.string().length(2).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty_patch' });

export const badgeCreateSchema = z.object({
  emsp_id: z.string().min(1),
  plan_id: z.string().min(1),
});

export const nearbyQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius_km: z.coerce.number().positive().max(50).default(5),
  connector_types: z
    .string()
    .transform((s) => s.split(',').map((c) => c.trim()).filter(Boolean))
    .optional(),
});

export const recommendationsSchema = z.object({
  station_ids: z.array(z.string().min(1)).min(1).max(20),
  session_kwh: z.number().positive().max(200).default(30),
});

export const chargeSessionSchema = z.object({
  recommendation_id: z.string().uuid().nullable().optional(),
  station_id: z.string().min(1),
  emsp_plan_id: z.string().min(1),
  reported_cost_eur: z.number().gt(0).lte(500),
  reported_kwh: z.number().gt(0).lte(200).optional(),
  session_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const pushRegisterSchema = z.object({
  token: z.string().min(10),
  platform: z.enum(['web', 'ios', 'android']),
});

export const pushDeregisterSchema = z.object({
  token: z.string().min(10),
});

// Tariff CSV rows for scripts/import-tariffs.ts (spec §7.1 — exact header names).
export const tariffCsvRowSchema = z.object({
  emsp_plan_id: z.string().min(1),
  cpo_id: z.string().min(1),
  station_id: z.string().transform((s) => s || null),
  connector_type: z.string().transform((s) => s || null),
  max_power_kw_min: z.coerce.number().nullable().catch(null),
  max_power_kw_max: z.coerce.number().nullable().catch(null),
  session_fee_eur: z.coerce.number().nullable().catch(null),
  per_kwh_eur: z.coerce.number().nullable().catch(null),
  per_min_eur: z.coerce.number().nullable().catch(null),
  idle_fee_per_min_eur: z.coerce.number().nullable().catch(null),
  idle_fee_grace_min: z.coerce.number().int().nullable().catch(null),
  valid_from: z.string().transform((s) => s || null),
  valid_to: z.string().transform((s) => s || null),
  data_source: z.string().min(1),
  confidence_score: z.coerce.number().int().min(0).max(100).default(80),
  notes: z.string().transform((s) => s || null),
});
