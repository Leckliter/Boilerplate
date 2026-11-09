/**
 * Switches the in-app docs module on (imported from packages/core/src/modules.ts): `docs.list` and
 * `docs.get`. Delete this folder, `actions/docs`, `scripts/build-docs.ts`, apps/web `content/` and
 * the /docs routes, and the line in modules.ts to remove it (docs/docs-system.md).
 */
import { registerActions } from '../actions/registry-store';
import { getDoc, listDocs } from '../actions/docs';
import { registerSearchProvider } from '../actions/search/providers';
import { searchDocsProvider } from './search';

registerActions(listDocs, getDoc);

// ⌘K search: docs (visibility follows docs.list).
registerSearchProvider('docs', searchDocsProvider, { order: 20 });
