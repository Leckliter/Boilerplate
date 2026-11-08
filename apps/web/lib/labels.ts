/**
 * Human labels for the database names that show up in the activity and field history ("contact_tags",
 * "first_name"). Anything not listed falls back to Title Case of the name, so a NEW table or column
 * reads fine with no edit here; add an entry only when the automatic label is not what you want.
 */
const TABLE_LABELS: Record<string, string> = {
  contacts: 'Details',
  contact_tags: 'Tag',
  contact_roles: 'Role',
  tags: 'Tag definition',
  api_keys: 'API key',
  settings: 'Setting',
  integrations: 'Integration',
};

const FIELD_LABELS: Record<string, string> = {
  sms_consent_at: 'Agreed to texts',
  archived_at: 'Archived',
  postal_code: 'ZIP',
  auth_user_id: 'Login',
};

/** "contact_tags" → "Contact tags", "first_name" → "First name". */
export function humanize(name: string): string {
  const spaced = name.replace(/^app\./, '').replace(/[_.-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export const tableLabel = (table: string) => TABLE_LABELS[table.replace(/^app\./, '')] ?? humanize(table);
export const fieldLabel = (field: string) => FIELD_LABELS[field] ?? humanize(field);

/** Subject types in the activity log → where to open them (add yours). */
export const SUBJECT_LINKS: Record<string, (id: string) => string> = {
  contact: (id) => `/admin/users/${id}`,
};

/** Columns that say nothing to a person: ids and timestamps (a few timestamps are meaningful). */
export const isBookkeeping = (field: string) =>
  field === 'id' ||
  field.endsWith('_id') ||
  (field.endsWith('_at') && !['archived_at', 'sms_consent_at'].includes(field));
