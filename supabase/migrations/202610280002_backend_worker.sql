-- The worker token was generated privately and is stored in Supabase Vault and
-- Edge secrets. No administrative credential is part of this migration.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'halaqi-backend-worker', '* * * * *',
  $worker$
  select net.http_post(
    url := 'https://vjeuesqrzywragnjvkpi.supabase.co/functions/v1/backend',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-halaqi-job-token', (select decrypted_secret from vault.decrypted_secrets where name = 'halaqi_backend_job_token' limit 1)
    ),
    body := '{"action":"dispatch-pending"}'::jsonb,
    timeout_milliseconds := 100000
  );
  $worker$
);
