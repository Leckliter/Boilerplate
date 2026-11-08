/** What the web app imports from the notifications module (`@app/core/notifications`). */
export { CHANNELS, type Channel } from './base';
export { smsConsentText } from './consent';
export {
  dismissNotifications,
  getPreferences,
  listDeliveries,
  listNotifications,
  markRead,
  openNotification,
  recordSuppression,
  retryDelivery,
  sendTest,
  setPreference,
  setSmsConsent,
  unreadCount,
  unsubscribe,
} from '../actions/notifications';
