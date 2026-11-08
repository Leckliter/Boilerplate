import { z } from 'zod';

import { PERMISSIONS, type Permission } from '../access';

/**
 * The shape of an automation (docs/automations.md). It is plain JSON so the
 * admin screen, the REST API and AI clients (MCP) can all read and write it.
 *
 * Values in `input`, `title`, `body`, `match.equals`, condition values and
 * `concurrencyKey` may use templates: `{{event.data.contactId}}`,
 * `{{steps.task.id}}` (a step's output, by its `id` or index), `{{run.id}}`.
 * A value that is ONLY a template keeps its type (number, list …).
 */

/** `30m`, `2h`, `3d`, `1w` (minutes, hours, days, weeks). */
const durationField = z
  .string()
  .regex(/^\d{1,4}(m|h|d|w)$/, 'Use a number and m, h, d or w — e.g. 30m, 2h, 3d, 1w.')
  .describe('A duration: number + m/h/d/w, e.g. 30m, 2h, 3d, 1w');

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 } as const;

export function durationMs(d: string): number {
  const m = /^(\d+)(m|h|d|w)$/.exec(d);
  if (!m) throw new Error(`Bad duration "${d}"`);
  return Number(m[1]) * UNIT_MS[m[2] as keyof typeof UNIT_MS];
}

/** At most a year: runs that wait longer than that are almost certainly a mistake. */
const MAX_WAIT_MS = 366 * UNIT_MS.d;
const boundedDuration = durationField.refine((d) => {
  // Zod runs this even when the format check failed; that one already explains the problem.
  if (!/^\d+(m|h|d|w)$/.test(d)) return true;
  const ms = durationMs(d);
  return ms >= 60_000 && ms <= MAX_WAIT_MS;
}, 'Between 1 minute and a year.');

const pathField = z
  .string()
  .regex(/^[A-Za-z_][\w]*(\.[\w-]+)*$/, 'A dotted path like event.data.contactId')
  .describe('Dotted path into the context, e.g. event.data.contactId or steps.contact.status');

export const OPERATORS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'exists',
  'notExists',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
] as const;

export const conditionSchema = z.object({
  path: pathField,
  op: z.enum(OPERATORS),
  value: z.unknown().optional().describe('Compared with (templates allowed). Not for exists.'),
});
export type Condition = z.infer<typeof conditionSchema>;

const matchField = z
  .enum(['all', 'any'])
  .default('all')
  .describe('all = every condition must hold (AND); any = at least one (OR)');
export type ConditionMatch = 'all' | 'any';

const stepBase = {
  id: z
    .string()
    .regex(/^[a-z][a-zA-Z0-9]{0,39}$/, 'camelCase letters and digits, e.g. task or contact')
    .optional()
    .describe('Name for this step so later steps can use its output: {{steps.<id>.…}}'),
  label: z.string().trim().max(120).optional().describe('What it does, for people'),
};

const text = (max: number) => z.string().trim().min(1).max(max);

const channelsField = z
  .array(z.enum(['email', 'sms', 'push']))
  .min(1)
  .optional()
  .describe(
    'Only these channels (email = Resend, sms = Quo, push). Default: every channel the person gets. ' +
      'Preferences, SMS consent, opt-outs and quiet hours still apply.',
  );

