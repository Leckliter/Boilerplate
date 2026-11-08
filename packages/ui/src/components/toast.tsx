'use client';

import {
  Toast,
  type ToastManagerAddOptions,
  type ToastManagerUpdateOptions,
  type ToastObject,
} from '@base-ui/react/toast';
import type React from 'react';

import { cn } from '../lib/utils';
import { Button, type ButtonProps } from './button';
import { CheckCircleIcon, InfoIcon, WarningIcon, WarningOctagonIcon, XIcon } from './icons';
import { usePortalContainer, type PortalContainer } from './ui-context';

/*
 * Toast, on Base UI's toast: stacked bottom-right, swipe to dismiss,
 * expand on hover. Most code just calls `toast.success('Saved')` from `./toaster`;
 * use this file's `Toasty` / `useUiToastManager` when you need the full manager API.
 */

type UiToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

const VARIANT_CLASSES: Record<UiToastVariant, string> = {
  default: 'border-fill bg-card',
  success:
    'ring-[0.3px] ring-success bg-card [&_[data-toast-icon]]:text-success [&_[data-toast-title]]:text-success',
  error:
    'ring-[0.3px] ring-destructive bg-card [&_[data-toast-icon]]:text-destructive [&_[data-toast-title]]:text-destructive',
  warning:
    'ring-[0.3px] ring-warning bg-card [&_[data-toast-icon]]:text-warning [&_[data-toast-title]]:text-warning',
  info: 'ring-[0.3px] ring-info bg-control [&_[data-toast-icon]]:text-info [&_[data-toast-title]]:text-info',
};

const VARIANT_ICONS = {
  success: CheckCircleIcon,
  error: WarningOctagonIcon,
  warning: WarningIcon,
  info: InfoIcon,
} as const;

/** The classes of a toast surface. */
function toastVariants({ variant = 'default' }: { variant?: UiToastVariant } = {}) {
  return cn(
    'rounded-xl bg-clip-padding p-4 shadow-lg ring ring-border',
    VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default,
  );
}

type UiToastOptionsBase = {
  variant?: UiToastVariant;
  content?: React.ReactNode;
  actions?: Array<ButtonProps>;
  /** Wiggle the toast when it is updated or re-added. Default: automatic. */
  bump?: boolean;
};

// Set by every `add()` and cleared by `update()` and promise results. `ToastList` only bumps
// when this is set and `updateKey > 0`, because Base UI increments `updateKey` for duplicate
// adds and explicit updates alike.
const AUTO_BUMP = Symbol('toast-auto-bump');
type InternalOptions = { [AUTO_BUMP]?: boolean };

type UiToastOptions<Data extends object> = ToastObject<Data> & UiToastOptionsBase;
type UiToastManagerAddOptions<Data extends object> = ToastManagerAddOptions<Data> &
  UiToastOptionsBase;
type UiToastManagerUpdateOptions<Data extends object> = ToastManagerUpdateOptions<Data> &
  UiToastOptionsBase;

