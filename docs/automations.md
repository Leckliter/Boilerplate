# Automations

"When something happens (or on a schedule), if …, do these steps" — once, reliably, even when it
takes weeks. Built only on our Postgres and the job queue. Code: `packages/core/src/automations/`,
actions `automations.*` and `events.list`, UI at `/admin/automations`. Events: [events.md](events.md).

```
action's transaction ──emit()──► app.events + job events.dispatch
  events.dispatch (one transaction, event row locked):
     cancel runs whose cancelOn matches · resume runs waiting for it · start automations · mark dispatched
  app.automation_runs ──► job automations.advance: step by step, each result saved in app.automation_steps
  wait / waitForEvent: the run waits (status waiting, wake_at) and a job is scheduled for later
```

## The shape (plain JSON, so the admin screen, REST and AI all write the same thing)

`trigger` (an event, or a schedule `everyMinutes` / `dailyAt` in `APP_TIME_ZONE`), optional
`conditions`, `steps`, optional `cancelOn` and `concurrencyKey`. Step types: `action`, `wait`,
`waitForEvent`, `condition`, `branch` (if/else), `notifyStaff`, `notifyContact`, `sendEmail`,
`sendText`, `webhook`. Templates: `{{event.data.contactId}}`, `{{steps.<id>.field}}`, `{{run.id}}`;
a value that is only a template keeps its type. Call `automations.reference` for every event, step
and the actions you may use.

## Exactly once

| Risk                                | Guard                                                                                                                     |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Event lost / sent for a rolled back | The outbox: `emit` writes in the change's own transaction.                                                                |
| Event dispatched twice              | Dispatch locks the event row and sets `dispatched_at` in the same transaction.                                            |
| Two runs for one trigger            | Unique `(automation_id, trigger_key)`: `event:<id>`, `schedule:<slot>`, `manual:<uuid>`.                                  |
| Two runs for one thing              | Optional `concurrencyKey`; extras are recorded as `skipped`.                                                              |
| A step repeated after a crash       | Steps marked `done` are skipped; action steps carry an idempotency key; message steps commit with their step.             |
| Two runners on one run              | A lease (`lease_until`, 5 min) claimed with a conditional update.                                                         |
| Loops                               | Events caused by a run carry the automation id and a depth; an automation never starts from its own events (max depth 5). |

Steps are at least once at the edges: a webhook that times out after doing its work is called again with
the same `x-app-delivery` id.

## Failures and permissions

A step that gets `internal` / `rate_limited` (or an outside 5xx) throws and the job retries with
backoff; any other refusal fails the run at once unless the step has `continueOnError`. A failed run
sends `staff.automationFailed` (once a day per automation) and emits `automation.failed`;
`automations.retryRun` resumes at the failed step. Everything needs `automations.manage` (owners and
admins) because steps run as the system (`automationActor`, channel `automation`). Saving checks the
editor may run every action used, and `automations.*` and `system` actions cannot be steps.
Webhook steps sign the body with `AUTOMATIONS_WEBHOOK_SECRET` (`x-app-signature: sha256=…`).

## Schedules

Schedule-triggered automations start from the per-minute cron: `runModuleTicks()` (module tick
`automations.schedule`), one run per automation + slot.
