import type { Metadata } from 'next';

import { ShellFor } from '@/components/layout/shell-for';
import { requireViewer } from '@/lib/viewer';

export const metadata: Metadata = {
  title: { default: 'My account', template: '%s · My account' },
};

/** The customer portal: anyone with a login (staff included). */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer(undefined, '/account');
  return (
    <ShellFor appId="account" viewer={viewer}>
      {children}
    </ShellFor>
  );
}
