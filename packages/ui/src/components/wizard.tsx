'use client';

import * as React from 'react';

import { cn } from '../lib/utils';
import { Button } from './button';
import { Steps, type StepsLabels } from './steps';

/**
 * A multi-step flow shell: the Steps indicator, the current step's content, Back / Next / Finish.
 * It owns only navigation: each step says whether Next is allowed (`valid`), and `onFinish` runs
 * when the last step is confirmed. Hold the form data in the parent (or one <form> per step).
 * Controlled with `step` + `onStepChange`, or uncontrolled.
 */
/** Words the wizard shows; pass translations (all have English defaults). */
interface WizardLabels {
  /** Accessible name of the whole flow. @default "Step by step" */
  region?: string;
  back?: string;
  next?: string;
  finish?: string;
  /** Screen-reader prefix of the step heading. @default (n, total) => `Step ${n} of ${total}:` */
  stepOf?: (step: number, total: number) => string;
  /** Labels of the Steps indicator. */
  steps?: StepsLabels;
}

const DEFAULT_LABELS = {
  region: 'Step by step',
  back: 'Back',
  next: 'Next',
  finish: 'Finish',
  stepOf: (step: number, total: number) => `Step ${step} of ${total}:`,
};

type WizardStep = {
  id: string;
  label: string;
  description?: React.ReactNode;
  content: React.ReactNode;
  /** Next/Finish is disabled while false. Default true. */
  valid?: boolean;
};

function Wizard({
  steps,
  step: stepProp,
  onStepChange,
  onFinish,
  finishLabel,
  labels: labelsProp,
  busy,
  className,
}: {
  steps: WizardStep[];
  step?: number;
  onStepChange?: (step: number) => void;
  onFinish: () => void | Promise<void>;
  /** Same as `labels.finish`. */
  finishLabel?: string;
  labels?: WizardLabels;
  /** Disables the buttons while the finish action runs. */
  busy?: boolean;
  className?: string;
}) {
  const labels = { ...DEFAULT_LABELS, ...labelsProp };
  const [inner, setInner] = React.useState(0);
  const step = Math.min(Math.max(stepProp ?? inner, 0), steps.length - 1);
  const go = (n: number) => {
    if (stepProp === undefined) setInner(n);
    onStepChange?.(n);
  };
  const current = steps[step]!;
  const last = step === steps.length - 1;
  const heading = React.useRef<HTMLHeadingElement>(null);
  const first = React.useRef(true);
  React.useEffect(() => {
    // Move focus to the new step's heading so keyboard and screen-reader users land on it.
    if (first.current) first.current = false;
    else heading.current?.focus();
  }, [step]);

  return (
    <section
      data-slot="wizard"
      aria-label={labels.region}
      className={cn('grid min-w-0 gap-6', className)}
    >
      <Steps
        steps={steps.map((s) => s.label)}
        current={step}
        onStepClick={go}
        labels={labels.steps}
      />
      <div className="grid min-w-0 gap-4">
        <div className="grid gap-1">
          <h2 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
            <span className="sr-only">{labels.stepOf(step + 1, steps.length)}</span> {current.label}
          </h2>
          {current.description && (
            <p className="text-sm text-muted-foreground">{current.description}</p>
          )}
        </div>
        <div>{current.content}</div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline pt-4">
        <Button variant="ghost" disabled={step === 0 || busy} onClick={() => go(step - 1)}>
          {labels.back}
        </Button>
        <Button
          variant="primary"
          disabled={current.valid === false || busy}
          onClick={() => (last ? void onFinish() : go(step + 1))}
        >
          {last ? (finishLabel ?? labels.finish) : labels.next}
        </Button>
      </div>
    </section>
  );
}

export type { WizardLabels, WizardStep };
export { Wizard };
