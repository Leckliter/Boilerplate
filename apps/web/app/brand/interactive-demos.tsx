'use client';

import { Button } from '@app/ui/components/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@app/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@app/ui/components/dropdown-menu';
import { TabbedPanels } from '@app/ui/components/tabs';
import { toast } from '@app/ui/components/toaster';
import { Tooltip } from '@app/ui/components/tooltip';
import { ArchiveIcon, CaretDownIcon, PencilIcon, TrashIcon } from '@app/ui/components/icons';
import { useState } from 'react';

export function InteractiveDemos() {
  const [view, setView] = useState('list');
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Dialog>
          <DialogTrigger render={<Button />}>Open dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Archive contact?</DialogTitle>
              <DialogDescription>
                They’ll be hidden from lists. You can restore them any time.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
              <DialogClose render={<Button variant="primary" />}>Archive</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button />}>
            Actions <CaretDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuGroup>
              <DropdownMenuLabel>Contact</DropdownMenuLabel>
              <DropdownMenuItem>
                <PencilIcon /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem>
                <ArchiveIcon /> Archive
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <TrashIcon /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button />}>
            View <CaretDownIcon />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup value={view} onValueChange={setView}>
              <DropdownMenuLabel>Show as</DropdownMenuLabel>
              <DropdownMenuRadioItem value="list">List</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="cards">Cards</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip content="Tooltips explain icon-only buttons">
          <Button variant="ghost">Hover me</Button>
        </Tooltip>

        <Button onClick={() => toast.success('Contact saved')}>Show toast</Button>
      </div>

      <TabbedPanels
        defaultValue="details"
        panels={[
          {
            value: 'details',
            label: 'Details',
            content: <p className="text-sm text-muted-foreground">Details panel</p>,
          },
          {
            value: 'projects',
            label: 'Projects',
            content: <p className="text-sm text-muted-foreground">Projects panel</p>,
          },
          {
            value: 'history',
            label: 'History',
            content: <p className="text-sm text-muted-foreground">History panel</p>,
          },
        ]}
      />
    </div>
  );
}
