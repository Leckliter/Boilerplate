CREATE SCHEMA IF NOT EXISTS "app";--> statement-breakpoint
CREATE TYPE "app"."contact_status" AS ENUM('active', 'archived');--> statement-breakpoint
CREATE TYPE "app"."tag_kind" AS ENUM('type', 'label');--> statement-breakpoint
CREATE TYPE "app"."app_role" AS ENUM('owner', 'admin', 'manager', 'staff');--> statement-breakpoint
CREATE TYPE "app"."action_channel" AS ENUM('web', 'api', 'mcp', 'system', 'cli', 'automation');--> statement-breakpoint
CREATE TYPE "app"."activity_kind" AS ENUM('change', 'read', 'auth');--> statement-breakpoint
CREATE TYPE "app"."actor_kind" AS ENUM('user', 'api_key', 'system', 'guest');--> statement-breakpoint
CREATE TYPE "app"."error_source" AS ENUM('action', 'request', 'client', 'webhook', 'job');--> statement-breakpoint
CREATE TYPE "app"."job_status" AS ENUM('pending', 'running', 'done', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "app"."automation_run_status" AS ENUM('running', 'waiting', 'completed', 'failed', 'cancelled', 'skipped');--> statement-breakpoint
CREATE TYPE "app"."automation_step_status" AS ENUM('waiting', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "app"."delivery_status" AS ENUM('pending', 'sending', 'sent', 'delivered', 'failed', 'skipped');--> statement-breakpoint
CREATE TYPE "app"."notification_channel" AS ENUM('email', 'sms', 'push');--> statement-breakpoint
CREATE TYPE "app"."file_status" AS ENUM('pending', 'ready', 'deleted');--> statement-breakpoint
CREATE TABLE "app"."contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text,
	"last_name" text,
	"company_name" text,
	"display_name" text NOT NULL,
	"email" text,
	"phone" text,
	"auth_user_id" text,
	"status" "app"."contact_status" DEFAULT 'active' NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."contacts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."contact_tags" (
	"contact_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid,
	CONSTRAINT "contact_tags_contact_id_tag_id_pk" PRIMARY KEY("contact_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "app"."contact_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"kind" "app"."tag_kind" DEFAULT 'label' NOT NULL,
	"description" text,
	"color" text DEFAULT 'neutral' NOT NULL,
	"sort_order" integer DEFAULT 100 NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "app"."tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."contact_roles" (
	"contact_id" uuid NOT NULL,
	"role" "app"."app_role" NOT NULL,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"granted_by" uuid,
	CONSTRAINT "contact_roles_contact_id_role_pk" PRIMARY KEY("contact_id","role")
);
--> statement-breakpoint
ALTER TABLE "app"."contact_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"permissions" text[],
	"last_used_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
ALTER TABLE "app"."api_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."activity_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" "app"."activity_kind" DEFAULT 'change' NOT NULL,
	"action" text NOT NULL,
	"actor_kind" "app"."actor_kind" NOT NULL,
	"actor_contact_id" uuid,
	"api_key_id" uuid,
	"channel" "app"."action_channel" NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"summary" text,
	"input" jsonb,
	"ok" boolean NOT NULL,
	"error" text,
	"error_code" text,
	"error_ref" text,
	"request_id" text,
	"ip" text,
	"user_agent" text,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "app"."activity_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"activity_id" uuid,
	"table_name" text NOT NULL,
	"row_id" text,
	"subject_id" uuid,
	"op" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"db_user" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."change_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."error_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ref" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "app"."error_source" NOT NULL,
	"code" text NOT NULL,
	"hint" text,
	"fingerprint" text NOT NULL,
	"error_name" text,
	"message" text NOT NULL,
	"stack" text,
	"causes" jsonb,
	"environment" text NOT NULL,
	"release" text,
	"action" text,
	"path" text,
	"method" text,
	"digest" text,
	"request_id" text,
	"actor_kind" "app"."actor_kind",
	"actor_contact_id" uuid,
	"api_key_id" uuid,
	"channel" "app"."action_channel",
	"input" jsonb,
	"context" jsonb,
	"ip" text,
	"user_agent" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	CONSTRAINT "error_events_ref_unique" UNIQUE("ref")
);
--> statement-breakpoint
ALTER TABLE "app"."error_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."rate_limit_hits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"hits" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "rate_limit_hits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
ALTER TABLE "app"."rate_limit_hits" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."idempotency_keys" (
	"caller" text NOT NULL,
	"key" text NOT NULL,
	"action" text NOT NULL,
	"request_hash" text NOT NULL,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."idempotency_keys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "app"."job_status" DEFAULT 'pending' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"dedupe_key" text,
	"last_error" text,
	"error_ref" text,
	"result" jsonb,
	"activity_id" uuid,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."automation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"automation_id" uuid NOT NULL,
	"automation_version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"status" "app"."automation_run_status" DEFAULT 'running' NOT NULL,
	"trigger_key" text NOT NULL,
	"trigger" jsonb NOT NULL,
	"event_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"concurrency_key" text,
	"cancel_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancel_events" text[] DEFAULT '{}' NOT NULL,
	"current_step" integer DEFAULT 0 NOT NULL,
	"waiting_event" text,
	"waiting_match" jsonb,
	"wake_at" timestamp with time zone,
	"lease_until" timestamp with time zone,
	"error" text,
	"error_ref" text,
	"note" text,
	"started_by_contact_id" uuid,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."automation_steps" (
	"run_id" uuid NOT NULL,
	"index" integer NOT NULL,
	"type" text NOT NULL,
	"status" "app"."automation_step_status" NOT NULL,
	"output" jsonb,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "automation_steps_run_id_index_pk" PRIMARY KEY("run_id","index")
);
--> statement-breakpoint
ALTER TABLE "app"."automation_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."automations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"trigger" jsonb NOT NULL,
	"trigger_event" text,
	"conditions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"cancel_on" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"concurrency_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by_contact_id" uuid,
	"updated_by_contact_id" uuid,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."automations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"dedupe_key" text,
	"activity_id" uuid,
	"cause_automation_id" uuid,
	"cause_run_id" uuid,
	"depth" integer DEFAULT 0 NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dispatched_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."message_suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" "app"."notification_channel" NOT NULL,
	"address" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."message_suppressions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."notification_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notification_id" uuid NOT NULL,
	"channel" "app"."notification_channel" NOT NULL,
	"status" "app"."delivery_status" DEFAULT 'pending' NOT NULL,
	"to" text NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"provider_id" text,
	"sent_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."notification_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."notification_preferences" (
	"contact_id" uuid NOT NULL,
	"type" text NOT NULL,
	"channel" "app"."notification_channel" NOT NULL,
	"enabled" boolean NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_contact_id_type_channel_pk" PRIMARY KEY("contact_id","type","channel")
);
--> statement-breakpoint
ALTER TABLE "app"."notification_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"subject_type" text,
	"subject_id" uuid,
	"dedupe_key" text,
	"activity_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "app"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contact_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_success_at" timestamp with time zone,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "app"."push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purpose" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"filename" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint,
	"status" "app"."file_status" DEFAULT 'pending' NOT NULL,
	"caption" text,
	"uploaded_by_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "app"."cron_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_by_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integrations_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "app"."integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "app"."settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by_contact_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "app"."settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "app"."contact_tags" ADD CONSTRAINT "contact_tags_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contact_tags" ADD CONSTRAINT "contact_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "app"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contact_tags" ADD CONSTRAINT "contact_tags_added_by_contacts_id_fk" FOREIGN KEY ("added_by") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contact_roles" ADD CONSTRAINT "contact_roles_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."contact_roles" ADD CONSTRAINT "contact_roles_granted_by_contacts_id_fk" FOREIGN KEY ("granted_by") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."api_keys" ADD CONSTRAINT "api_keys_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."activity_log" ADD CONSTRAINT "activity_log_actor_contact_id_contacts_id_fk" FOREIGN KEY ("actor_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."activity_log" ADD CONSTRAINT "activity_log_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "app"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."error_events" ADD CONSTRAINT "error_events_actor_contact_id_contacts_id_fk" FOREIGN KEY ("actor_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."error_events" ADD CONSTRAINT "error_events_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "app"."api_keys"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."error_events" ADD CONSTRAINT "error_events_resolved_by_contacts_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ADD CONSTRAINT "automation_runs_automation_id_automations_id_fk" FOREIGN KEY ("automation_id") REFERENCES "app"."automations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ADD CONSTRAINT "automation_runs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "app"."events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_runs" ADD CONSTRAINT "automation_runs_started_by_contact_id_contacts_id_fk" FOREIGN KEY ("started_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automation_steps" ADD CONSTRAINT "automation_steps_run_id_automation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "app"."automation_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automations" ADD CONSTRAINT "automations_created_by_contact_id_contacts_id_fk" FOREIGN KEY ("created_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."automations" ADD CONSTRAINT "automations_updated_by_contact_id_contacts_id_fk" FOREIGN KEY ("updated_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_deliveries" ADD CONSTRAINT "notification_deliveries_notification_id_notifications_id_fk" FOREIGN KEY ("notification_id") REFERENCES "app"."notifications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notification_preferences" ADD CONSTRAINT "notification_preferences_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."notifications" ADD CONSTRAINT "notifications_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "app"."contacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."files" ADD CONSTRAINT "files_uploaded_by_contact_id_contacts_id_fk" FOREIGN KEY ("uploaded_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."integrations" ADD CONSTRAINT "integrations_updated_by_contact_id_contacts_id_fk" FOREIGN KEY ("updated_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."settings" ADD CONSTRAINT "settings_updated_by_contact_id_contacts_id_fk" FOREIGN KEY ("updated_by_contact_id") REFERENCES "app"."contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_email_key" ON "app"."contacts" USING btree ("email") WHERE "app"."contacts"."email" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_auth_user_id_key" ON "app"."contacts" USING btree ("auth_user_id") WHERE "app"."contacts"."auth_user_id" is not null;--> statement-breakpoint
CREATE INDEX "contacts_phone_idx" ON "app"."contacts" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "contacts_display_name_idx" ON "app"."contacts" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "contact_tags_tag_id_idx" ON "app"."contact_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "api_keys_contact_id_idx" ON "app"."api_keys" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "activity_log_occurred_at_idx" ON "app"."activity_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "activity_log_subject_idx" ON "app"."activity_log" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "activity_log_actor_idx" ON "app"."activity_log" USING btree ("actor_contact_id");--> statement-breakpoint
CREATE INDEX "activity_log_api_key_idx" ON "app"."activity_log" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "activity_log_request_idx" ON "app"."activity_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "change_log_activity_idx" ON "app"."change_log" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "change_log_subject_idx" ON "app"."change_log" USING btree ("subject_id","occurred_at");--> statement-breakpoint
CREATE INDEX "change_log_occurred_at_idx" ON "app"."change_log" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "error_events_occurred_at_idx" ON "app"."error_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "error_events_fingerprint_idx" ON "app"."error_events" USING btree ("fingerprint","occurred_at");--> statement-breakpoint
CREATE INDEX "error_events_digest_idx" ON "app"."error_events" USING btree ("digest");--> statement-breakpoint
CREATE INDEX "error_events_request_idx" ON "app"."error_events" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_keys_caller_key" ON "app"."idempotency_keys" USING btree ("caller","key");--> statement-breakpoint
CREATE INDEX "idempotency_keys_created_idx" ON "app"."idempotency_keys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "jobs_due_idx" ON "app"."jobs" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "jobs_dedupe_key" ON "app"."jobs" USING btree ("type","dedupe_key") WHERE "app"."jobs"."dedupe_key" is not null and "app"."jobs"."status" in ('pending', 'running');--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_trigger" ON "app"."automation_runs" USING btree ("automation_id","trigger_key");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_runs_one_active" ON "app"."automation_runs" USING btree ("automation_id","concurrency_key") WHERE "app"."automation_runs"."concurrency_key" is not null and "app"."automation_runs"."status" in ('running', 'waiting');--> statement-breakpoint
CREATE INDEX "automation_runs_automation_idx" ON "app"."automation_runs" USING btree ("automation_id","created_at");--> statement-breakpoint
CREATE INDEX "automation_runs_waiting_idx" ON "app"."automation_runs" USING btree ("waiting_event") WHERE "app"."automation_runs"."status" = 'waiting' and "app"."automation_runs"."waiting_event" is not null;--> statement-breakpoint
CREATE INDEX "automation_runs_cancel_idx" ON "app"."automation_runs" USING gin ("cancel_events") WHERE "app"."automation_runs"."status" in ('running', 'waiting');--> statement-breakpoint
CREATE INDEX "automation_runs_status_idx" ON "app"."automation_runs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "automations_trigger_event_idx" ON "app"."automations" USING btree ("trigger_event");--> statement-breakpoint
CREATE INDEX "automations_tags_idx" ON "app"."automations" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "app"."events" USING btree ("type","occurred_at");--> statement-breakpoint
CREATE INDEX "events_subject_idx" ON "app"."events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "events_undispatched_idx" ON "app"."events" USING btree ("occurred_at") WHERE "app"."events"."dispatched_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "events_dedupe_key" ON "app"."events" USING btree ("type","dedupe_key") WHERE "app"."events"."dedupe_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "message_suppressions_address_key" ON "app"."message_suppressions" USING btree ("channel","address");--> statement-breakpoint
CREATE INDEX "notification_deliveries_due_idx" ON "app"."notification_deliveries" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notification_deliveries_notification_idx" ON "app"."notification_deliveries" USING btree ("notification_id");--> statement-breakpoint
CREATE INDEX "notification_deliveries_provider_idx" ON "app"."notification_deliveries" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "notifications_contact_idx" ON "app"."notifications" USING btree ("contact_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key" ON "app"."notifications" USING btree ("contact_id","type","dedupe_key") WHERE "app"."notifications"."dedupe_key" is not null;--> statement-breakpoint
CREATE INDEX "push_subscriptions_contact_idx" ON "app"."push_subscriptions" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "files_subject_idx" ON "app"."files" USING btree ("subject_type","subject_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "files_bucket_path_key" ON "app"."files" USING btree ("bucket","path");--> statement-breakpoint
CREATE INDEX "files_pending_idx" ON "app"."files" USING btree ("created_at") WHERE "app"."files"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "cron_runs_job_idx" ON "app"."cron_runs" USING btree ("job","started_at");