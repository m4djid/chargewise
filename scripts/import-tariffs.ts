// scripts/import-tariffs.ts — bulk tariff CSV import (spec §7.1, Block 0.4).
//
// Usage: npx tsx scripts/import-tariffs.ts [path/to/file.csv]
// Defaults to data/tariffs-seed.csv. Requires NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY (script context — service role is allowed here,
// spec §8.1 restricts it to cron/scripts, never user-facing routes).
//
// parse CSV → validate each row with tariffCsvRowSchema → upsert in chunks of
// 100 on the tariffs_upsert_key conflict target → print summary.
// Exit code 1 if any row fails validation.

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import type { z } from 'zod';
import { tariffCsvRowSchema } from '../lib/validation';

type TariffCsvRow = z.infer<typeof tariffCsvRowSchema>;
type TariffInsertRow = TariffCsvRow & { last_verified_at: string };

const CHUNK_SIZE = 100;
const CONFLICT_TARGET =
  'emsp_plan_id,cpo_id,station_id,connector_type,max_power_kw_min,max_power_kw_max';

// Empty CSV cells in numeric columns must become NULL, not 0 (spec §4.2:
// "NULL = no lower power band"). z.coerce.number() turns '' into 0, so we
// map empty cells to undefined first — the schema's .catch(null)/.default()
// then produces the correct NULL / default.
const NUMERIC_COLUMNS = [
  'max_power_kw_min',
  'max_power_kw_max',
  'session_fee_eur',
  'per_kwh_eur',
  'per_min_eur',
  'idle_fee_per_min_eur',
  'idle_fee_grace_min',
  'confidence_score',
] as const;

function normalizeRecord(
  record: Record<string, string>,
): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = { ...record };
  for (const column of NUMERIC_COLUMNS) {
    if (out[column] === '') out[column] = undefined;
  }
  return out;
}

/** Minimal .env.local loader — no dotenv dependency (values already in the
 *  environment win). */
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error(
      'Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY (set them in .env.local).',
    );
    process.exit(1);
  }

  const csvPath = path.resolve(process.cwd(), process.argv[2] ?? 'data/tariffs-seed.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const validRows: TariffInsertRow[] = [];
  const failures: { line: number; message: string }[] = [];
  const lastVerifiedAt = new Date().toISOString();

  records.forEach((record, i) => {
    const line = i + 2; // header is line 1
    const result = tariffCsvRowSchema.safeParse(normalizeRecord(record));
    if (result.success) {
      validRows.push({ ...result.data, last_verified_at: lastVerifiedAt });
    } else {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(row)'}: ${issue.message}`)
        .join('; ');
      failures.push({ line, message });
    }
  });

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let upserted = 0;
  for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
    const chunk = validRows.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('tariffs')
      .upsert(chunk, { onConflict: CONFLICT_TARGET });
    if (error) {
      console.error(
        `Upsert failed for chunk starting at CSV line ${i + 2}: ${error.message}`,
      );
      process.exit(1);
    }
    upserted += chunk.length;
    console.log(`  upserted ${upserted}/${validRows.length}`);
  }

  console.log('---');
  console.log(`rows ok:     ${upserted}`);
  console.log(`rows failed: ${failures.length}`);
  for (const failure of failures) {
    console.log(`  line ${failure.line}: ${failure.message}`);
  }

  if (failures.length > 0) process.exit(1);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
