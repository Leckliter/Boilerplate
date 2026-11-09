/**
 * Switches the newsletter module on (imported from packages/core/src/modules.ts): double opt-in
 * sign-up (`newsletter.subscribe` → confirmation email → `newsletter.confirm`) and
 * `newsletter.unsubscribe`. To remove it: delete this folder, `actions/newsletter`, the line in
 * modules.ts, the `newsletter.subscribed` event, the `newsletter.confirm` notification type and
 * `apps/web/app/api/v1/newsletter`.
 */
import { registerActions } from '../actions/registry-store';
import {
  confirmNewsletter,
  subscribeNewsletter,
  unsubscribeNewsletter,
} from '../actions/newsletter';

registerActions(subscribeNewsletter, confirmNewsletter, unsubscribeNewsletter);
