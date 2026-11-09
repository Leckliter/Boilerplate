import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { CheckCircleIcon, CircleIcon } from '@app/ui/components/icons';
import { Progress } from '@app/ui/components/progress';
import Link from 'next/link';

export type SetupStep = {
  id: string;
  title: string;
  text: string;
  done: boolean;
  href: string;
  cta: string;
};

/**
 * The owner's first-run checklist on the dashboard: each step is derived from real state (an
 * integration's variables, a saved setting, a second staff member), so it ticks itself and disappears
 * once everything is done. Rendered only for owners (the page decides).
 */
export function GettingStarted({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          {done} of {steps.length} done. Only owners see this; it goes away when everything is set
          up.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Progress label="Setup progress" value={(done / steps.length) * 100} />
        <ul className="grid gap-1">
          {steps.map((s) => (
            <li key={s.id}>
              <Link
                href={s.href}
                className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 outline-none hover:bg-tint focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.done ? (
                  <CheckCircleIcon weight="fill" className="mt-0.5 size-5 shrink-0 text-success" />
                ) : (
                  <CircleIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
                )}
                <span className="min-w-0 flex-1">
                  <span className={s.done ? 'text-muted-foreground line-through' : 'font-medium'}>
                    {s.title}
                  </span>
                  <span className="block text-sm text-muted-foreground">{s.text}</span>
                </span>
                {!s.done && (
                  <span className="shrink-0 text-sm font-medium text-primary underline-offset-4">
                    {s.cta}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
