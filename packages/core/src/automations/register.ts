/**
 * Switches the events + automations module on (imported from packages/core/src/modules.ts):
 * registers the `events.*` and `automations.*` actions, the two jobs (`events.dispatch`,
 * `automations.advance`), the per-minute schedule tick, and the `error.new` / `error.spike`
 * events. The module is the folders `events/` and `automations/`, `actions/events/`,
 * `actions/automations/` and this line in modules.ts (docs/events.md).
 */
import { registerActions } from '../actions/registry-store';
import {
  archiveAutomation,
  automationsReference,
  cancelRunAction,
  createAutomation,
  duplicateAutomation,
  getAutomation,
  getRun,
  listAutomations,
  listAutomationTags,
  listRuns,
  retryRunAction,
  runAutomation,
  updateAutomation,
} from '../actions/automations';
import { listEvents, recordSignIn } from '../actions/events';
import { registerErrorAlerts } from '../errors/alerts';
import { emit } from '../events/emit';
import { registerJob } from '../jobs';
import { registerTick } from '../module-ticks';
import { advanceRunJob, dispatchEventJob } from './jobs';
import { startScheduledAutomations } from './runs';

registerActions(
  listEvents,
  recordSignIn,
  automationsReference,
  listAutomations,
  getAutomation,
  listAutomationTags,
  createAutomation,
  updateAutomation,
  archiveAutomation,
  duplicateAutomation,
  runAutomation,
  listRuns,
  getRun,
  cancelRunAction,
  retryRunAction,
);

registerJob(dispatchEventJob);
registerJob(advanceRunJob);

// Schedule-triggered automations start from the per-minute cron (one run per automation + slot).
registerTick('automations.schedule', (now) => startScheduledAutomations(now));

// A new bug or a spike is also an event, so an automation can react (post to a channel, open a task).
registerErrorAlerts(async (tx, alert) => {
  const data = {
    ref: alert.ref,
    code: alert.code,
    message: alert.message,
    where: alert.where,
    environment: alert.environment,
  };
  if (alert.kind === 'new') {
    await emit(tx, 'error.new', data, { dedupeKey: alert.dedupeKey });
  } else {
    await emit(
      tx,
      'error.spike',
      { ...data, count: alert.count ?? 0, minutes: alert.minutes ?? 0 },
      { dedupeKey: alert.dedupeKey },
    );
  }
});
