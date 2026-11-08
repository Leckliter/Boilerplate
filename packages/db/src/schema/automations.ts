import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { contacts } from './contacts';
import { app, createdAt, id, updatedAt } from './_shared';

/**
 * Events and automations. See docs/automations.md.
 *
 * EVENTS — "this happened" (user.invited, report.published …). Written with
 * `emit(tx, 'type', data)` INSIDE the action's transaction (an outbox), so an
 * event exists exactly when the change it describes was saved. A background
 * job then hands each event to the automations listening for it — once
 * (`dispatched_at`, and a unique run per automation + event).
 *
 * AUTOMATIONS — "when X happens (or on a schedule), if these conditions hold,
 * do these steps". Rules are data, edited through actions (Admin, REST, MCP).
 *
 * RUNS — one automation working through its steps for one trigger. Each step's
 * result is saved (`automation_steps`), so a retried run never repeats a step
 * that already finished. Runs can wait (minutes to months) for a time or for
 * another event, and are cancelled by events listed in `cancelOn`.
 */

/** Outbox + history of business events. Never updated except `dispatched_at`. */
export const events = app
  .table(
    'events',
    {
      id: id(),
      /** e.g. `contact.created` — see packages/core/src/events/catalog.ts. */
      type: text('type').notNull(),
      data: jsonb('data').notNull().default({}),
      subjectType: text('subject_type'),
      subjectId: uuid('subject_id'),
      /** The same type + key is only ever recorded once (webhook retries, cron reruns). */
      dedupeKey: text('dedupe_key'),
      /** The activity-log entry of the action that caused it. */
      activityId: uuid('activity_id'),
      /** Set when an automation's step caused this event (loop protection). */
      causeAutomationId: uuid('cause_automation_id'),
      causeRunId: uuid('cause_run_id'),
      /** 0 = caused by a person / webhook; +1 for each automation in the chain. */
      depth: integer('depth').notNull().default(0),
      occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
      /** When automations were started / resumed / cancelled for it. */
      dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    },
    (t) => [
      index('events_type_idx').on(t.type, t.occurredAt),
      index('events_subject_idx').on(t.subjectType, t.subjectId),
      index('events_undispatched_idx')
        .on(t.occurredAt)
        .where(sql`${t.dispatchedAt} is null`),
      uniqueIndex('events_dedupe_key')
        .on(t.type, t.dedupeKey)
        .where(sql`${t.dedupeKey} is not null`),
    ],
  )
  .enableRLS();

