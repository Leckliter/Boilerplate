import type { Tx } from '@app/db';

/** What `reportError` tells the alert handlers. */
export type ErrorAlert = {
  /** `new` = first occurrence of a bug (or first since it was fixed); `spike` = it is happening a lot. */
  kind: 'new' | 'spike';
  ref: string;
  code: string;
  message: string;
  /** The action, path or source it came from. */
  where: string;
  environment: string;
  /** Spikes only: how many times in `minutes`. */
  count?: number;
  minutes?: number;
  /** Notify at most once per this key (a ref for new bugs, bug + hour for spikes). */
  dedupeKey: string;
};

export type ErrorAlertHandler = (tx: Tx, alert: ErrorAlert) => Promise<void>;

/** Filled by modules at import time (see packages/core/src/modules.ts). */
export const errorAlertHandlers: ErrorAlertHandler[] = [];

/**
 * Be told about new bugs and spikes. The notifications module registers a handler that does
 * `notify(tx, 'staff.newError' | 'staff.errorSpike', { to: { permission: 'errors.manage' }, … })`.
 * Runs inside a transaction; throwing is safe (it is logged, never rethrown).
 */
export function registerErrorAlerts(handler: ErrorAlertHandler) {
  errorAlertHandlers.push(handler);
}