function withBumpIntent<T extends UiToastOptionsBase>(options: T, autoBump: boolean) {
  return {
    ...options,
    // Keep `bump` operation-scoped instead of inheriting a previous value through a partial update.
    bump: options.bump,
    [AUTO_BUMP]: autoBump,
  } as T & InternalOptions;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Base UI's manager is generic over `any` data */
function wrapManagerMethods<
  T extends {
    add: (...a: any[]) => any;
    update: (...a: any[]) => any;
    promise: (...a: any[]) => any;
    toasts?: Array<ToastObject<any>>;
  },
>(manager: T) {
  return {
    ...manager,

    add: (options: UiToastManagerAddOptions<any>) => {
      const existing = options.id ? manager.toasts?.find((t) => t.id === options.id) : undefined;
      if (existing) {
        // Bump the visible toast instead of replacing it, and let an exiting toast finish.
        if (existing.transitionStatus !== 'ending') {
          const bump: UiToastManagerUpdateOptions<any> =
            options.timeout !== undefined ? { timeout: options.timeout } : {};
          manager.update(existing.id, withBumpIntent(bump, true));
        }
        return existing.id;
      }
      return manager.add(withBumpIntent(options, true));
    },

    update: (
      id: string,
      options:
        | UiToastManagerUpdateOptions<any>
        | ((prev: UiToastOptions<any>) => UiToastManagerUpdateOptions<any>),
    ) =>
      manager.update(
        id,
        typeof options === 'function'
          ? (prev: ToastObject<any>) => withBumpIntent(options(prev), false)
          : withBumpIntent(options, false),
      ),

    promise: <P,>(
      promise: Promise<P>,
      options: {
        loading: UiToastManagerAddOptions<any>;
        success: UiToastManagerAddOptions<any> | ((data: P) => UiToastManagerAddOptions<any>);
        error: UiToastManagerAddOptions<any> | ((error: Error) => UiToastManagerAddOptions<any>);
      },
    ) =>
      manager.promise(promise, {
        loading: withBumpIntent(options.loading, false),
        success:
          typeof options.success === 'function'
            ? (data: P) =>
                withBumpIntent(
                  (options.success as (d: P) => UiToastManagerAddOptions<any>)(data),
                  false,
                )
            : withBumpIntent(options.success, false),
        error:
          typeof options.error === 'function'
            ? (error: Error) =>
                withBumpIntent(
                  (options.error as (e: Error) => UiToastManagerAddOptions<any>)(error),
                  false,
                )
            : withBumpIntent(options.error, false),
      }),
  };
}

/** The toast manager for components: `const toasts = useUiToastManager(); toasts.add({ title })`. */
const useUiToastManager = () => {
  const manager = Toast.useToastManager();
  return {
    ...wrapManagerMethods(manager),
    toasts: manager.toasts as Array<UiToastOptions<any>>,
  };
};

/** A manager you can call from outside React (timers, callbacks); pass it to `<Toasty toastManager>`. */
const createUiToastManager = () => wrapManagerMethods(Toast.createToastManager());
/* eslint-enable @typescript-eslint/no-explicit-any */

interface ToastyProps {
  /** Application content. Toasts render via a portal above this. */
  children?: React.ReactNode;
  /** Where toasts render (default: `PortalProvider`'s container, else `document.body`). */
  container?: PortalContainer;
  /** A manager from `createUiToastManager()`, so code outside React can show toasts. */
  toastManager?: ReturnType<typeof createUiToastManager>;
}

/** Toast provider and viewport (bottom-right). Mount once; `Toaster` in `./toaster` does it for the app. */
function Toasty({ children, container: containerProp, toastManager }: ToastyProps) {
  const contextContainer = usePortalContainer();
  const container = containerProp ?? contextContainer ?? undefined;
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <Toast.Portal container={container}>
        <Toast.Viewport className="fixed top-auto right-4 bottom-4 z-100 mx-auto flex w-[calc(100%-2rem)] sm:right-8 sm:bottom-8 sm:w-[340px]">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function getBumpAnimation(toast: UiToastOptions<object>) {
  const updateKey = toast.updateKey ?? 0;
  const internal = toast as UiToastOptions<object> & InternalOptions;
  const shouldBump =
    toast.bump === true || (toast.bump !== false && internal[AUTO_BUMP] === true && updateKey > 0);
  // Alternate between two identical animations so each bump replays. No remount with
  // `key={updateKey}`: that would drop focus from a focused action or close button.
  return (
    shouldBump && (updateKey % 2 === 0 ? 'animate-toast-bump-alternate' : 'animate-toast-bump')
  );
}

// The root owns the slide transition and the inner surface owns the bump,
// so a bump never cancels an in-progress slide-in.
function ToastList() {
  const { toasts } = useUiToastManager();
  return toasts.map((toast) => (
    <Toast.Root
      key={toast.id}
      toast={toast}
      className={cn(
        'absolute right-0 bottom-0 left-auto z-[calc(1000-var(--toast-index))] mr-0 h-(--height) w-full origin-bottom rounded-xl select-none motion-reduce:[transition-property:opacity]',
        '[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]',
        '[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_0.5s_cubic-bezier(0.22,1,0.36,1),opacity_0.5s,height_0.15s]',
        "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
        'data-ending-style:opacity-0 data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--offset-y)))] data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]',
        'data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))] data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
        'data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))] data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]',
        'data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))] data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
        '[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]',
      )}
    >
      <div
        data-slot="toast"
        className={cn(
          'relative h-full w-full',
          toastVariants({ variant: toast.variant }),
          getBumpAnimation(toast),
        )}
      >
        <ToastBackground variant={toast.variant} />
        <Toast.Content className="isolate flex flex-col gap-1 transition-opacity duration-250 data-behind:pointer-events-none data-behind:opacity-0 data-expanded:pointer-events-auto data-expanded:opacity-100">
          {toast.content ?? (
            <div className="flex items-start gap-2 pr-5">
              <ToastIcon variant={toast.variant} />
              <div className="flex min-w-0 flex-col gap-1 overflow-hidden">
                <Toast.Title
                  data-toast-title
                  className="text-[0.975rem] leading-5 font-medium text-foreground"
                />
                <Toast.Description className="text-[0.925rem] leading-5 text-foreground/70" />
                {!!toast.actions && (
                  <div className="mt-2 flex min-w-0 flex-nowrap gap-2 overflow-x-auto p-px">
                    {toast.actions.map((actionProps, idx) => (
                      <Button key={idx} {...actionProps} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <Toast.Close
            aria-label="Close"
            className={cn(
              'absolute top-0 right-0 flex size-5 items-center justify-center rounded text-muted-foreground transition-colors outline-none hover:bg-current/15 focus-visible:ring-[1.5px] focus-visible:ring-ring',
              toast.variant && toast.variant !== 'default' && CLOSE_CLASSES[toast.variant],
            )}
          >
            <XIcon className="size-3" />
          </Toast.Close>
        </Toast.Content>
      </div>
    </Toast.Root>
  ));
}

const CLOSE_CLASSES: Record<Exclude<UiToastVariant, 'default'>, string> = {
  success: 'text-success',
  error: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
};

const BACKGROUND_CLASSES: Record<Exclude<UiToastVariant, 'default'>, string> = {
  success: 'bg-success-tint/20',
  error: 'bg-destructive-tint/50',
  warning: 'bg-warning-tint/50',
  info: 'bg-info-tint/50',
};

function ToastBackground({ variant }: { variant?: UiToastVariant }) {
  const background = variant && variant !== 'default' ? BACKGROUND_CLASSES[variant] : undefined;
  return <div className={cn('absolute inset-0 rounded-xl bg-card/90', background)} />;
}

function ToastIcon({ variant }: { variant?: UiToastVariant }) {
  if (!variant || variant === 'default') return null;
  const Icon = VARIANT_ICONS[variant];
  return <Icon data-toast-icon className="mt-0.5 size-4 shrink-0" weight="fill" />;
}

export type {
  UiToastManagerAddOptions,
  UiToastManagerUpdateOptions,
  UiToastOptions,
  UiToastVariant,
  ToastyProps,
};
export { createUiToastManager, Toasty, Toasty as ToastProvider, toastVariants, useUiToastManager };
