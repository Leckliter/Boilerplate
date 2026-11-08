import { z } from 'zod';

/** How an event type is declared. THE list of events is ./catalog.ts. */
export type EventType<S extends z.ZodType = z.ZodType, K extends string = string> = {
  type: K;
  /** When it is emitted, written for a person (or AI) building an automation. */
  description: string;
  /** What the event is about — becomes `subject` (links, history). */
  subject?: { type: string; id: (data: z.output<S>) => string | null | undefined };
  data: S;
  /** Realistic sample data (docs, the "test run" button, AI clients). */
  example: z.input<S>;
};

/** `event<'area.happened'>()({ … })` — keeps the type name as a literal. */
export const event =
  <K extends string>() =>
  <S extends z.ZodType>(e: EventType<S, K>) =>
    e;

export const id = z.uuid();
export const cents = z.number().int().describe('Amount in cents');
