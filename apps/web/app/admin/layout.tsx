import type { Metadata } from 'next';

import { ShellFor } from '@/components/layout/shell-for';
import { requireViewer } from '@/lib/viewer';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
};

/**
 * Longest any Admin page or server action may run, in seconds. These pages answer in well under a second,
 * so one that runs this long is stuck: stop it here rather than at the platform's 300 s default.
 */
export const maxDuration = 60;

/** Admin: roles with `admin.access`. Each page and action checks its own permission too. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer('admin.access', '/admin');
  return (
    <ShellFor appId="admin" viewer={viewer}>
      {children}
    </ShellFor>
  );
}
