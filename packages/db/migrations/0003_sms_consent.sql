ALTER TABLE "app"."contacts" ADD COLUMN "sms_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."contacts" ADD COLUMN "sms_consent_source" text;--> statement-breakpoint
ALTER TABLE "app"."contacts" ADD COLUMN "sms_consent_text" text;