/** Every step except `branch` (which holds other steps). */
const leafStepSchema = z.discriminatedUnion('type', [
  z.object({
    ...stepBase,
    type: z.literal('action'),
    action: z.string().describe('An action name, e.g. contacts.addTags (see GET /api/v1/actions)'),
    input: z.record(z.string(), z.unknown()).default({}).describe('Its input (templates allowed)'),
    continueOnError: z
      .boolean()
      .default(false)
      .describe('Keep going if the action refuses (not_found, conflict …). Default: stop the run.'),
  }),
  z.object({
    ...stepBase,
    type: z.literal('wait'),
    for: boundedDuration.describe('How long to pause, e.g. 3d'),
  }),
  z.object({
    ...stepBase,
    type: z.literal('waitForEvent'),
    event: z.string().describe('The event to wait for, e.g. role.revoked'),
    match: z
      .object({ field: pathField, equals: z.unknown() })
      .optional()
      .describe(
        'Only an event whose field (e.g. data.itemId) equals this value (templates allowed)',
      ),
    timeout: boundedDuration.describe('Give up waiting after this long'),
    onTimeout: z.enum(['continue', 'stop']).default('continue'),
  }),
  z.object({
    ...stepBase,
    type: z.literal('condition'),
    match: matchField,
    conditions: z.array(conditionSchema).min(1).max(20),
  }),
  z.object({
    ...stepBase,
    type: z.literal('notifyStaff'),
    permission: z
      .enum(Object.keys(PERMISSIONS) as [Permission, ...Permission[]])
      .default('admin.access')
      .describe('Everyone whose role has this permission gets it'),
    title: text(150),
    body: text(1_000),
    url: z
      .string()
      .max(500)
      .optional()
      .describe('Link, e.g. /admin/contacts/{{event.data.contactId}}'),
    channels: channelsField,
  }),
  z.object({
    ...stepBase,
    type: z.literal('notifyContact'),
    contactId: z.string().describe('The contact, e.g. {{event.data.contactId}}'),
    title: text(150),
    body: text(1_000),
    sms: z
      .string()
      .trim()
      .max(320)
      .optional()
      .describe('Text message version (default: the body). Only sent with SMS consent.'),
    url: z.string().max(500).optional(),
    channels: channelsField,
  }),
  z.object({
    ...stepBase,
    type: z.literal('sendEmail'),
    contactId: z.string().describe('The contact, e.g. {{event.data.contactId}}'),
    subject: text(150),
    body: text(5_000).describe('Starts after “Hi <first name>,”'),
    url: z.string().max(500).optional().describe('Button link, e.g. /account'),
  }),
  z.object({
    ...stepBase,
    type: z.literal('sendText'),
    contactId: z.string().describe('The contact, e.g. {{event.data.contactId}}'),
    text: text(320).describe('The text message (keep it under 160 characters for one SMS)'),
  }),
  z.object({
    ...stepBase,
    type: z.literal('webhook'),
    url: z
      .url({ protocol: /^https$/ })
      .describe('HTTPS address that receives a signed POST (Zapier, n8n, your own service)'),
    body: z.unknown().optional().describe('JSON to send (templates allowed). Default: the event.'),
  }),
]);
type LeafStep = z.infer<typeof leafStepSchema>;
type LeafStepInput = z.input<typeof leafStepSchema>;

/** If/else: the `then` steps when the conditions hold, else the `else` steps; then carry on. */
type BranchStep = {
  type: 'branch';
  id?: string | undefined;
  label?: string | undefined;
  match: ConditionMatch;
  conditions: Condition[];
  then: Step[];
  else: Step[];
};
type BranchStepInput = {
  type: 'branch';
  id?: string | undefined;
  label?: string | undefined;
  match?: ConditionMatch | undefined;
  conditions: Condition[];
  then?: StepInput[] | undefined;
  else?: StepInput[] | undefined;
};
export type Step = LeafStep | BranchStep;
export type StepInput = LeafStepInput | BranchStepInput;
export type StepType = Step['type'];

/** Branches inside branches: at most this deep. */
const MAX_BRANCH_DEPTH = 4;
/** Steps in one automation, counting the ones inside branches. */
const MAX_STEPS = 100;

type StepArray = z.ZodDefault<z.ZodArray<z.ZodType<Step, StepInput>>>;

const branchSchema = z.object({
  ...stepBase,
  type: z.literal('branch'),
  match: matchField,
  conditions: z.array(conditionSchema).min(1).max(20),
  // Getters: a branch holds steps, which may be branches (zod's recursive objects).
  get then(): StepArray {
    return z.array(stepSchema).max(50).default([]).describe('Steps when the conditions hold');
  },
  get else(): StepArray {
    return z.array(stepSchema).max(50).default([]).describe('Steps when they don’t');
  },
});

