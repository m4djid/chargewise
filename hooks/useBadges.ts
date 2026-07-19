'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/fetcher';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Emsp, EmspPlan } from '@/types/database';

// Shared client-side data hooks for badges + the eMSP/plan catalogue.
// The catalogue tables (emsps, emsp_plans) are directly readable by any
// authenticated user via RLS, so we query them with the browser client and
// join names client-side — this keeps us independent of the exact JSON shape
// the /api/badges route returns for its plan details.

export interface BadgeRow {
  id: string;
  emsp_id: string;
  plan_id: string;
  created_at?: string;
}

function normalizeBadges(data: unknown): BadgeRow[] {
  if (Array.isArray(data)) return data as BadgeRow[];
  if (data && typeof data === 'object') {
    const maybe = (data as { badges?: unknown }).badges;
    if (Array.isArray(maybe)) return maybe as BadgeRow[];
  }
  return [];
}

export function useBadges() {
  const { data, error, isLoading, mutate } = useSWR('/api/badges', fetcher);
  return { badges: normalizeBadges(data), error, isLoading, mutate };
}

export function useEmspCatalogue() {
  const { data, error } = useSWR(
    'supabase:emsp-catalogue',
    async () => {
      const supabase = getBrowserClient();
      const [emspsRes, plansRes] = await Promise.all([
        supabase.from('emsps').select('*').eq('is_active', true).order('display_name'),
        supabase.from('emsp_plans').select('*').eq('is_active', true).order('display_name'),
      ]);
      if (emspsRes.error) throw emspsRes.error;
      if (plansRes.error) throw plansRes.error;
      return {
        emsps: (emspsRes.data ?? []) as Emsp[],
        plans: (plansRes.data ?? []) as EmspPlan[],
      };
    },
    { revalidateOnFocus: false }
  );

  const emsps = data?.emsps ?? [];
  const plans = data?.plans ?? [];
  return {
    emsps,
    plans,
    emspById: new Map(emsps.map((e) => [e.id, e])),
    planById: new Map(plans.map((p) => [p.id, p])),
    isLoading: !data && !error,
  };
}
