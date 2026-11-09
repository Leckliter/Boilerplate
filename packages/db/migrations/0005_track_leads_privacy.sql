-- Change history for the lead and privacy tables, and the `newsletter` tag.
SELECT app.track_changes('app.inquiries', 'contact_id');--> statement-breakpoint
SELECT app.track_changes('app.newsletter_subscriptions', 'contact_id');--> statement-breakpoint
SELECT app.track_changes('app.deletion_requests', 'contact_id');--> statement-breakpoint
-- Members of the newsletter (confirmed subscribers). A system tag: it can be renamed, never deleted.
INSERT INTO "app"."tags" ("slug", "label", "kind", "color", "sort_order", "system", "description") VALUES
  ('newsletter', 'Newsletter', 'label', 'purple', 50, true, 'Confirmed newsletter subscriber (double opt-in).')
ON CONFLICT ("slug") DO NOTHING;
