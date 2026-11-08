'use server';

import { type ActionResult, runAction, runDueJobs, reportError } from '@app/core';
import { after } from 'next/server';

import { getActor } from './viewer';

/**
 * Run any action from a client component as the signed-in person:
 *
 *   const res = await invokeAction('contacts.create', { firstName: 'Ann', tags: ['lead'] });
 *
 * Safe to expose: the action itself checks permissions and validates input, exactly as it does for
 * the REST API and MCP. Public forms pass the bot-check token as `humanToken` (guests only).
 * Background jobs the action queued run right after the response.
 */
export async function invokeAction(
  name: string,
  input: unknown,
  opts: { humanToken?: string | null } = {},
): Promise<ActionResult<unknown>> {
  const actor = await getActor();
  const withToken =
    opts.humanToken && actor.request
      ? { ...actor, request: { ...actor.request, humanToken: opts.humanToken } }
      : actor;
  const result = await runAction(name, input, withToken);
  if (result.ok) {
    after(async () => {
      try {
        await runDueJobs({ limit: 10, deadlineMs: 20_000 });
      } catch (err) {
        await reportError(err, { source: 'job', context: { where: 'invokeAction after()' } });
      }
    });
  }
  return result;
}
