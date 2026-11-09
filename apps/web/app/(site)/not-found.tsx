import { NotFoundScreen } from '@/components/not-found-screen';

export const metadata = { title: 'Page not found' };

/** A missing public page (e.g. an unknown doc), inside the site's header and footer. */
export default function SiteNotFound() {
  return <NotFoundScreen />;
}
