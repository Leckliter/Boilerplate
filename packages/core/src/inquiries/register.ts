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

registerActions(createInquiry, listInquiries, getInquiry, updateInquiry, archiveInquiry);
