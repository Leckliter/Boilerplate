import { Empty } from '@app/ui/components/empty';
import { BookOpenIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';

export default function DocNotFound() {
  return (
    <Empty
      icon={<BookOpenIcon />}
      title="No such doc"
      description="It may have moved, or it may be for staff only."
      contents={<LinkButton href="/docs">All docs</LinkButton>}
    />
  );
}
