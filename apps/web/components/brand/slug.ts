/** "Badges & tag colours" → "badges-tag-colours": the anchor id of a section title. */
export function slug(title: string): string {
  return title
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
