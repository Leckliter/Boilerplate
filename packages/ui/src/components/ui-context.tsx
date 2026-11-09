'use client';

/**
 * The small context providers our components read:
 *  - LinkProvider: which component renders links (mount with next/link once, in the root layout).
 *  - PortalProvider: where popups render (default: document.body).
 *  - LocaleProvider: words the components say themselves ("Close", "(optional)").
 *  - TimeZoneProvider: the app's IANA time zone for client components (see lib/dates.ts).
 */
import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  type AnchorHTMLAttributes,
  type ForwardRefExoticComponent,
  type ReactNode,
  type RefAttributes,
  type RefObject,
} from 'react';

import {
  formatDate,
  formatDateTime,
  formatTime,
  formatWeekdayTime,
  formatWhen,
  getAppTimeZone,
  todayInAppZone,
} from '../lib/dates';

/* ── Links ─────────────────────────────────────────────────────────── */

export type LinkComponentProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to?: string };

const DefaultLinkComponent = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  function DefaultAnchor({ to, href, ...rest }, ref) {
    // Children arrive through ...rest.
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    return <a ref={ref} href={href ?? to ?? undefined} {...rest} />;
  },
);

type ForwardLinkComponent = ForwardRefExoticComponent<
  LinkComponentProps & RefAttributes<HTMLAnchorElement>
>;

const LinkComponentContext = createContext<ForwardLinkComponent>(DefaultLinkComponent);

/** The component to render a link with (a plain <a> unless a LinkProvider says otherwise). */
export function useLinkComponent() {
  return useContext(LinkComponentContext);
}

export function LinkProvider({
  component,
  children,
}: {
  component?: ForwardLinkComponent;
  children: ReactNode;
}) {
  return (
    <LinkComponentContext.Provider value={component ?? DefaultLinkComponent}>
      {children}
    </LinkComponentContext.Provider>
  );
}

/* ── Portals ───────────────────────────────────────────────────────── */

export type PortalContainer =
  HTMLElement | ShadowRoot | null | RefObject<HTMLElement | ShadowRoot | null>;

const PortalContainerContext = createContext<PortalContainer>(null);

export function PortalProvider({
  container,
  children,
}: {
  container: PortalContainer;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>
  );
}

export function usePortalContainer(): PortalContainer {
  return useContext(PortalContainerContext);
}

/* ── Time zone ─────────────────────────────────────────────────────── */

const TimeZoneContext = createContext<string | null>(null);

/**
 * Tells client components which IANA time zone to show dates in. Mount it once in the root layout
 * with the server's zone (`getAppTimeZone()`), otherwise the browser's formatters would use the
 * module default (`America/Chicago`) and could disagree with what the server rendered.
 */
export function TimeZoneProvider({ zone, children }: { zone: string; children: ReactNode }) {
  return <TimeZoneContext.Provider value={zone}>{children}</TimeZoneContext.Provider>;
}

/** The zone to format dates in: the provider's, else the app default from lib/dates. */
export function useAppTimeZone(): string {
  return useContext(TimeZoneContext) ?? getAppTimeZone();
}

/** The date formatters bound to the current zone: `const { formatDate } = useDates()`. */
export function useDates() {
  const zone = useAppTimeZone();
  return useMemo(
    () => ({
      zone,
      formatDate: (d: Parameters<typeof formatDate>[0]) => formatDate(d, zone),
      formatDateTime: (d: Parameters<typeof formatDateTime>[0]) => formatDateTime(d, zone),
      formatWhen: (d: Parameters<typeof formatWhen>[0]) => formatWhen(d, zone),
      formatTime: (d: Parameters<typeof formatTime>[0]) => formatTime(d, zone),
      formatWeekdayTime: (d: Parameters<typeof formatWeekdayTime>[0]) => formatWeekdayTime(d, zone),
      todayInAppZone: () => todayInAppZone(new Date(), zone),
    }),
    [zone],
  );
}

/* ── Words ─────────────────────────────────────────────────────────── */

export interface Translations {
  label?: { optional: string; tooltip: string };
  layerDialog: { close: string; cancel: string };
}

export type TranslationsPartial = {
  [Key in keyof Translations]?: Partial<NonNullable<Translations[Key]>>;
};

type ResolvedTranslations = { [Key in keyof Translations]-?: NonNullable<Translations[Key]> };

const defaultTranslations: ResolvedTranslations = {
  label: { optional: '(optional)', tooltip: 'More information' },
  layerDialog: { close: 'Close', cancel: 'Cancel' },
};

const LocaleContext = createContext<ResolvedTranslations>(defaultTranslations);

export function LocaleProvider({
  children,
  translations,
}: {
  children: ReactNode;
  translations?: TranslationsPartial;
}) {
  const value = useMemo<ResolvedTranslations>(
    () => ({
      label: { ...defaultTranslations.label, ...translations?.label },
      layerDialog: { ...defaultTranslations.layerDialog, ...translations?.layerDialog },
    }),
    [translations],
  );
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): ResolvedTranslations {
  return useContext(LocaleContext);
}
