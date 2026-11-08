import type { AppRole } from '@app/db';

/**
 * THE permission list. Every action declares exactly one of these (or one of the special
 * audiences below). Roles are bundles of permissions. Tags never grant anything.
 *
 * To add a permission: add it here with a description, add it to the roles that should have
 * it, and use it in an action. Run `pnpm actions:docs`.
 */
export const PERMISSIONS = {
  'admin.access': 'Open the admin app (/admin).',
  'users.read': 'View and search all contacts (people, customers, staff).',
  'users.manage':
    'Create, edit, archive and restore contacts, and add or remove their tags; create and delete tags.',
  'roles.manage': 'Grant and revoke staff roles.',
  'activity.read': 'View the activity log and the change history of records.',
  'errors.manage':
    'View error reports with full technical detail (stack traces, inputs) and mark them fixed.',
  'api_keys.manage': 'Create and revoke API keys for yourself (REST API and MCP).',
  'settings.manage': 'Change business settings and integrations in Admin → Settings.',
  'docs.internal': 'Read internal (staff-only) docs at /docs and over the API/MCP.',
  'automations.manage':
    'Create, edit, turn on/off and test automations, see their runs and the event log. ' +
    'Automations act as the system, so only owners and admins have this.',
  'notifications.manage':
    'See every notification sent to anyone and its delivery status; retry failed ones.',
  'system.manage':
    'See system health, scheduled jobs and background jobs; retry or cancel jobs. (Technical — owners and admins.)',
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Special audiences for actions that aren't staff-only:
 * - `public`        — anyone, even signed-out visitors (e.g. a contact form)
 * - `authenticated` — any signed-in contact, including customers (e.g. update my own profile)
 * - `system`        — only the system itself (webhooks, crons); never people, API keys or AI
 */
export type Audience = Permission | 'public' | 'authenticated' | 'system';

export const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  owner: 'Everything, including managing other staff and owners.',
  admin: 'Everything except granting the owner role.',
  manager: 'Runs day-to-day operations in admin: people, activity, notifications, settings.',
  staff: 'Admin access for day-to-day work; read-only on people and settings.',
};

const ALL = Object.keys(PERMISSIONS) as Permission[];

/**
 * What each staff role may do. A signed-in contact with NO role is a customer: they have no
 * permissions here, only the `authenticated` actions (their own account, /account).
 */
export const ROLE_PERMISSIONS: Record<AppRole, readonly Permission[]> = {
  owner: ALL,
  admin: ALL,
  manager: [
    'admin.access',
    'users.read',
    'users.manage',
    'activity.read',
    'api_keys.manage',
    'settings.manage',
    'docs.internal',
    'notifications.manage',
  ],
  staff: ['admin.access', 'users.read', 'docs.internal'],
};

export function permissionsForRoles(roles: readonly AppRole[]): Set<Permission> {
  return new Set(roles.flatMap((r) => ROLE_PERMISSIONS[r]));
}

/** Roles a granter may hand out. Only owners can create owners. */
export function canGrantRole(granterRoles: readonly AppRole[], role: AppRole): boolean {
  if (role === 'owner') return granterRoles.includes('owner');
  return granterRoles.includes('owner') || granterRoles.includes('admin');
}
