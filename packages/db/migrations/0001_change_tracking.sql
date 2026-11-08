-- Field-level change history for every table in the `app` schema.
--
-- An AFTER trigger on each table writes one app.change_log row per inserted,
-- updated or deleted row: the columns that changed (before → after). Actions
-- set `app.activity_id` for their transaction (runAction does this), so each
-- change links to the activity-log entry saying who did it and how. Writes
-- made outside an action (sign-in linking, seeds, a fix typed into the
-- Supabase SQL editor) are still recorded, with activity_id null and the
-- database user that made them.
--
-- NEW TABLE? Track it in its migration:
--   SELECT app.track_changes('app.my_table', 'id');                 -- history belongs to the row itself
--   SELECT app.track_changes('app.my_child', 'parent_id');          -- history shows on the parent
--   SELECT app.track_changes('app.secrets', 'id', 'secret_hash');   -- never copy these columns
-- packages/core/test/logging.test.ts fails for any app table that isn't tracked.

CREATE OR REPLACE FUNCTION app.record_change() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  -- TG_ARGV[0] = column holding the subject id; the rest = columns never copied.
  skip text[] := ARRAY['updated_at'] || COALESCE(TG_ARGV[1:], '{}'::text[]);
  full_row jsonb;
  old_row jsonb;
  new_row jsonb;
  b jsonb;
  a jsonb;
  k text;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_row := to_jsonb(OLD) - skip; END IF;
  IF TG_OP <> 'DELETE' THEN new_row := to_jsonb(NEW) - skip; END IF;
  full_row := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;

  IF TG_OP = 'UPDATE' THEN
    b := '{}'::jsonb;
    a := '{}'::jsonb;
    FOR k IN SELECT jsonb_object_keys(new_row) LOOP
      IF new_row -> k IS DISTINCT FROM old_row -> k THEN
        b := b || jsonb_build_object(k, old_row -> k);
        a := a || jsonb_build_object(k, new_row -> k);
      END IF;
    END LOOP;
    -- Only skipped columns changed (timestamps, sync bookkeeping): nothing to record.
    IF a = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSE
    b := old_row;
    a := new_row;
  END IF;

  INSERT INTO app.change_log (activity_id, table_name, row_id, subject_id, op, before, after, db_user)
  VALUES (
    NULLIF(current_setting('app.activity_id', true), '')::uuid,
    TG_TABLE_NAME,
    full_row ->> 'id',
    (full_row ->> TG_ARGV[0])::uuid,
    lower(TG_OP),
    b,
    a,
    session_user
  );
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app.track_changes(tbl regclass, subject_column text, VARIADIC skip text[] DEFAULT '{}')
RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS record_change ON %s', tbl);
  EXECUTE format(
    'CREATE TRIGGER record_change AFTER INSERT OR UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION app.record_change(%s)',
    tbl,
    (SELECT string_agg(quote_literal(x), ', ') FROM unnest(subject_column || skip) AS x)
  );
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION app.track_changes(regclass, text, text[]) FROM PUBLIC;
--> statement-breakpoint
--> statement-breakpoint
SELECT app.track_changes('app.contacts', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.tags', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.contact_tags', 'contact_id');
--> statement-breakpoint
SELECT app.track_changes('app.contact_roles', 'contact_id');
--> statement-breakpoint
SELECT app.track_changes('app.api_keys', 'contact_id', 'key_hash', 'last_used_at');
--> statement-breakpoint
SELECT app.track_changes('app.automations', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.integrations', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.settings', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.files', 'id');
--> statement-breakpoint
SELECT app.track_changes('app.notification_preferences', 'contact_id');
--> statement-breakpoint
SELECT app.track_changes('app.push_subscriptions', 'contact_id', 'p256dh', 'auth', 'last_success_at');
--> statement-breakpoint
SELECT app.track_changes('app.message_suppressions', 'id');
--> statement-breakpoint
-- NOT tracked on purpose (high volume / throwaway / they ARE the log): activity_log, change_log,
-- error_events, idempotency_keys, rate_limit_hits, jobs, cron_runs, events, automation_runs,
-- automation_steps, notifications, notification_deliveries. See the allow-list in logging.test.ts.
