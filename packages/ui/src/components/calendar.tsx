'use client';

import { cva } from 'class-variance-authority';
import { useState } from 'react';
import type * as React from 'react';

import {
  minutesInAppZone,
  formatDayShort,
  formatShortTime,
  formatTime,
  todayInAppZone,
  weekdayOfDay,
} from '../lib/dates';
import { cn } from '../lib/utils';
import { focusRing } from './link';

/**
 * Calendar views (app time zone): an agenda list, a day/week time grid and a month grid.
 * Presentational — the app gives the events and handles clicks and drops:
 *
 *   <CalendarWeek days={['2026-11-01', …]} events={events}
 *     onSlotClick={(day, minutes) => …} onDrop={(id, { day, minutes }) => …} />
 *
 * Drag and drop uses the browser's, so it's for mouse screens; phones use the agenda.
 * Drag something in from outside (a "needs a date" tray) with `calendarDragProps(id)`.
 */

/** Colour keys an event can use. */
export const CALENDAR_COLORS = [
  'emerald',
  'teal',
  'amber',
  'blue',
  'red',
  'violet',
  'sky',
  'slate',
  'brand',
  'orange',
  'pink',
  'lime',
  'neutral',
] as const;
export type CalendarColor = (typeof CALENDAR_COLORS)[number];

export type CalendarEvent = {
  id: string;
  title: string;
  detail?: string | null;
  start: Date;
  end?: Date | null;
  /** A whole day: shown above the times. */
  allDay?: boolean;
  color: CalendarColor;
  href?: string | null;
  /** Overdue: a red ring. */
  late?: boolean;
  /** May be dragged to a new time. */
  draggable?: boolean;
  /** Someone's busy time, not ours: drawn hatched and faint. */
  muted?: boolean;
};

export type CalendarDropTarget = {
  day: string;
  /** Minutes after midnight (app zone) in the time grid; null when dropped on a whole day. */
  minutes: number | null;
};

/** How an event links somewhere (pass Next's <Link>); a plain <a> by default. */
export type RenderEventLink = (
  event: CalendarEvent,
  props: { className: string; children: React.ReactNode },
) => React.ReactNode;

const DRAG_TYPE = 'application/x-app-calendar';

/** Props that make anything draggable onto a calendar, carrying `id`. */
export function calendarDragProps(id: string) {
  return {
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(DRAG_TYPE, id);
      e.dataTransfer.effectAllowed = 'move';
    },
  };
}

const dragged = (e: React.DragEvent) =>
  e.dataTransfer.types.includes(DRAG_TYPE) ? e.dataTransfer.getData(DRAG_TYPE) : null;

/** The coloured dot / bar / chip of each event colour. */
export const calendarDotVariants = cva('inline-block size-2 shrink-0 rounded-full', {
  variants: {
    color: {
      emerald: 'bg-event-emerald',
      teal: 'bg-event-teal',
      amber: 'bg-event-amber',
      blue: 'bg-event-blue',
      red: 'bg-event-red',
      violet: 'bg-event-violet',
      sky: 'bg-event-sky',
      slate: 'bg-event-slate',
      brand: 'bg-primary',
      orange: 'bg-event-orange',
      pink: 'bg-event-pink',
      lime: 'bg-event-lime',
      neutral: 'bg-muted-foreground/60',
    },
  },
});

const chipVariants = cva(
  'flex min-w-0 overflow-hidden rounded-md border-l-[3px] text-xs leading-tight transition-colors',
  {
    variants: {
      color: {
        emerald:
          'border-event-emerald bg-event-emerald-tint text-event-emerald-ink hover:brightness-95 dark:hover:brightness-110',
        teal: 'border-event-teal bg-event-teal-tint text-event-teal-ink hover:brightness-95 dark:hover:brightness-110',
        amber:
          'border-event-amber bg-event-amber-tint text-event-amber-ink hover:brightness-95 dark:hover:brightness-110',
        blue: 'border-event-blue bg-event-blue-tint text-event-blue-ink hover:brightness-95 dark:hover:brightness-110',
        red: 'border-event-red bg-event-red-tint text-event-red-ink hover:brightness-95 dark:hover:brightness-110',
        violet:
          'border-event-violet bg-event-violet-tint text-event-violet-ink hover:brightness-95 dark:hover:brightness-110',
        sky: 'border-event-sky bg-event-sky-tint text-event-sky-ink hover:brightness-95 dark:hover:brightness-110',
        slate:
          'border-event-slate bg-event-slate-tint text-event-slate-ink hover:brightness-95 dark:hover:brightness-110',
        brand:
          'border-primary bg-brand-50 text-brand-900 hover:bg-brand-100 dark:bg-brand-900/40 dark:text-brand-100',
        orange:
          'border-event-orange bg-event-orange-tint text-event-orange-ink hover:brightness-95 dark:hover:brightness-110',
        pink: 'border-event-pink bg-event-pink-tint text-event-pink-ink hover:brightness-95 dark:hover:brightness-110',
        lime: 'border-event-lime bg-event-lime-tint text-event-lime-ink hover:brightness-95 dark:hover:brightness-110',
        neutral: 'border-border bg-tint text-muted-foreground hover:bg-fill-hover',
      },
    },
  },
);

