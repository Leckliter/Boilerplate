import { contacts, eq, type Tx } from '@app/db';

import { type Actor, hasPermission } from '../../access';
import type { FilePurpose } from '../../files/purposes';
import { ActionError } from '../define';

/**
 * What a file can belong to. A subject type needs a check that the record exists; add yours here
 * (e.g. `project: async (tx, id) => …`) when you add a purpose for it in files/purposes.ts.
 */
const SUBJECTS: Record<string, (tx: Tx, id: string) => Promise<string | null>> = {
  /** Resolves to a label for the activity log, or null when there is no such record. */
  contact: async (tx, id) => {
    const [c] = await tx
      .select({ name: contacts.displayName })
      .from(contacts)
      .where(eq(contacts.id, id));
    return c?.name ?? null;
  },
};

export async function subjectLabel(tx: Tx, subject: string, id: string): Promise<string> {
  const check = SUBJECTS[subject];
  if (!check)
    throw new ActionError('internal', `No subject check for "${subject}" (files/subjects.ts).`);
  const label = await check(tx, id);
  if (!label) throw new ActionError('not_found', `No such ${subject}.`);
  return label;
}

/** May this actor read / write files of this purpose on this subject? Throws `forbidden` if not. */
export function requireFileAccess(
  actor: Actor,
  purpose: FilePurpose,
  mode: 'read' | 'write',
  subjectId: string,
) {
  const needed = purpose.access[mode];
  const ok =
    needed === 'self-only'
      ? subjectId === actor.contactId
      : needed === 'self'
        ? subjectId === actor.contactId || hasPermission(actor, 'users.manage')
        : hasPermission(actor, needed);
  if (!ok) {
    throw new ActionError(
      'forbidden',
      `You don’t have permission to ${mode === 'write' ? 'add or remove' : 'see'} ${purpose.label.toLowerCase()}s here.`,
    );
  }
}
