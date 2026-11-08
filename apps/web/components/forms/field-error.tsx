import { ErrorReference } from '@app/ui/components/copy-button';
import { WarningIcon } from '@app/ui/components/icons';

/** A form-level failure: what went wrong and, for a bug, the reference to pass on (with a copy button). */
export function FormError({ message, reference }: { message: string; reference?: string | null }) {
  return (
    <div
      role="alert"
      className="grid gap-2 rounded-lg bg-destructive-tint px-3 py-2 text-sm text-destructive"
    >
      <p className="flex items-start gap-2">
        <WarningIcon className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0 whitespace-pre-line">{message}</span>
      </p>
      {reference && <ErrorReference reference={reference} />}
    </div>
  );
}

/** First message for a field from an action's `fieldErrors` (zod flattened), or undefined. */
export function fieldError(
  fieldErrors: Record<string, string[] | undefined> | undefined,
  name: string,
): string | undefined {
  return fieldErrors?.[name]?.[0];
}
