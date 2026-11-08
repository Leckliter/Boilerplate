import type { Definition } from '@app/core/automations';

/** One plain-English line for a step ("Wait 3d", "Run contacts.addTags" …) — lists and run history. */
export function describeStep(step: { type: string } & Record<string, unknown>): string {
  const s = step as Record<string, unknown>;
  switch (s.type) {
    case 'action':
      return `Run ${String(s.action)}`;
    case 'wait':
      return `Wait ${String(s.for)}`;
    case 'waitForEvent':
      return `Wait for ${String(s.event)} (up to ${String(s.timeout)})`;
    case 'condition':
      return 'Stop unless the conditions hold';
    case 'branch':
      return 'If / else';
    case 'notifyStaff':
      return `Tell staff (${String(s.permission)}): ${String(s.title)}`;
    case 'notifyContact':
      return `Message a contact: ${String(s.title)}`;
    case 'sendEmail':
      return `Email a contact: ${String(s.subject)}`;
    case 'sendText':
      return 'Text a contact';
    case 'webhook':
      return `Call ${String(s.url)}`;
    default:
      return String(s.type);
  }
}

export function describeTrigger(trigger: Definition['trigger']): string {
  if (trigger.type === 'event') return `When ${trigger.event} happens`;
  if (trigger.everyMinutes) return `Every ${trigger.everyMinutes} minutes`;
  return `Daily at ${trigger.dailyAt}${trigger.weekdays ? ` (days ${trigger.weekdays.join(', ')})` : ''}`;
}
