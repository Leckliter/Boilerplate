/**
 * Automations: "when X happens (or on a schedule), if …, do these steps".
 * See docs/automations.md. Everything here needs `automations.manage` (owners
 * and admins), because automation steps act as the system.
 *
 * One file per job; re-export new actions here.
 */
export { automationsReference } from './reference';
export {
  listAutomations,
  getAutomation,
  createAutomation,
  updateAutomation,
  archiveAutomation,
  duplicateAutomation,
  listAutomationTags,
} from './manage';
export { runAutomation, listRuns, getRun, cancelRunAction, retryRunAction } from './runs';
export type { AutomationView } from './shared';
