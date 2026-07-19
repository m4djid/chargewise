-- 0004_cron.sql — weekly GDPR hard delete (spec §8.3, right to erasure step 2).
-- Step 1 is the user-triggered soft delete (profiles.deleted_at = now()).
-- Step 2: every Sunday 4am UTC, hard-delete auth.users rows whose profile was
-- soft-deleted more than 30 days ago. ON DELETE CASCADE then removes profiles,
-- badges, recommendations, charge_sessions, push_tokens.
--
-- Wrapped in a DO block: if pg_cron is not installed (e.g. local shadow DB or
-- a project where the extension is not enabled yet), skip with a NOTICE
-- instead of failing the migration. Re-run after enabling pg_cron.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- cron.schedule upserts by job name, so re-applying is safe.
    PERFORM cron.schedule(
      'hard-delete-gdpr',
      '0 4 * * 0',  -- Sundays at 4am UTC
      $job$
      DELETE FROM auth.users
      WHERE id IN (
        SELECT id FROM public.profiles
        WHERE deleted_at IS NOT NULL
        AND deleted_at < now() - INTERVAL '30 days'
      );
      $job$
    );
  ELSE
    RAISE NOTICE 'pg_cron not installed — GDPR hard-delete job NOT scheduled. Enable pg_cron and re-run this migration (spec §8.3).';
  END IF;
END;
$$;
