import { NotFoundScreen } from '@/components/not-found-screen';

export const metadata = { title: 'Page not found' };

/** Any URL that matches nothing. Must stay free of cookies/headers: it is rendered with every page (see NotFoundScreen). */
export default function NotFound() {
  return <NotFoundScreen />;
}
