'use client';

/**
 * The three small context providers Kumo components read (cloudflare/kumo, MIT):
 *  - LinkProvider: which component renders links (mount with next/link once, in the root layout).
 *  - PortalProvider: where popups render (default: document.body).
 *  - LocaleProvider: words the components say themselves ("Close", "(optional)").
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
