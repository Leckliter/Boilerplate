import { z } from 'zod';

import { defineJob } from '../jobs/define';
import { advanceRun, dispatchEvent } from './runs';

/** Hand a new event to the automations listening for it (queued by `emit`). */
export const dispatchEventJob = defineJob({
  type: 'events.dispatch',
  description:
    'Start, resume or cancel the automations listening for a business event. Runs once per event.',
  payload: z.object({ eventId: z.uuid() }),
  maxAttempts: 8,
  run: ({ eventId }) => dispatchEvent(eventId),
});

/** Do an automation run's next steps (queued when a run starts, wakes up or is resumed). */
export const advanceRunJob = defineJob({
  type: 'automations.advance',
  description:
    'Do the next steps of an automation run, until it finishes or waits. A failing step is retried here.',
  payload: z.object({ runId: z.uuid() }),
  maxAttempts: 6,
  run: ({ runId }, { job }) => advanceRun(runId, { lastAttempt: job.attempts >= job.maxAttempts }),
});
