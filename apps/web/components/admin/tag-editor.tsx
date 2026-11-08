'use client';

import type { ContactTag } from '@app/core';
import { Badge, tagColor } from '@app/ui/components/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { buttonVariants } from '@app/ui/components/button';
import { focusRing } from '@app/ui/components/link';
import { cn } from '@app/ui/lib/utils';
import { PlusIcon, XIcon } from '@app/ui/components/icons';

import { useAction } from '@/lib/use-action';

export type TagOption = { slug: string; label: string; kind: 'type' | 'label' };

export function TagEditor({
  contactId,
  tags,
  options,
  canEdit,
}: {
  contactId: string;
  tags: ContactTag[];
  options: TagOption[];
  canEdit: boolean;
}) {
  const { run, pending } = useAction();
  const available = options.filter((o) => !tags.some((t) => t.slug === o.slug));
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((t) => (
        <Badge key={t.slug} color={tagColor(t.color)} className="pr-1">
          {t.label}
          {canEdit && (
            <button
              type="button"
              aria-label={`Remove ${t.label}`}
              disabled={pending}
              onClick={() => run('contacts.removeTags', { id: contactId, tags: [t.slug] })}
              className={cn('opacity-60 hover:opacity-100 focus-visible:opacity-100', focusRing)}
            >
              <XIcon />
            </button>
          )}
        </Badge>
      ))}
      {tags.length === 0 && <span className="text-sm text-muted-foreground">No tags</span>}
      {canEdit && available.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: 'ghost', size: 'xs' })}>
            <PlusIcon /> Add tag
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {(['type', 'label'] as const).map((kind) =>
              available.some((o) => o.kind === kind) ? (
                <DropdownMenuGroup key={kind}>
                  <DropdownMenuLabel>
                    {kind === 'type' ? 'Contact type' : 'Labels'}
                  </DropdownMenuLabel>
                  {available
                    .filter((o) => o.kind === kind)
                    .map((o) => (
                      <DropdownMenuItem
                        key={o.slug}
                        onClick={() => run('contacts.addTags', { id: contactId, tags: [o.slug] })}
                      >
                        {o.label}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuGroup>
              ) : null,
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
