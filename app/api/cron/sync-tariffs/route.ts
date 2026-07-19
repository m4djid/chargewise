import { getServiceRoleClient } from '@/lib/supabase';
import { errorResponse, logError } from '@/lib/errors';
import { syncTariffs } from '@/lib/chargeprice';

// Spec §7.2 + Block 1.9 — nightly Chargeprice sync (Vercel cron, 3am UTC).
// Vercel cron sends GET; POST supported for manual triggers. Service role
// client allowed here per spec §8.1.

export const maxDuration = 300;

async function handle(request: Request): Promise<Response> {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const summary = await syncTariffs(getServiceRoleClient());
    return Response.json(summary);
  } catch (error) {
    logError({
      route: '/api/cron/sync-tariffs',
      code: 'TARIFF_SYNC_FAILED',
      message: error instanceof Error ? error.message : 'tariff sync failed',
      context: { cron: 'sync-tariffs' },
      error,
    });
    return errorResponse('TARIFF_SYNC_FAILED');
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
