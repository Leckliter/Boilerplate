import { Prose } from '@app/ui/components/prose';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms' };

/** Placeholder: have a lawyer write yours. */
export default function Page() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Terms of service</h1>
      <Prose className="mt-6">
        <p>This is a placeholder. Replace it with your own text before you launch.</p>
      </Prose>
    </div>
  );
}
