/** Notification types sent to staff (audience `staff`). Listed in ./registry.ts. */
import { defineType, type MessageData, STAFF_DEFAULTS } from './base';

type ErrorData = {
  ref: string;
  code: string;
  message: string;
  where: string;
  environment: string;
};

export const staffNewError = defineType<ErrorData>()({
  key: 'staff.newError',
  audience: 'staff',
  permission: 'errors.manage',
  label: 'New errors',
  description: 'The first time a new bug happens (repeats don’t notify).',
  defaults: STAFF_DEFAULTS,
  render: (d) => ({
    title: `New error ${d.ref}: ${d.message.slice(0, 80)}`,
    body: `${d.code} in ${d.where} (${d.environment}). Open it and use “Copy for AI agent” to get it fixed.`,
    emailSubject: `[${d.environment}] New error ${d.ref}: ${d.message.slice(0, 80)}`,
    url: `/admin/errors/${d.ref}`,
    action: 'Open error report',
    sms: `New ${d.environment} error ${d.ref}: ${d.message.slice(0, 100)}`,
  }),
});

export const staffErrorSpike = defineType<ErrorData & { count: number; minutes: number }>()({
  key: 'staff.errorSpike',
  audience: 'staff',
  permission: 'errors.manage',
  label: 'Error spikes',
  description:
    'A known, unfixed bug suddenly happens many times (at most one alert per bug per hour).',
  urgent: true,
  defaults: STAFF_DEFAULTS,
  render: (d) => ({
    title: `Error spike: ${d.count}× in ${d.minutes} min — ${d.message.slice(0, 60)}`,
    body: `${d.code} in ${d.where} (${d.environment}) happened ${d.count} times in the last ${d.minutes} minutes. Latest: ${d.ref}.`,
    emailSubject: `[${d.environment}] Error spike: ${d.count}× in ${d.minutes} min — ${d.message.slice(0, 60)}`,
    url: `/admin/errors/${d.ref}`,
    action: 'Open error report',
    sms: `${d.environment} error spike: ${d.count}x in ${d.minutes} min (${d.ref}): ${d.message.slice(0, 80)}`,
  }),
});

/** A message an automation sends to staff. */
export const staffAutomationMessage = defineType<MessageData>()({
  key: 'staff.automationMessage',
  audience: 'staff',
  permission: 'admin.access',
  label: 'Automation messages',
  description: 'Messages your automations send to staff (e.g. “call this customer”).',
  defaults: STAFF_DEFAULTS,
  render: (d) => ({
    title: d.title,
    body: d.body,
    emailSubject: d.title,
    emailLines: d.automationName ? [`Sent by the automation “${d.automationName}”.`] : undefined,
    url: d.url ?? '/admin',
    action: 'Open',
    sms: d.sms ?? `${d.title}: ${d.body}`.slice(0, 300),
  }),
});

export const staffAutomationFailed = defineType<{
  automationId: string;
  automationName: string;
  runId: string;
  error: string;
}>()({
  key: 'staff.automationFailed',
  audience: 'staff',
  permission: 'automations.manage',
  label: 'Automation failures',
  description: 'An automation stopped with an error (at most one alert per automation per day).',
  defaults: STAFF_DEFAULTS,
  render: (d) => ({
    title: `Automation failed: ${d.automationName}`,
    body: `“${d.automationName}” stopped: ${d.error.slice(0, 300)}. Fix the cause, then retry the run.`,
    emailSubject: `Automation failed: ${d.automationName}`,
    url: `/admin/automations/${d.automationId}`,
    action: 'Open the automation',
    sms: `Automation failed: ${d.automationName} — ${d.error.slice(0, 100)}`,
  }),
});

/** A website visitor sent the contact form. */
export const staffNewInquiry = defineType<{
  inquiryId: string;
  name: string;
  email: string;
  subject: string | null;
  preview: string;
}>()({
  key: 'staff.newInquiry',
  audience: 'staff',
  permission: 'inquiries.manage',
  label: 'New website inquiries',
  description: 'Someone sent the contact form on the website.',
  defaults: STAFF_DEFAULTS,
  render: (d) => ({
    title: `New inquiry from ${d.name}`,
    body: `${d.subject ? `“${d.subject}” — ` : ''}${d.preview}`,
    emailSubject: `New inquiry from ${d.name}${d.subject ? `: ${d.subject}` : ''}`,
    emailLines: [`Reply to ${d.email}.`],
    url: `/admin/inquiries/${d.inquiryId}`,
    action: 'Open the inquiry',
    sms: `New inquiry from ${d.name}: ${d.preview}`.slice(0, 300),
  }),
});
