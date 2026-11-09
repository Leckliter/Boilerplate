/**
 * OPTIONAL MODULES. Each module is one folder under packages/core/src/ (events + automations,
 * notifications, files, docs …) with a `register.ts` that calls `registerActions(...)` (and
 * `registerJob(...)`, `registerTick(...)`, `registerErrorAlerts(...)`) when imported. A line here
 * switches the module on; delete the line (and the folders) to remove it. This file is loaded by
 * the action registry, so a registered module's actions are available to REST, MCP and the
 * generated docs.
 *
 * To delete a module: its route folders in apps/web, its `register.ts` line below, its folders in
 * packages/core/src (and the `emit(`/`notify(` lines other actions call — grep for them), then
 * `pnpm typecheck && pnpm rules && pnpm test` (docs/architecture.md → Modules).
 */
import './automations/register'; // events + automations: emit(), automations.*, events.list
import './notifications/register'; // notify(), inbox, preferences, delivery log, email/SMS
import './files/register'; // S3 uploads: files.requestUpload / confirm / delete
import './inquiries/register'; // website contact form (public) + staff inbox
import './newsletter/register'; // newsletter sign-up with double opt-in
import './account-data/register'; // my data export + delete my account (grace period)
import './docs/register'; // in-app docs: docs.list / docs.get

export { registerTick, runModuleTicks, listTicks, type ModuleTick } from './module-ticks';
