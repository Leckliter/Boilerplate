/**
 * OPTIONAL MODULES. Each module is one folder under packages/core/src/ (events, automations,
 * notifications, files, …) with a `register.ts` that calls `registerActions(...)` (and
 * `registerJob(...)`, `registerErrorAlerts(...)`) when imported. Import it here to switch the
 * module on; delete the line (and the folder) to remove it. This file is loaded by the action
 * registry, so a registered module's actions are available to REST, MCP and the generated docs.
 *
 *   import './events/register';
 *   import './notifications/register';
 */
export {};
