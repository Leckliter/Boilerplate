-- Belt and braces: The browser-facing roles of Supabase / Neon Data API (anon, authenticated) must
-- never read or write our tables directly. Only the server connection
-- (postgres role, used by actions) may. RLS is also enabled on every table
-- with no policies. (The DO blocks skip this on plain local Postgres, where
-- these roles don't exist.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA app FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA app FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA app REVOKE ALL ON TABLES FROM anon, authenticated;
  END IF;
END $$;
--> statement-breakpoint
-- The migrator's bookkeeping table (drizzle.__drizzle_migrations) gets the same
-- treatment as our app tables: RLS on with no policies, and no access for
-- the browser-facing roles. The migrator connects as the table owner
-- (postgres), which RLS doesn't restrict.
ALTER TABLE "drizzle"."__drizzle_migrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA drizzle FROM anon, authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA drizzle FROM anon, authenticated;
  END IF;
END $$;
--> statement-breakpoint
-- The contact categories that drive the admin Contacts menu.
-- System tags can be renamed in the UI but never deleted.
INSERT INTO "app"."tags" ("slug", "label", "kind", "color", "sort_order", "system", "description") VALUES
  ('customer', 'Customer', 'type', 'brand',  10, true, 'Buys from or uses the product.'),
  ('lead',     'Lead',     'type', 'blue',   20, true, 'Reached out or signed up, not a customer yet.'),
  ('staff',    'Staff',    'type', 'green',  30, true, 'Works for the business. App access is granted separately with roles.'),
  ('vendor',   'Vendor',   'type', 'amber',  40, true, 'Supplies goods or services to the business.')
ON CONFLICT ("slug") DO NOTHING;
