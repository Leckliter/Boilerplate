'use client';

import {
  CalendarAgenda,
  type CalendarEvent,
  CalendarLegend,
  CalendarMonth,
  CalendarWeek,
} from '@app/ui/components/calendar';
import { toast } from '@app/ui/components/toaster';
import {
  addDaysToDay,
  zonedTimeToDate,
  formatDayShort,
  formatTime,
  monthGridDays,
  todayInAppZone,
  weekStartDay,
} from '@app/ui/lib/dates';
import { useState } from 'react';

/** The calendar views with made-up events around today. Drag the blocks; click an empty time. */
export function CalendarDemo() {
  const today = todayInAppZone();
  const start = weekStartDay(today);
  const week = Array.from({ length: 7 }, (_, i) => addDaysToDay(start, i));
  const [events, setEvents] = useState<CalendarEvent[]>(() => [
    {
      id: 'a',
      title: 'Delivery · Pat Doe',
      detail: 'Springfield · Terry',
      start: zonedTimeToDate(today, 9),
      end: zonedTimeToDate(today, 11),
      color: 'emerald',
      draggable: true,
    },
    {
      id: 'b',
      title: 'Pickup · Sam Lee',
      detail: 'Nobody assigned',
      start: zonedTimeToDate(today, 10),
      end: zonedTimeToDate(today, 12),
      color: 'amber',
      draggable: true,
    },
    {
      id: 'c',
      title: 'Call Pat about stairs',
      start: zonedTimeToDate(addDaysToDay(today, 1), 14),
      color: 'brand',
      draggable: true,
    },
    {
      id: 'd',
      title: 'Busy · Collin',
      start: zonedTimeToDate(addDaysToDay(today, 2), 13),
      end: zonedTimeToDate(addDaysToDay(today, 2), 15),
      color: 'neutral',
      muted: true,
    },
    {
      id: 'e',
      title: 'Promised payment · Jo',
      start: zonedTimeToDate(addDaysToDay(today, 3)),
      allDay: true,
      color: 'lime',
    },
    {
      id: 'f',
      title: 'Due back · Ray',
      start: zonedTimeToDate(addDaysToDay(today, -1), 17),
      color: 'orange',
      late: true,
    },
  ]);
  const move = (id: string, t: { day: string; minutes: number | null }) =>
    setEvents((list) =>
      list.map((e) => {
        if (e.id !== id) return e;
        const startAt = zonedTimeToDate(
          t.day,
          t.minutes === null ? 9 : Math.floor(t.minutes / 60),
          t.minutes === null ? 0 : t.minutes % 60,
        );
        const length = e.end ? e.end.getTime() - e.start.getTime() : 0;
        return { ...e, start: startAt, end: e.end ? new Date(startAt.getTime() + length) : null };
      }),
    );
  return (
    <div className="grid gap-6">
      <CalendarLegend
        items={[
          { key: 'delivery', label: 'Delivery', color: 'emerald' },
          { key: 'pickup', label: 'Pickup', color: 'amber' },
          { key: 'task', label: 'Task', color: 'brand' },
          { key: 'promise', label: 'Promised payment', color: 'lime' },
          { key: 'return', label: 'Due back', color: 'orange' },
          { key: 'busy', label: 'Busy (Google)', color: 'neutral' },
        ]}
      />
      <div className="overflow-hidden rounded-xl border border-border">
        <CalendarWeek
          days={week}
          events={events}
          onDrop={move}
          onSlotClick={(day, minutes) =>
            toast(
              `Add something at ${formatDayShort(day)}, ${formatTime(zonedTimeToDate(day, Math.floor(minutes / 60), minutes % 60))}`,
            )
          }
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-border">
          <CalendarMonth
            days={monthGridDays(today)}
            month={today.slice(0, 7)}
            events={events}
            onDrop={move}
          />
        </div>
        <div className="rounded-xl border border-border p-4">
          <CalendarAgenda days={week} events={events} />
        </div>
      </div>
    </div>
  );
}