/** One step: any of the step types above, or a branch. */
export const stepSchema = z.discriminatedUnion('type', [
  leafStepSchema,
  branchSchema,
]) as unknown as z.ZodType<Step, StepInput>;

/** Visit every step, including those inside branches (depth 0 = top level). */
export function walkSteps(
  steps: readonly Step[],
  fn: (step: Step, where: string, depth: number) => void,
  prefix = 'Step ',
  depth = 0,
) {
  steps.forEach((step, i) => {
    const where = `${prefix}${i + 1}`;
    fn(step, where, depth);
    if (step.type === 'branch') {
      walkSteps(step.then, fn, `${where} → yes → step `, depth + 1);
      walkSteps(step.else, fn, `${where} → no → step `, depth + 1);
    }
  });
}

// ------------------------------------------------------------------ running: flat steps

/**
 * What a run follows: the tree flattened into one list, so every step has one
 * index (saved results, retries and "step 3 of 7" keep working). A branch
 * knows where its `else` steps start and where the whole if/else ends; the
 * engine jumps there (see nextIndex).
 */
type FlatBranch = Omit<BranchStep, 'then' | 'else'> & { elseAt: number; endAt: number };
export type FlatStep = LeafStep | FlatBranch;

export function flattenSteps(steps: readonly Step[]): FlatStep[] {
  const out: FlatStep[] = [];
  const add = (list: readonly Step[]) => {
    for (const step of list) {
      if (step.type !== 'branch') {
        out.push(step);
        continue;
      }
      const { then, else: otherwise, ...rest } = step;
      const flat: FlatBranch = { ...rest, elseAt: -1, endAt: -1 };
      out.push(flat);
      add(then);
      flat.elseAt = out.length;
      add(otherwise);
      flat.endAt = out.length;
    }
  };
  add(steps);
  return out;
}

/**
 * The step after `i` when `i` finished normally. Reaching the start of a
 * branch's `else` steps that way means its `then` steps are done: skip to its end.
 */
export function nextIndex(steps: readonly FlatStep[], i: number): number {
  let n = i + 1;
  for (let guard = 0; guard <= steps.length; guard++) {
    const branch = steps.find((s): s is FlatBranch => s.type === 'branch' && s.elseAt === n);
    // A branch with no else steps: elseAt === endAt, nothing to skip.
    if (!branch || branch.endAt === n) return n;
    n = branch.endAt;
  }
  return n;
}

export const STEP_TYPES: Record<StepType, string> = {
  action:
    'Run any action (the same ones as the REST API / MCP) as the system. Output = the action’s result.',
  wait: 'Pause for a while (minutes to a year). Costs nothing while waiting.',
  waitForEvent:
    'Pause until an event happens (optionally matching a field), or until the timeout. Output = { event, timedOut }.',
  condition:
    'Stop the run here (as completed) unless the conditions hold (match: all = AND, any = OR).',
  branch:
    'If/else: when the conditions hold (match all/any), do the `then` steps, otherwise the `else` steps; then carry on ' +
    'with the steps after the branch. Branches can hold branches. Output = { matched }.',
  notifyStaff: 'Inbox + email/push to staff with a permission (their notification settings apply).',
  notifyContact:
    'Message a contact: inbox + email, push, and a text only if they agreed to texts. Quiet hours apply. ' +
    'Output = { notified, sent, deliveries: [{ channel, status, reason }] }.',
  sendEmail:
    'Email a contact through Resend (plus their in-app inbox). Skipped if they turned these emails off, ' +
    'have no email or it bounced. Output = { sent, deliveries }.',
  sendText:
    'Text a contact from the business number. Only with their recorded SMS consent, not after STOP, and customer texts wait ' +
    'for 8am–9pm Central. Output = { sent, deliveries } — check {{steps.<id>.sent}} to fall back to email.',
  webhook:
    'POST JSON to an HTTPS URL, signed with x-app-signature (HMAC-SHA256 of the body) and x-app-delivery for de-duplication. Retried on failure.',
};

