'use client';

import { AvatarUpload } from '@app/ui/components/avatar-upload';
import { Button } from '@app/ui/components/button';
import { ConfirmButton } from '@app/ui/components/confirm-button';
import { FileDrop } from '@app/ui/components/file-drop';
import { InlineEdit } from '@app/ui/components/inline-edit';
import { Kbd, KbdGroup } from '@app/ui/components/kbd';
import { LanguageSelect } from '@app/ui/components/language-select';
import { MobileActionBar, PageActions } from '@app/ui/components/page-actions';
import { SearchInput } from '@app/ui/components/search-input';
import { ThemeToggle, type ThemeValue } from '@app/ui/components/theme-toggle';
import { toast } from '@app/ui/components/toaster';
import { PlusIcon } from '@app/ui/components/icons';
import { useState } from 'react';

function Block({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-3">
      <h3 className="text-base font-semibold">{title}</h3>
      {note && <p className="text-sm text-muted-foreground">{note}</p>}
      {children}
    </div>
  );
}

function DropDemo() {
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [progress, setProgress] = useState<number | undefined>();
  const run = (fail: boolean) => {
    setStatus('uploading');
    setProgress(0);
    let p = 0;
    const t = setInterval(() => {
      p += 20;
      setProgress(p);
      if (p >= 100) {
        clearInterval(t);
        setStatus(fail ? 'error' : 'success');
      }
    }, 300);
  };
  return (
    <div className="grid max-w-md gap-3">
      <FileDrop
        onFiles={() => run(false)}
        status={status}
        progress={progress}
        accept="image/*"
        hint="PNG or JPG, up to 5 MB"
        message={
          status === 'success'
            ? 'Uploaded.'
            : status === 'error'
              ? 'Upload failed. Check your connection and try again.'
              : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        {(['idle', 'uploading', 'success', 'error'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'primary' : 'secondary'}
            onClick={() => (setStatus(s), setProgress(s === 'uploading' ? 40 : undefined))}
          >
            {s}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => run(true)}>
          Simulate failure
        </Button>
      </div>
    </div>
  );
}

export function InputDemos() {
  const [q, setQ] = useState('');
  const [theme, setTheme] = useState<ThemeValue>('system');
  const [lang, setLang] = useState('en');
  const [name, setName] = useState('Spring launch');
  const [file, setFile] = useState<string>('none chosen');
  return (
    <div className="grid gap-12">
      <Block
        title="SearchInput"
        note="Clear button, Escape clears, type=search for the phone keyboard."
      >
        <div className="max-w-sm">
          <SearchInput
            aria-label="Search the demo"
            placeholder="Search customers"
            value={q}
            onValueChange={setQ}
          />
        </div>
      </Block>
      <Block
        title="InlineEdit"
        note="Click the value; Enter saves, Escape cancels. A thrown error stays visible (try “bad”)."
      >
        <InlineEdit
          label="Campaign name"
          value={name}
          onSave={async (v) => {
            await new Promise((r) => setTimeout(r, 400));
            if (v.toLowerCase() === 'bad') throw new Error('That name is reserved.');
            setName(v);
            toast.success('Saved');
          }}
        />
      </Block>
      <Block
        title="AvatarUpload"
        note="Validates in the browser and hands the File to onChange; it never uploads."
      >
        <AvatarUpload
          name="Ada Lovelace"
          onChange={(f) => setFile(f ? `${f.name} (${f.size} bytes)` : 'removed')}
        />
        <p className="text-xs text-muted-foreground">onChange received: {file}</p>
      </Block>
      <Block
        title="DropZone states"
        note="FileDrop with idle / uploading / success / error, set by the caller."
      >
        <DropDemo />
      </Block>
      <Block title="ConfirmButton" note="Asks first with the app's confirm dialog.">
        <div className="flex flex-wrap gap-2">
          <ConfirmButton
            title="Delete this note?"
            description="This cannot be undone."
            confirmLabel="Delete note"
            onConfirm={() => void toast.success('Deleted')}
          >
            Delete note
          </ConfirmButton>
          <ConfirmButton
            tone="primary"
            title="Send the reminder now?"
            confirmLabel="Send reminder"
            onConfirm={() => void toast.success('Sent')}
          >
            Send reminder
          </ConfirmButton>
        </div>
      </Block>
      <Block
        title="ThemeToggle and LanguageSelect"
        note="Presentational: they show a value and call onChange; the app does the switching."
      >
        <div className="flex flex-wrap items-center gap-4">
          <ThemeToggle value={theme} onChange={setTheme} />
          <LanguageSelect
            value={lang}
            onChange={setLang}
            languages={[
              { code: 'en', label: 'English' },
              { code: 'es', label: 'Español' },
              { code: 'fr', label: 'Français' },
            ]}
          />
        </div>
      </Block>
      <Block title="Kbd">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          Press <KbdGroup keys={['⌘', 'K']} /> or <KbdGroup keys={['Ctrl', 'K']} /> to open the
          command palette, <Kbd>Esc</Kbd> to close.
        </p>
      </Block>
      <Block
        title="PageActions and MobileActionBar"
        note="PageActions wrap on a phone. MobileActionBar pins to the bottom edge below 768px; here it is shown inline so it does not cover the page."
      >
        <PageActions>
          <Button>Cancel</Button>
          <Button variant="primary">
            <PlusIcon /> New item
          </Button>
        </PageActions>
        <div className="rounded-lg border border-dashed border-border p-3">
          <p className="mb-2 text-xs text-muted-foreground">MobileActionBar (static preview):</p>
          <div className="[&>[data-slot=mobile-action-bar]]:static [&>[data-slot=mobile-action-bar]]:border-0 [&>[data-slot=mobile-action-bar]]:bg-transparent [&>[data-slot=mobile-action-bar]]:p-0 [&>div:first-child]:hidden">
            <MobileActionBar>
              <Button variant="ghost">Discard</Button>
              <Button variant="primary">Save changes</Button>
            </MobileActionBar>
          </div>
        </div>
      </Block>
    </div>
  );
}
