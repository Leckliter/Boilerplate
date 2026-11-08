import { Callout } from '@app/ui/components/callout';
import { ErrorReference } from '@app/ui/components/copy-button';
import { WarningIcon } from '@app/ui/components/icons';

/**
 * A server action that came back `{ ok: false }`, shown in place of the data it should have loaded.
 * Keeps the page's header and layout; shows the reference when it is a bug (so it can be passed on),
 * just the message when it is a "no".
 */
export function ActionError({
  error,
  what,
}: {
  error: { message: string; ref?: string | null };
  /** What didn't load, e.g. "the contacts". */
  what?: string;
}) {
  return (
    <Callout tone="danger" className="grid gap-2">
      <span className="flex items-start gap-2">
        <WarningIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          {what ? `Couldn’t load ${what}. ` : ''}
          {error.message}
        </span>
      </span>
      {error.ref && <ErrorReference reference={error.ref} />}
    </Callout>
  );
}