export const triggerSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('event'),
    event: z.string().describe('Event name, e.g. contact.created (see automations.reference)'),
  }),
  z.object({
    type: z.literal('schedule'),
    everyMinutes: z
      .number()
      .int()
      .min(5)
      .max(7 * 24 * 60)
      .optional()
      .describe('Run every N minutes (at least 5)'),
    dailyAt: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM, 24-hour')
      .optional()
      .describe('Run once a day at this time in the app’s time zone (APP_TIME_ZONE), e.g. 08:30'),
    weekdays: z
      .array(z.number().int().min(1).max(7))
      .min(1)
      .optional()
      .describe('With dailyAt: only these days (1 = Monday … 7 = Sunday)'),
  }),
]);
export type Trigger = z.infer<typeof triggerSchema>;

const cancelRuleSchema = z.object({
  event: z.string().describe('e.g. role.revoked'),
  match: z
    .object({ field: pathField, equals: z.unknown() })
    .optional()
    .describe('e.g. { field: "data.orderId", equals: "{{event.data.contactId}}" }'),
});
export type CancelRule = z.infer<typeof cancelRuleSchema>;

const tagField = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[^,]+$/, 'A tag can’t contain a comma.');

export const definitionSchema = z
  .object({
    name: text(120),
    description: z.string().trim().max(2_000).nullable().optional(),
    tags: z
      .array(tagField)
      .max(20)
      .default([])
      .transform((tags) => {
        // Case-insensitive de-duplication; keeps the first spelling.
        const seen = new Set<string>();
        return tags.filter((t) => !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
      })
      .describe('Labels for finding and grouping automations, e.g. ["rentals", "follow-up"]'),
    trigger: triggerSchema,
    conditions: z
      .array(conditionSchema)
      .max(20)
      .default([])
      .describe('All must hold for a run to start (checked against the trigger event)'),
    steps: z.array(stepSchema).min(1).max(MAX_STEPS),
    cancelOn: z
      .array(cancelRuleSchema)
      .max(10)
      .default([])
      .describe('Events that stop a run that is still going'),
    concurrencyKey: z
      .string()
      .max(200)
      .nullable()
      .optional()
      .describe(
        'Template, e.g. {{event.data.contactId}}: while a run with the same value is active, new ones are skipped',
      ),
  })
  .superRefine((d, ctx) => {
    if (d.trigger.type === 'schedule') {
      const t = d.trigger;
      if (Boolean(t.everyMinutes) === Boolean(t.dailyAt)) {
        ctx.addIssue({
          code: 'custom',
          path: ['trigger'],
          message: 'A schedule needs exactly one of everyMinutes or dailyAt.',
        });
      }
      if (t.weekdays && !t.dailyAt) {
        ctx.addIssue({ code: 'custom', path: ['trigger'], message: 'weekdays needs dailyAt.' });
      }
    }
    const ids: string[] = [];
    let count = 0;
    let deepest = 0;
    walkSteps(d.steps, (s, _where, depth) => {
      count++;
      deepest = Math.max(deepest, depth);
      if (s.id) ids.push(s.id);
    });
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', path: ['steps'], message: 'Step ids must be unique.' });
    }
    if (count > MAX_STEPS) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: `At most ${MAX_STEPS} steps, counting the ones inside branches.`,
      });
    }
    if (deepest > MAX_BRANCH_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        path: ['steps'],
        message: `Branches can be nested at most ${MAX_BRANCH_DEPTH} deep.`,
      });
    }
  });
export type Definition = z.infer<typeof definitionSchema>;
export type DefinitionInput = z.input<typeof definitionSchema>;

/** What a run follows (a flattened copy taken when it starts). */
export type RunDefinition = { name: string; steps: FlatStep[] };
