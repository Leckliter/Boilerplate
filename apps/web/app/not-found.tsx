import { LinkButton } from '@app/ui/components/link-button';
import { MagnifyingGlassIcon } from '@app/ui/components/icons';
import { getTranslations } from 'next-intl/server';

export const metadata = { title: 'Page not found' };

export default async function NotFound() {
  const t = await getTranslations('errors');
  return (
    <main
      id="main-content"
      className="mx-auto grid max-w-md justify-items-start gap-4 px-4 py-24 text-sm"
    >
      <MagnifyingGlassIcon className="size-6 text-muted-foreground" />
      <h1 className="text-xl font-semibold">{t('notFoundTitle')}</h1>
      <p className="text-muted-foreground">{t('notFoundBody')}</p>
      <LinkButton href="/" variant="primary">
        {t('home')}
      </LinkButton>
    </main>
  );
}