const HATCH =
  'bg-[repeating-linear-gradient(135deg,transparent_0,transparent_6px,var(--color-border)_6px,var(--color-border)_7px)]';

const defaultLink: RenderEventLink = (event, { className, children }) =>
  event.href ? (
    <a href={event.href} className={className}>
      {children}
    </a>
  ) : (
    <span className={className}>{children}</span>
  );

/** One event as a chip (month cells, all-day row, agenda), or a block in the time grid. */
function EventChip({
  event,
  renderLink,
  className,
  showTime = true,
  compact = false,
}: {
  event: CalendarEvent;
  renderLink: RenderEventLink;
  className?: string;
  showTime?: boolean;
  compact?: boolean;
}) {
  const label = `${event.allDay ? 'All day' : formatTime(event.start)} · ${event.title}${event.detail ? ` · ${event.detail}` : ''}${event.late ? ' · late' : ''}`;
  return (
    <div
      className={cn('min-w-0', event.draggable && 'cursor-grab active:cursor-grabbing', className)}
      title={label}
      {...(event.draggable ? calendarDragProps(event.id) : {})}
    >
      {renderLink(event, {
        className: cn(
          chipVariants({ color: event.color }),
          focusRing,
          'h-full w-full gap-1 px-1.5 py-0.5',
          compact ? 'items-center' : 'flex-col',
          event.muted && cn(HATCH, 'opacity-80'),
          event.late && 'ring-1 ring-destructive',
        ),
        children: (
          <>
            {showTime && !event.allDay && (
              <span className="shrink-0 font-medium tabular-nums">
                {formatShortTime(event.start)}
              </span>
            )}
            <span className={cn('min-w-0 wrap-normal', compact ? 'truncate' : 'line-clamp-2')}>
              {event.title}
            </span>
            {!compact && event.detail && (
              <span className="min-w-0 truncate opacity-75">{event.detail}</span>
            )}
          </>
        ),
      })}
    </div>
  );
}

/** Events that touch an app-zone day. */
function eventsOn(events: CalendarEvent[], day: string) {
  return events.filter((e) => {
    const first = todayInAppZone(e.start);
    if (first === day) return true;
    if (!e.end) return false;
    // Multi-day (busy all week): every day it spans, ending exclusive at midnight.
    const last = todayInAppZone(new Date(e.end.getTime() - 1));
    return first < day && day <= last;
  });
}

const byStart = (a: CalendarEvent, b: CalendarEvent) => a.start.getTime() - b.start.getTime();

// ---------------------------------------------------------------- agenda

