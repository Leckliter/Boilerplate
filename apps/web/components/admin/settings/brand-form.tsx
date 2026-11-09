'use client';

import { Button } from '@app/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@app/ui/components/card';
import { CodeBlock } from '@app/ui/components/code-block';
import { Input } from '@app/ui/components/input';
import { Field } from '@app/ui/components/label';
import { toast } from '@app/ui/components/toaster';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BRAND_STEPS, brandRamp, HEX, rampCss, rampStyle } from '@/lib/brand-ramp';
import { BRAND_COLOR_KEY, BRAND_NAME_KEY } from '@/lib/settings-keys';
import { useAction } from '@/lib/use-action';

// rules-ok: no-raw-colour — the starting value of the colour picker, replaced by the owner's saved choice
const DEFAULT_COLOR = '#5b5bd6';

/**
 * Settings → General: the app's name and brand colour, saved as the settings `brand.name` and
 * `brand.color` (the team and the getting-started checklist read them). The colour is previewed live on a
 * sample card and turned into the ten-step ramp; the CSS is shown ready to paste into
 * packages/ui/src/styles/globals.css, because the theme is compiled in, not read at runtime.
 */
export function BrandForm({
  name,
  color,
  canEdit,
}: {
  name: string;
  color: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [appName, setAppName] = useState(name);
  const [hex, setHex] = useState(color ?? DEFAULT_COLOR);
  const ramp = brandRamp(hex);
  const dirty = appName !== name || hex !== (color ?? DEFAULT_COLOR);

  async function save() {
    if (appName.trim() && appName !== name) {
      const res = await run(
        'settings.set',
        { key: BRAND_NAME_KEY, value: appName.trim() },
        { refresh: false },
      );
      if (!res.ok) return;
    }
    if (ramp && hex !== color) {
      const res = await run(
        'settings.set',
        { key: BRAND_COLOR_KEY, value: hex },
        { refresh: false },
      );
      if (!res.ok) return;
    }
    toast.success('Saved');
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Name and colour</CardTitle>
          <CardDescription>
            Saved as settings for your team. The theme itself is compiled in, so apply the colour
            with the CSS on the right.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Field
            label="App name"
            hint="Shown in the header, emails and the browser tab (APP_NAME / lib/site.ts)."
          >
            <Input
              value={appName}
              maxLength={60}
              disabled={!canEdit}
              onChange={(e) => setAppName(e.target.value)}
            />
          </Field>
          <Field
            label="Brand colour"
            hint="Pick a colour, or type a hex like the one shown."
            error={ramp ? undefined : 'Use a 6-digit hex colour.'}
          >
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Pick the brand colour"
                value={HEX.test(hex) ? hex : DEFAULT_COLOR}
                disabled={!canEdit}
                onChange={(e) => setHex(e.target.value)}
                className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-card p-0.5"
              />
              <Input
                value={hex}
                maxLength={7}
                spellCheck={false}
                disabled={!canEdit}
                onChange={(e) => setHex(e.target.value.trim())}
                className="font-mono"
              />
            </div>
          </Field>
          {canEdit && (
            <div>
              <Button
                variant="primary"
                loading={pending}
                disabled={!dirty || !ramp || !appName.trim()}
                onClick={save}
              >
                Save
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            The ramp this colour makes, on a sample of the app’s controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {ramp ? (
            <div
              style={rampStyle(ramp)}
              className="grid gap-4 rounded-lg bg-background p-4 ring ring-border"
            >
              <div
                className="flex overflow-hidden rounded-md"
                role="img"
                aria-label="The ten brand steps, light to dark"
              >
                {BRAND_STEPS.map((s) => (
                  <span
                    key={s}
                    className="h-8 flex-1"
                    style={{ background: `var(--brand-${s})` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="primary">{appName || 'Primary'}</Button>
                <Button>Secondary</Button>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                  Badge
                </span>
                <a
                  href="#preview"
                  onClick={(e) => e.preventDefault()}
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  A link
                </a>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Enter a valid colour to see it.</p>
          )}
          {ramp && (
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">
                Paste into globals.css (replace the --brand-* lines)
              </p>
              <CodeBlock copy={rampCss(ramp)}>{rampCss(ramp)}</CodeBlock>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
