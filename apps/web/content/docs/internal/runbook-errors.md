---
title: Runbook, errors
summary: What to do when someone reports an error reference, and how to hand it to an AI agent.
audience: internal
order: 1
---

When something breaks, the person sees an **error reference** such as `E-7K3QX9MD`. Everything we know about that failure is saved under it.

## Look it up

1. Open **Admin → Errors**. Failures are grouped: repeats of the same bug share one row with a count.
2. Open the row for the full report: diagnosis, where it happened, who, the redacted input, the deployed commit and the stack.
3. The **diagnosis** names the kind of failure and where to look first.

## Fix it with an AI agent

1. Press **Copy for AI agent**. This copies a Markdown brief that starts with `# Error E-…`.
2. Paste it into your coding agent (or give it the reference and an API key: it can fetch the same brief with the `errors.get` action).
3. The agent follows the `fix-error` skill: read the diagnosis, reproduce it in a test, fix it, run the checks.

## After the fix

Press **Mark fixed**. If the same bug comes back, it reopens by itself and you are alerted again.

## Alerts

People with the `errors.manage` permission get a notification the first time a new bug happens, and another if an open bug repeats 10 times in 15 minutes. Check **Account → Notifications** if you are not getting them.

## Not an error

"You don't have permission" and "that email is taken" are normal answers, not bugs. They are in the activity log, not in Errors.