/** A list of days with their events — the phone view, and the header panel. */
function CalendarAgenda({
  days,
  events,
  renderLink = defaultLink,
  emptyDays = 'hide',
  emptyText = 'Nothing scheduled.',
  className,
}: {
  days: string[];
  events: CalendarEvent[];
  renderLink?: RenderEventLink;
  /** Show days with nothing on them ("show") or skip them ("hide"). Today always shows. */
  emptyDays?: 'show' | 'hide';
  emptyText?: string;
  className?: string;
}) {
  const today = todayInAppZone();
  const shown = days
    .map((day) => ({ day, list: eventsOn(events, day).sort(byStart) }))
    .filter((d) => emptyDays === 'show' || d.list.length || d.day === today);
  if (!shown.length)
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <ol data-slot="calendar-agenda" className={cn('grid gap-4', className)}>
      {shown.map(({ day, list }) => (
        <li key={day} className="grid gap-1.5">
          <h3
            className={cn(
              'text-xs font-medium tracking-wide text-muted-foreground uppercase',
              day === today && 'text-primary',
            )}
          >
            {day === today ? `Today · ${formatDayShort(day)}` : formatDayShort(day)}
          </h3>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="grid gap-1">
              {list.map((e) => (
                <li key={e.id}>
                  {renderLink(e, {
                    className: cn(
                      'flex min-w-0 items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-fill-hover',
                      focusRing,
                      e.muted && 'opacity-70',
                    ),
                    children: (
                      <>
                        <span className="w-16 shrink-0 pt-px text-xs text-muted-foreground tabular-nums">
                          {e.allDay || todayInAppZone(e.start) !== day
                            ? 'All day'
                            : formatTime(e.start)}
                        </span>
                        <span className={cn(calendarDotVariants({ color: e.color }), 'mt-1.5')} />
                        <span className="grid min-w-0 flex-1">
                          <span className="truncate text-sm">
                            {e.title}
                            {e.late && <span className="text-destructive"> · late</span>}
                          </span>
                          {e.detail && (
                            <span className="truncate text-xs text-muted-foreground">
                              {e.detail}
                            </span>
                          )}
                        </span>
                      </>
                    ),
                  })}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
}

// ---------------------------------------------------------------- time grid

const HOUR_PX = 48;
const SNAP = 15;

/** Side-by-side columns for overlapping timed events in one day. */
function layoutDay(list: CalendarEvent[], dayStart: number, dayEnd: number) {
  const items = list
    .map((e) => {
      const top = Math.max(dayStart, minutesInAppZone(e.start));
      const endMin =
        e.end && todayInAppZone(e.end) === todayInAppZone(e.start)
          ? minutesInAppZone(e.end)
          : top + 30;
      const bottom = Math.min(dayEnd, Math.max(endMin, top + 30));
      return { e, top: Math.min(top, dayEnd - 30), bottom };
    })
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);
  const placed: { e: CalendarEvent; top: number; bottom: number; col: number; cols: number }[] = [];
  let cluster: typeof placed = [];
  let clusterEnd = -1;
  const flush = () => {
    const cols = Math.max(1, ...cluster.map((c) => c.col + 1));
    for (const c of cluster) c.cols = cols;
    cluster = [];
  };
  for (const it of items) {
    if (it.top >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const used = new Set(cluster.filter((c) => c.bottom > it.top).map((c) => c.col));
    let col = 0;
    while (used.has(col)) col++;
    const p = { ...it, col, cols: 1 };
    cluster.push(p);
    placed.push(p);
    clusterEnd = Math.max(clusterEnd, it.bottom);
  }
  flush();
  return placed;
}

const hourLabel = (h: number) =>
  h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`;

/** A day or a week as a time grid. Click an empty time to add; drag events to move them. */
function CalendarWeek({
  days,
  events,
  startHour = 7,
  endHour = 20,
  renderLink = defaultLink,
  onSlotClick,
  onDrop,
  className,
}: {
  days: string[];
  events: CalendarEvent[];
  startHour?: number;
  endHour?: number;
  renderLink?: RenderEventLink;
  onSlotClick?: (day: string, minutes: number) => void;
  onDrop?: (id: string, target: CalendarDropTarget) => void;
  className?: string;
}) {
  const today = todayInAppZone();
  const [hover, setHover] = useState<{ day: string; minutes: number } | null>(null);
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const height = ((dayEnd - dayStart) / 60) * HOUR_PX;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const minutesAt = (e: React.MouseEvent | React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const raw = dayStart + ((e.clientY - rect.top) / HOUR_PX) * 60;
    return Math.min(dayEnd - SNAP, Math.max(dayStart, Math.floor(raw / SNAP) * SNAP));
  };
  const cols = `3rem repeat(${days.length}, minmax(0, 1fr))`;
  const allDay = days.map((day) =>
    eventsOn(events, day).filter((e) => e.allDay || todayInAppZone(e.start) !== day),
  );

  return (
    <div data-slot="calendar-week" className={cn('min-w-0 text-sm', className)}>
      <div
        className="sticky top-0 z-10 grid border-b border-hairline bg-background"
        style={{ gridTemplateColumns: cols }}
      >
        <span />
        {days.map((day) => (
          <div
            key={day}
            className={cn(
              'flex min-w-0 flex-col items-center py-1.5 text-xs text-muted-foreground',
              day === today && 'text-primary',
            )}
          >
            <span className="uppercase">{formatDayShort(day).split(',')[0]}</span>
            <span
              className={cn(
                'flex size-7 items-center justify-center rounded-full text-base font-medium text-foreground',
                day === today && 'bg-primary text-primary-foreground',
              )}
            >
              {Number(day.slice(8, 10))}
            </span>
          </div>
        ))}
      </div>
      {allDay.some((l) => l.length) && (
        <div className="grid border-b border-hairline" style={{ gridTemplateColumns: cols }}>
          <span className="py-1 pr-1 text-right text-[0.625rem] text-muted-foreground">
            all day
          </span>
          {allDay.map((list, i) => (
            <div
              key={days[i]}
              className="grid min-w-0 gap-0.5 border-l border-hairline p-0.5"
              onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
              onDrop={
                onDrop
                  ? (e) => {
                      const id = dragged(e);
                      if (id) onDrop(id, { day: days[i]!, minutes: null });
                    }
                  : undefined
              }
            >
              {list.map((e) => (
                <EventChip key={e.id} event={e} renderLink={renderLink} compact showTime={false} />
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="grid" style={{ gridTemplateColumns: cols }}>
        <div className="relative" style={{ height }} aria-hidden>
          {hours.map((h, i) => (
            <span
              key={h}
              className="absolute right-1 -translate-y-1/2 text-[0.625rem] text-muted-foreground tabular-nums"
              style={{ top: i * HOUR_PX }}
            >
              {i === 0 ? '' : hourLabel(h)}
            </span>
          ))}
        </div>
        {days.map((day) => {
          const timed = eventsOn(events, day).filter(
            (e) => !e.allDay && todayInAppZone(e.start) === day,
          );
          const placed = layoutDay(timed, dayStart, dayEnd);
          const nowMin = day === today ? minutesInAppZone(new Date()) : null;
          return (
            <div
              key={day}
              role={onSlotClick ? 'presentation' : undefined}
              className={cn(
                'relative min-w-0 border-l border-hairline',
                day === today && 'bg-primary/[0.03]',
                onSlotClick && 'cursor-cell',
              )}
              style={{
                height,
                backgroundImage: `repeating-linear-gradient(to bottom, var(--color-hairline) 0, var(--color-hairline) 1px, transparent 1px, transparent ${HOUR_PX}px)`,
              }}
              onClick={
                onSlotClick
                  ? (e) => {
                      if (e.target === e.currentTarget) onSlotClick(day, minutesAt(e));
                    }
                  : undefined
              }
              onDragOver={
                onDrop
                  ? (e) => {
                      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                      e.preventDefault();
                      const minutes = minutesAt(e);
                      if (hover?.day !== day || hover.minutes !== minutes)
                        setHover({ day, minutes });
                    }
                  : undefined
              }
              onDragLeave={() => setHover(null)}
              onDrop={
                onDrop
                  ? (e) => {
                      e.preventDefault();
                      setHover(null);
                      const id = dragged(e);
                      if (id) onDrop(id, { day, minutes: minutesAt(e) });
                    }
                  : undefined
              }
            >
              {placed.map((p) => (
                <div
                  key={p.e.id}
                  className="absolute p-px"
                  style={{
                    top: ((p.top - dayStart) / 60) * HOUR_PX,
                    height: ((p.bottom - p.top) / 60) * HOUR_PX,
                    left: `${(p.col / p.cols) * 100}%`,
                    width: `${100 / p.cols}%`,
                  }}
                >
                  <EventChip
                    event={p.e}
                    renderLink={renderLink}
                    compact={p.bottom - p.top < 45}
                    className="h-full"
                  />
                </div>
              ))}
              {nowMin !== null && nowMin >= dayStart && nowMin <= dayEnd && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-[1] border-t-2 border-primary"
                  style={{ top: ((nowMin - dayStart) / 60) * HOUR_PX }}
                />
              )}
              {hover?.day === day && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-[2] rounded-sm border border-dashed border-primary bg-primary/10 text-[0.625rem] text-primary"
                  style={{ top: ((hover.minutes - dayStart) / 60) * HOUR_PX, height: HOUR_PX / 2 }}
                >
                  <span className="px-1">
                    {hourLabel(Math.floor(hover.minutes / 60)).replace(/[ap]$/, '')}:
                    {String(hover.minutes % 60).padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- month

/** Six weeks of days. On phones each day shows dots; tap a day to open it. */
function CalendarMonth({
  days,
  month,
  events,
  renderLink = defaultLink,
  maxPerDay = 3,
  onDayClick,
  onDrop,
  className,
}: {
  /** The 42 days to show (`monthGridDays`). */
  days: string[];
  /** "YYYY-MM": days outside it are faded. */
  month: string;
  events: CalendarEvent[];
  renderLink?: RenderEventLink;
  maxPerDay?: number;
  onDayClick?: (day: string) => void;
  onDrop?: (id: string, target: CalendarDropTarget) => void;
  className?: string;
}) {
  const today = todayInAppZone();
  const [over, setOver] = useState<string | null>(null);
  return (
    <div data-slot="calendar-month" className={cn('min-w-0 text-sm', className)}>
      <div className="grid grid-cols-7 border-b border-hairline">
        {days.slice(0, 7).map((d) => (
          <span
            key={d}
            className="py-1.5 text-center text-xs font-medium text-muted-foreground uppercase"
          >
            {formatDayShort(d).split(',')[0]}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = eventsOn(events, day).sort(
            (a, b) => Number(!a.allDay) - Number(!b.allDay) || byStart(a, b),
          );
          const extra = list.length - maxPerDay;
          const outside = !day.startsWith(month);
          return (
            <div
              key={day}
              className={cn(
                'grid min-h-16 min-w-0 content-start gap-0.5 border-b border-hairline p-0.5 sm:min-h-28 sm:p-1',
                weekdayOfDay(day) !== 0 && 'border-l',
                outside && 'bg-elevated',
                over === day && 'bg-primary/10',
              )}
              onDragOver={
                onDrop
                  ? (e) => {
                      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                      e.preventDefault();
                      setOver(day);
                    }
                  : undefined
              }
              onDragLeave={() => setOver((o) => (o === day ? null : o))}
              onDrop={
                onDrop
                  ? (e) => {
                      e.preventDefault();
                      setOver(null);
                      const id = dragged(e);
                      if (id) onDrop(id, { day, minutes: null });
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => onDayClick?.(day)}
                disabled={!onDayClick}
                aria-label={`${formatDayShort(day)}${list.length ? `, ${list.length} on the calendar` : ''}`}
                className={cn(
                  'justify-self-end rounded-full px-1.5 text-xs tabular-nums enabled:hover:bg-fill-hover sm:text-sm',
                  focusRing,
                  outside ? 'text-muted-foreground' : 'text-foreground',
                  day === today &&
                    'bg-primary font-semibold text-primary-foreground enabled:hover:bg-primary',
                )}
              >
                {Number(day.slice(8, 10))}
              </button>
              {/* Phones: a dot per event (up to 4), tap the day for the list. */}
              <div className="flex flex-wrap justify-center gap-0.5 sm:hidden" aria-hidden>
                {list.slice(0, 4).map((e) => (
                  <span key={e.id} className={calendarDotVariants({ color: e.color })} />
                ))}
              </div>
              <div className="hidden min-w-0 gap-0.5 sm:grid">
                {list.slice(0, extra > 0 ? maxPerDay - 1 : maxPerDay).map((e) => (
                  <EventChip key={e.id} event={e} renderLink={renderLink} compact />
                ))}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onDayClick?.(day)}
                    className={cn(
                      'rounded px-1.5 text-left text-xs text-muted-foreground hover:bg-fill-hover hover:text-foreground',
                      focusRing,
                    )}
                  >
                    +{extra + 1} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A legend: what each colour means. Buttons when `onToggle` is given (show/hide a kind). */
function CalendarLegend({
  items,
  hidden,
  onToggle,
  className,
}: {
  items: { key: string; label: string; color: CalendarColor }[];
  hidden?: string[];
  onToggle?: (key: string) => void;
  className?: string;
}) {
  return (
    <ul data-slot="calendar-legend" className={cn('flex flex-wrap gap-x-3 gap-y-1.5', className)}>
      {items.map((i) => {
        const off = hidden?.includes(i.key);
        const inner = (
          <>
            <span className={cn(calendarDotVariants({ color: i.color }), off && 'opacity-30')} />
            <span className={cn(off && 'text-muted-foreground line-through')}>{i.label}</span>
          </>
        );
        return (
          <li key={i.key}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(i.key)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-1 text-xs hover:bg-fill-hover',
                  focusRing,
                )}
              >
                {inner}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-1 text-xs">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export { CalendarAgenda, CalendarLegend, CalendarMonth, CalendarWeek };
