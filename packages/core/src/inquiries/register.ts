/**
 * Switches the inquiries module on (imported from packages/core/src/modules.ts): the public
 * contact form action `inquiries.create` and the staff inbox actions. To remove it: delete this
 * folder, `actions/inquiries`, the line in modules.ts, the `inquiry.created` event, the
 * `staff.newInquiry` notification type and the admin/website screens that use it.
 */
import {
  archiveInquiry,
  createInquiry,
  getInquiry,
  listInquiries,
  updateInquiry,
} from '../actions/inquiries';
import { registerActions } from '../actions/registry-store';
import { registerSearchProvider } from '../actions/search/providers';
import { searchInquiries } from './search';

registerActions(createInquiry, listInquiries, getInquiry, updateInquiry, archiveInquiry);

// ⌘K search: inquiries, for people who manage them.
registerSearchProvider('inquiries', searchInquiries, { order: 40 });
