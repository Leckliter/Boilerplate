import type { ContactTag } from '@app/core';
import { Badge, tagColor } from '@app/ui/components/badge';

export function TagBadges({ tags }: { tags: ContactTag[] }) {
  if (tags.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <Badge key={t.slug} color={tagColor(t.color)}>
          {t.label}
        </Badge>
      ))}
    </div>
  );
}
