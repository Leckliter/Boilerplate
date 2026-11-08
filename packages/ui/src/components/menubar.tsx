'use client';

import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

import { cn } from '../lib/utils';
import { Tooltip } from './tooltip';

/** Arrow-key roaming focus inside a horizontal or vertical group of controls. */
function useMenuNavigation({
  menuRef,
  direction = 'horizontal',
}: {
  menuRef: RefObject<HTMLElement | null>;
  direction?: 'horizontal' | 'vertical';
}) {
  const activeElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;

    const focusable = Array.from(
      menu.querySelectorAll(
        'a, button, input, textarea, select, details, [tabindex]:not([tabindex="-1"])',
      ),
    ) as HTMLElement[];
    if (focusable.length === 0) return;

    const forwardKey = direction === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
    const backwardKey = direction === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';

    const onKeyDown = (e: KeyboardEvent) => {
      if (!activeElementRef.current) return;
      const current = focusable.indexOf(activeElementRef.current);
      let next = current;
      if (e.key === forwardKey) next = (current + 1) % focusable.length;
      else if (e.key === backwardKey) next = (current - 1 + focusable.length) % focusable.length;
      else return;
      e.preventDefault();
      const target = focusable[next];
      if (!target) return;
      activeElementRef.current = target;
      target.focus();
    };
    const onFocusIn = () => {
      activeElementRef.current = document.activeElement as HTMLElement;
      document.addEventListener('keydown', onKeyDown);
    };
    const onFocusOut = () => {
      activeElementRef.current = null;
      document.removeEventListener('keydown', onKeyDown);
    };

    menu.addEventListener('focusin', onFocusIn);
    menu.addEventListener('focusout', onFocusOut);
    return () => {
      menu.removeEventListener('focusin', onFocusIn);
      menu.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuRef, direction]);
}

export type MenuOptionProps = {
  /** Icon element, rendered at 18px. */
  icon: ReactNode;
  /** Unique identifier (matched against `isActive` when `optionIds` is set). */
  id?: number | string;
  isActive?: number | boolean | string | undefined;
  onClick: () => void;
  /** Tooltip and accessible name. */
  tooltip: string;
};

function MenuOption({ icon, id, isActive, onClick, tooltip }: MenuOptionProps) {
  return (
    <Tooltip content={tooltip}>
      <button
        type="button"
        data-slot="menubar-option"
        aria-label={tooltip}
        aria-pressed={isActive === id}
        className={cn(
          'relative -ml-px flex h-full w-11 cursor-pointer items-center justify-center rounded-md border-none bg-recessed transition-colors first:rounded-l-lg last:rounded-r-lg focus:z-3 focus:ring-ring/50 focus:outline-hidden focus-visible:z-3 focus-visible:ring-2 focus-visible:ring-primary [&_svg]:size-[18px]',
          { 'z-2 bg-card shadow-xs transition-colors': isActive === id },
        )}
        onClick={onClick}
      >
        {icon}
      </button>
    </Tooltip>
  );
}

export type MenuBarProps = {
  className?: string;
  /** The active option, matched against the option index or its `id`. */
  isActive: number | boolean | string | undefined;
  options: MenuOptionProps[];
  /** Match `isActive` against each option's `id` instead of its index. */
  optionIds?: boolean;
};

/**
 * Horizontal icon-button bar with arrow-key navigation and tooltips. Kumo has deprecated
 * it in favour of `Tabs` with the segmented look; kept here for parity.
 */
export function MenuBar({ className, isActive, options, optionIds = false }: MenuBarProps) {
  const menuRef = useRef<HTMLElement | null>(null);
  useMenuNavigation({ menuRef, direction: 'horizontal' });

  return (
    <nav
      className={cn(
        'isolate flex rounded-lg bg-recessed pl-px shadow-xs ring ring-border transition-colors',
        className,
      )}
      ref={menuRef}
    >
      {options.map((option, index) => (
        <MenuOption
          key={index}
          {...option}
          isActive={isActive}
          id={optionIds ? option.id : index}
        />
      ))}
    </nav>
  );
}
