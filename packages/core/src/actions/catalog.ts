/**
 * THE list of every CORE action. Adding a feature = add an action file, then add it here.
 * It is then automatically available to the admin UI, the REST API (/api/v1/actions/<name>),
 * the MCP server (/api/mcp) and the generated docs (docs/actions.generated.md).
 *
 * Optional modules (events, notifications, …) register their own actions from
 * packages/core/src/modules.ts instead of being listed here, so deleting a module is deleting a folder.
 */
import { getMyAccount, updateMyAccount } from './account';
import { grantRole, listRoles, listStaff, revokeRole } from './access';
import { getActivity, listActivity, listChanges } from './activity';
import { createApiKey, listApiKeys, revokeApiKey } from './api-keys';
import {
  addContactTags,
  archiveContact,
  createContact,
  getContact,
  listContacts,
  removeContactTags,
  restoreContact,
  updateContact,
} from './contacts';
import { getError, listErrors, resolveError } from './errors';
import { registerActions } from './registry-store';
import {
  getSetting,
  listIntegrations,
  listSettings,
  setSetting,
  updateIntegration,
} from './settings';
import { systemIntegrations, whoami } from './system';
import { cancelJob, listJobs, retryJob, systemHealth } from './system/jobs';
import { createTag, deleteTag, listTags } from './tags';

registerActions(
  // contacts, tags, access
  listContacts,
  getContact,
  createContact,
  updateContact,
  archiveContact,
  restoreContact,
  addContactTags,
  removeContactTags,
  listTags,
  createTag,
  deleteTag,
  listRoles,
  listStaff,
  grantRole,
  revokeRole,
  // my account
  getMyAccount,
  updateMyAccount,
  // activity, errors
  listActivity,
  getActivity,
  listChanges,
  listErrors,
  getError,
  resolveError,
  // API keys, settings, integrations
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listSettings,
  getSetting,
  setSetting,
  listIntegrations,
  updateIntegration,
  // system
  whoami,
  systemIntegrations,
  systemHealth,
  listJobs,
  retryJob,
  cancelJob,
);
