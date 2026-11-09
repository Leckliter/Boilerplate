import { PageLoading } from '@app/ui/components/page-skeleton';

export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <PageLoading variant="record" rows={1} />
    </div>
  );
}
