'use client';

import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import type { SVGProps } from 'react';

import { cn } from '../lib/utils';
import { useLinkComponent, type LinkComponentProps } from './kumo-context';
import { linkVariants, type KumoLinkVariant } from './link';

/**
 * Marks a link that opens in a new tab:
 * `<Link href="https://…" target="_blank" rel="noopener noreferrer">Visit <Link.ExternalIcon /></Link>`
 */
function ExternalIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M9 4H8.8C7.11984 4 6.27976 4 5.63803 4.32698C5.07354 4.6146 4.6146 5.07354 4.32698 5.63803C4 6.27976 4 7.11984 4 8.8V15.2C4 16.8802 4 17.7202 4.32698 18.362C4.6146 18.9265 5.07354 19.3854 5.63803 19.673C6.27976 20 7.11984 20 8.8 20H15.2C16.8802 20 17.7202 20 18.362 19.673C18.9265 19.3854 19.3854 18.9265 19.673 18.362C20 17.7202 20 16.8802 20 15.2V15" />
      <path d="M14 4H20M20 4V10M20 4L11 13" />
    </svg>
  );
}

export type LinkProps = useRender.ComponentProps<'a'> &
  LinkComponentProps & {
    /** inline (default, underlined), current (inherits colour) or plain (no underline). */
    variant?: KumoLinkVariant;
  };

/**
 * Kumo's inline text link. Renders through the app's `LinkProvider` (next/link),
 * or pass `render={<NextLink href="…" />}`. Presentational: routing lives in the provider.
 */
function LinkBase({ className, variant = 'inline', render, ref, ...props }: LinkProps) {
  const LinkComponent = useLinkComponent();
  return useRender({
    render: render ?? <LinkComponent />,
    ref,
    props: mergeProps<'a'>(
      {
        className: cn(
          linkVariants({ variant }),
          'group/link inline-flex items-center gap-[0.1875em] has-[>[data-slot=badge]]:rounded-full',
        ),
      } as useRender.ElementProps<'a'>,
      props,
      { className },
    ),
  });
}

export const Link = Object.assign(LinkBase, { ExternalIcon });
