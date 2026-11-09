CREATE TYPE "app"."inquiry_status" AS ENUM('new', 'in_progress', 'resolved', 'spam', 'archived');--> statement-breakpoint
CREATE TYPE "app"."newsletter_status" AS ENUM('pending', 'subscribed', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "app"."deletion_status" AS ENUM('pending', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "app"."inquiries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" text,
	"message" text NOT NULL,
	"status" "app"."inquiry_status" DEFAULT 'new' NOT NULL,
	"staff_note" text,
	"source" text DEFAULT 'website' NOT NULL,
	"handled_by_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."inquiries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."newsletter_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"contact_id" uuid,
	"status" "app"."newsletter_status" DEFAULT 'pending' NOT NULL,
	"consent_text" text,
	"consent_source" text,
	"consent_at" timestamp with time zone,
	"confirmed_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."newsletter_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."deletion_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" "app"."deletion_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"cancelled_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."deletion_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."inquiries" ADD CONSTRAINT "inquiries_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."inquiries" ADD CONSTRAINT "inquiries_handled_by_contact_id_contacts_id_fk" FOREIGN KEY ("handled_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."newsletter_subscriptions" ADD CONSTRAINT "newsletter_subscriptions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."deletion_requests" ADD CONSTRAINT "deletion_requests_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiries_status_idx" ON "app"."inquiries" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "inquiries_contact_idx" ON "app"."inquiries" USING btree ("contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "app"."newsletter_subscriptions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "deletion_requests_due_idx" ON "app"."deletion_requests" USING btree ("status","scheduled_for");--> statement-breakpoint
CREATE UNIQUE INDEX "deletion_requests_open_key" ON "app"."deletion_requests" USING btree ("contact_id") WHERE "app"."deletion_requests"."status" = 'pending';