/**
 * "Something changed on the server": a tiny browser event so parts of the shell that load their own data
 * (the notification bell's unread count) can refresh right after a person does something, instead of on
 * their next poll. `useAction` and `<ActionForm>` fire it after every successful action.
 */
const EVENT = 'app:data-changed';

export function announceDataChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(EVENT));
}

/** Calls `callback` whenever an action succeeded in this tab. Returns the unsubscribe function. */
export function onDataChanged(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
