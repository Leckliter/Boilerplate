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
import { exportActivityCsv } from './activity/export';
import { createApiKey, listApiKeys, revokeApiKey } from './api-keys';
import {
  addContactTags,
  archiveContact,
  bulkAddContactTags,
  bulkArchiveContacts,
  createContact,
  exportContactsCsv,
  getContact,
  importContacts,
  listContacts,
  removeContactTags,
  restoreContact,
  updateContact,
} from './contacts';
import { errorOccurrences, getError, listErrors, resolveError, resolveManyErrors } from './errors';
import { listFlags, setFeatureFlag } from './flags';
import { registerActions } from './registry-store';
import { search } from './search';
import {
  getSetting,
  listIntegrations,
  listSettings,
  setSetting,
  updateIntegration,
} from './settings';
import { systemIntegrations, whoami } from './system';
import { cancelJob, listCronRuns, listJobs, retryJob, systemHealth } from './system/jobs';
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
  bulkAddContactTags,
  bulkArchiveContacts,
  importContacts,
  exportContactsCsv,
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
  exportActivityCsv,
  listErrors,
  getError,
  resolveError,
  resolveManyErrors,
  errorOccurrences,
  // API keys, settings, integrations
  listApiKeys,
  createApiKey,
  revokeApiKey,
  listSettings,
  getSetting,
  setSetting,
  listIntegrations,
  updateIntegration,
  listFlags,
  setFeatureFlag,
  // search
  search,
  // system
  whoami,
  systemIntegrations,
  systemHealth,
  listCronRuns,
  listJobs,
  retryJob,
  cancelJob,
);
