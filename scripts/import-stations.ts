// scripts/import-stations.ts — station CSV import (spec §4.2 stations table).
//
// Usage: npx tsx scripts/import-stations.ts [path/to/file.csv]
// Defaults to data/stations-seed.csv. Same pattern as import-tariffs.ts:
// parse → validate with zod → upsert (onConflict: 'id') in chunks of 100.
// connector_types is pipe-separated inside the CSV cell ("CCS2|Type2").

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const CHUNK_SIZE = 100;

// CSV header: id,cpo_id,display_name,address,city,country_code,lat,lng,
//             connector_types,max_power_kw,num_connectors,data_source
const stationCsvRowSchema = z.object({
  id: z.string().min(1),
  cpo_id: z.string().min(1),
  display_name: z.string().min(1),
  address: z.string().transform((s) => s || null),
  city: z.string().transform((s) => s || null),
  country_code: z.string().length(2),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  connector_types: z
    .string()
    .min(1)
    .transform((s) => s.split('|').map((c) => c.trim()).filter(Boolean)),
  max_power_kw: z.coerce.number().nullable().catch(null),
  num_connectors: z.coerce.number().int().nullable().catch(null),
  data_source: z.string().min(1),
});

type StationCsvRow = z.infer<typeof stationCsvRowSchema>;

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

  const csvPath = path.resolve(process.cwd(), process.argv[2] ?? 'data/stations-seed.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV file not found: ${csvPath}`);
    process.exit(1);
  }

  const records = parse(fs.readFileSync(csvPath, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];

  const validRows: StationCsvRow[] = [];
  const failures: { line: number; message: string }[] = [];

  records.forEach((record, i) => {
    const line = i + 2; // header is line 1
    // Empty numeric cells must become NULL, not 0 (Number('') === 0).
    const normalized: Record<string, string | undefined> = { ...record };
    if (normalized.max_power_kw === '') normalized.max_power_kw = undefined;
    if (normalized.num_connectors === '') normalized.num_connectors = undefined;
    const result = stationCsvRowSchema.safeParse(normalized);
    if (result.success) {
      validRows.push(result.data);
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
    const { error } = await supabase.from('stations').upsert(chunk, { onConflict: 'id' });
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