/** The rule itself. Its JSON shapes are validated by packages/core/src/automations/definition.ts. */
export const automations = app
  .table(
    'automations',
    {
      id: id(),
      name: text('name').notNull(),
      description: text('description'),
      /** Labels for finding and grouping automations (free text, e.g. onboarding, follow-up). */
      tags: text('tags')
        .array()
        .notNull()
        .default(sql`'{}'::text[]`),
      enabled: boolean('enabled').notNull().default(false),
      /** `{ type: 'event', event }` or `{ type: 'schedule', every | daily }`. */
      trigger: jsonb('trigger').notNull(),
      /** Copied from trigger.event, for fast lookup (null for schedules). */
      triggerEvent: text('trigger_event'),
      conditions: jsonb('conditions').notNull().default([]),
      steps: jsonb('steps').notNull().default([]),
      /** Events that stop a run early, e.g. a cancellation event for the same record. */
      cancelOn: jsonb('cancel_on').notNull().default([]),
      /** Template, e.g. `{{event.data.itemId}}`: at most one active run per value. */
      concurrencyKey: text('concurrency_key'),
      /** Bumped on every edit; runs remember which version they started on. */
      version: integer('version').notNull().default(1),
      createdByContactId: uuid('created_by_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      updatedByContactId: uuid('updated_by_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      archivedAt: timestamp('archived_at', { withTimezone: true }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      index('automations_trigger_event_idx').on(t.triggerEvent),
      index('automations_tags_idx').using('gin', t.tags),
    ],
  )
  .enableRLS();

export const automationRunStatus = app.enum('automation_run_status', [
  'running', // working through steps (or queued to)
  'waiting', // paused: a wait step or waiting for an event
  'completed',
  'failed',
  'cancelled',
  'skipped', // not started: another run with the same concurrency key was active
]);

export const automationRuns = app
  .table(
    'automation_runs',
    {
      id: id(),
      automationId: uuid('automation_id')
        .notNull()
        .references(() => automations.id, { onDelete: 'cascade' }),
      automationVersion: integer('automation_version').notNull(),
      /** The steps / cancelOn this run follows (a copy, so edits don't change runs in flight). */
      definition: jsonb('definition').notNull(),
      status: automationRunStatus('status').notNull().default('running'),
      /** `event:<id>`, `schedule:<slot>` or `manual:<uuid>` — one run per automation + trigger. */
      triggerKey: text('trigger_key').notNull(),
      /** What started it: `{ type, data, subject, eventId, occurredAt }`. */
      trigger: jsonb('trigger').notNull(),
      eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
      depth: integer('depth').notNull().default(0),
      concurrencyKey: text('concurrency_key'),
      /** Rendered cancelOn rules: `[{ event, field, value }]`. */
      cancelOn: jsonb('cancel_on').notNull().default([]),
      /** Just the event types of cancelOn, for lookup. */
      cancelEvents: text('cancel_events').array().notNull().default([]),
      /** Index of the next step to do. */
      currentStep: integer('current_step').notNull().default(0),
      /** While waiting for an event: which one, and which field must equal what. */
      waitingEvent: text('waiting_event'),
      waitingMatch: jsonb('waiting_match'),
      /** While waiting: when it continues anyway (end of a wait / a timeout). */
      wakeAt: timestamp('wake_at', { withTimezone: true }),
      /** A runner working on this run holds it until then (crash-safe lock). */
      leaseUntil: timestamp('lease_until', { withTimezone: true }),
      error: text('error'),
      errorRef: text('error_ref'),
      /** Why it was skipped / cancelled / stopped. */
      note: text('note'),
      startedByContactId: uuid('started_by_contact_id').references(() => contacts.id, {
        onDelete: 'set null',
      }),
      finishedAt: timestamp('finished_at', { withTimezone: true }),
      createdAt: createdAt(),
      updatedAt: updatedAt(),
    },
    (t) => [
      uniqueIndex('automation_runs_trigger').on(t.automationId, t.triggerKey),
      uniqueIndex('automation_runs_one_active')
        .on(t.automationId, t.concurrencyKey)
        .where(sql`${t.concurrencyKey} is not null and ${t.status} in ('running', 'waiting')`),
      index('automation_runs_automation_idx').on(t.automationId, t.createdAt),
      index('automation_runs_waiting_idx')
        .on(t.waitingEvent)
        .where(sql`${t.status} = 'waiting' and ${t.waitingEvent} is not null`),
      index('automation_runs_cancel_idx')
        .using('gin', t.cancelEvents)
        .where(sql`${t.status} in ('running', 'waiting')`),
      index('automation_runs_status_idx').on(t.status, t.createdAt),
    ],
  )
  .enableRLS();

export const automationStepStatus = app.enum('automation_step_status', [
  'waiting', // a wait / waitForEvent step that hasn't finished
  'done',
  'failed',
]);

/** One row per step a run has reached. A `done` step is never run again. */
export const automationSteps = app
  .table(
    'automation_steps',
    {
      runId: uuid('run_id')
        .notNull()
        .references(() => automationRuns.id, { onDelete: 'cascade' }),
      index: integer('index').notNull(),
      type: text('type').notNull(),
      status: automationStepStatus('status').notNull(),
      /** What the step produced (an action's result, the event waited for …), small JSON. */
      output: jsonb('output'),
      error: text('error'),
      startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
      finishedAt: timestamp('finished_at', { withTimezone: true }),
    },
    (t) => [primaryKey({ columns: [t.runId, t.index] })],
  )
  .enableRLS();

export type AppEvent = typeof events.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type AutomationStep = typeof automationSteps.$inferSelect;
