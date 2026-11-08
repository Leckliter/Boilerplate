'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  alert,
  confirm,
  prompt,
} from '@app/ui/components/alert-dialog';
import { Button } from '@app/ui/components/button';
import { toast } from '@app/ui/components/toaster';

/** AlertDialog on /brand: the promise helpers, and the parts composed by hand. */
export function AlertDialogDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="destructive"
        onClick={async () => {
          const ok = await confirm({
            title: 'Delete this note?',
            description: 'It stays in the change history.',
            confirmLabel: 'Delete note',
          });
          toast(ok ? 'Deleted (demo)' : 'Kept');
        }}
      >
        confirm()
      </Button>
      <Button
        onClick={async () => {
          const reason = await prompt({
            title: 'Cancel this order?',
            description: 'Anything reserved is released.',
            label: 'Reason (optional)',
            optional: true,
            confirmLabel: 'Cancel order',
            cancelLabel: 'Keep order',
          });
          toast(reason === null ? 'Kept' : `Cancelled: ${reason || 'no reason'}`);
        }}
      >
        prompt()
      </Button>
      <Button
        onClick={() =>
          void alert({ title: 'It didn’t run', description: 'The trigger event has no example.' })
        }
      >
        alert()
      </Button>
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="outline" />}>
          Composed by hand
        </AlertDialogTrigger>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Anything using it stops working at once.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction>Revoke key</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
