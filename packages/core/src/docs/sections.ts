import type { DocSection } from './types';

/**
 * The sections of /docs, in display order. Each is a folder in apps/web/content/docs. A section
 * shows up for a reader when it holds at least one doc they may read, so a section can mix public
 * and internal docs. Add your own (and a folder) when the docs grow.
 */
export const DOC_SECTIONS: readonly DocSection[] = [
  {
    id: 'start',
    title: 'Getting started',
    description: 'What this is and how to find your way around.',
  },
  {
    id: 'handbook',
    title: 'Handbook',
    description: 'How the app works and how these docs work.',
  },
  {
    id: 'internal',
    title: 'Staff runbooks',
    description: 'For staff and AI tools: errors, brand rules and how to run things.',
  },
];
