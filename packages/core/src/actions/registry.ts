// Order matters only for the generated docs: core actions first, then optional modules.
import './catalog';
import '../modules';

export { getAction, listActions, registerActions } from './registry-store';
