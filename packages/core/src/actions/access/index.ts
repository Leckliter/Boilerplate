import { and, appRole, contactRoles, contacts, eq, inArray } from '@app/db';
import { z } from 'zod';

import { canGrantRole, ROLE_DESCRIPTIONS, ROLE_PERMISSIONS } from '../../access';
import { getContactOrThrow, withTagsAndRoles } from '../contacts/shared';
import { emit } from '../../events/emit';
import { ActionError, defineAction } from '../define';

const roleField = z.enum(appRole.enumValues).describe(
  Object.entries(ROLE_DESCRIPTIONS)
    .map(([r, d]) => `${r}: ${d}`)
    .join(' | '),
);

export const listRoles = defineAction({
  name: 'access.listRoles',
  title: 'List roles',
  description: 'The staff roles that exist and the permissions each one grants.',
  audience: 'authenticated',
  mutates: false,
  returns: '{ role, description, permissions[] }[]',
  input: z.object({}),
  async run() {
    return appRole.enumValues.map((role) => ({
      role,
      description: ROLE_DESCRIPTIONS[role],
      permissions: ROLE_PERMISSIONS[role],
    }));
  },
});

export const listStaff = defineAction({
  name: 'access.listStaff',
  title: 'List people with app access',
  description: 'Every contact that holds at least one staff role (access to /admin).',
  audience: 'roles.manage',
  mutates: false,
  returns: 'Contact[] (with tags, roles, hasLogin)',
  input: z.object({}),
  async run({ tx }) {
    const ids = await tx.selectDistinct({ id: contactRoles.contactId }).from(contactRoles);
    if (ids.length === 0) return [];
    const rows = await tx
      .select()
      .from(contacts)
      .where(
        inArray(
          contacts.id,
          ids.map((r) => r.id),
        ),
      );
    return withTagsAndRoles(tx, rows);
  },
});

export const grantRole = defineAction({
  name: 'access.grantRole',
  title: 'Grant role',
  description:
    'Give a contact a staff role, which unlocks /admin. The person signs in with their normal login ' +
    '(the contact must have one, or will get the role when they first sign in with that email). ' +
    'Only owners can grant "owner"; owners and admins can grant the rest.',
  audience: 'roles.manage',
  mutates: true,
  returns: 'The updated Contact',
  input: z.object({ contactId: z.uuid(), role: roleField }),
  async run({ input, actor, tx, log }) {
    if (!canGrantRole(actor.roles, input.role)) {
      throw new ActionError('forbidden', `Only an owner can grant the ${input.role} role.`);
    }
    const c = await getContactOrThrow(tx, input.contactId);
    const granted = await tx
      .insert(contactRoles)
      .values({ contactId: c.id, role: input.role, grantedBy: actor.contactId })
      .onConflictDoNothing()
      .returning({ role: contactRoles.role });
    if (granted.length) {
      await emit(tx, 'role.granted', {
        contactId: c.id,
        displayName: c.displayName,
        role: input.role,
      });
    }
    log({
      subjectType: 'contact',
      subjectId: c.id,
      summary: `Granted ${input.role} to ${c.displayName}`,
    });
    const [view] = await withTagsAndRoles(tx, [c]);
    return view!;
  },
});

export const revokeRole = defineAction({
  name: 'access.revokeRole',
  title: 'Revoke role',
  description: 'Take a staff role away from a contact. The last owner can never be removed.',
  audience: 'roles.manage',
  mutates: true,
  destructive: true,
  returns: 'The updated Contact',
  input: z.object({ contactId: z.uuid(), role: roleField }),
  async run({ input, actor, tx, log }) {
    if (!canGrantRole(actor.roles, input.role)) {
      throw new ActionError('forbidden', `Only an owner can remove the ${input.role} role.`);
    }
    if (input.role === 'owner') {
      // Lock every owner row so two simultaneous revokes can't both pass the check.
      const owners = await tx
        .select({ contactId: contactRoles.contactId })
        .from(contactRoles)
        .where(eq(contactRoles.role, 'owner'))
        .for('update');
      const isOwner = owners.some((o) => o.contactId === input.contactId);
      if (isOwner && owners.length <= 1) {
        throw new ActionError('conflict', 'This is the last owner; add another owner first.');
      }
    }
    const c = await getContactOrThrow(tx, input.contactId);
    const removed = await tx
      .delete(contactRoles)
      .where(and(eq(contactRoles.contactId, c.id), eq(contactRoles.role, input.role)))
      .returning({ role: contactRoles.role });
    if (removed.length) {
      await emit(tx, 'role.revoked', {
        contactId: c.id,
        displayName: c.displayName,
        role: input.role,
      });
    }
    log({
      subjectType: 'contact',
      subjectId: c.id,
      summary: `Revoked ${input.role} from ${c.displayName}`,
    });
    const [view] = await withTagsAndRoles(tx, [c]);
    return view!;
  },
});
