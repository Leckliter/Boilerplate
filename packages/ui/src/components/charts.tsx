import { cn } from '../lib/utils';

/**
 * Dependency-free SVG charts in token colours (--chart-1 … --chart-6, light and dark).
 * Every chart is an image with a title and description for screen readers AND a visually-hidden
 * data table (the real fallback); pass `showTable` to show the table under the chart too.
 * Server-safe. Charts scale to their container (viewBox), so they are fine at 320px.
 *
 *   <Sparkline label="Daily orders" data={[3, 5, 4, 9]} />
 *   <BarChart title="Orders by day" data={[{ label: 'Mon', value: 12 }]} />
 *   <DonutChart title="Revenue by plan" data={[{ label: 'Pro', value: 70 }, { label: 'Free', value: 30 }]} />
 */

const SERIES = [
  { fill: 'fill-chart-1', stroke: 'stroke-chart-1', bg: 'bg-chart-1' },
  { fill: 'fill-chart-2', stroke: 'stroke-chart-2', bg: 'bg-chart-2' },
  { fill: 'fill-chart-3', stroke: 'stroke-chart-3', bg: 'bg-chart-3' },
  { fill: 'fill-chart-4', stroke: 'stroke-chart-4', bg: 'bg-chart-4' },
  { fill: 'fill-chart-5', stroke: 'stroke-chart-5', bg: 'bg-chart-5' },
  { fill: 'fill-chart-6', stroke: 'stroke-chart-6', bg: 'bg-chart-6' },
] as const;

type Datum = { label: string; value: number };
type Format = (value: number) => string;
const plain: Format = (v) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(v);

/** The words a screen reader gets for a chart: what it is, how many points, the range. */
function summarize(values: number[], format: Format): string {
  if (!values.length) return 'No data.';
  const min = Math.min(...values);
  const max = Math.max(...values);
  return `${values.length} points, from ${format(values[0]!)} to ${format(values[values.length - 1]!)}, lowest ${format(min)}, highest ${format(max)}.`;
}

function DataFallback({
  caption,
  data,
  format,
  show,
  valueHeader = 'Value',
}: {
  caption: string;
  data: Datum[];
  format: Format;
  show?: boolean;
  valueHeader?: string;
}) {
  return (
    <table className={cn(show ? 'mt-3 w-full text-sm' : 'sr-only')}>
      <caption className={cn(show ? 'sr-only' : undefined)}>{caption}</caption>
      <thead>
        <tr>
          <th scope="col" className="py-1 text-left font-medium">
            Item
          </th>
          <th scope="col" className="py-1 text-right font-medium">
            {valueHeader}
          </th>
        </tr>
      </thead>
      <tbody>
        {data.map((d) => (
          <tr key={d.label} className={show ? 'border-t border-hairline' : undefined}>
            <th scope="row" className="py-1 text-left font-normal">
              {d.label}
            </th>
            <td className="py-1 text-right tabular-nums">{format(d.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── Sparkline ─────────────────────────────────────────────────────── */

function Sparkline({
  data,
  label,
  format = plain,
  series = 0,
  area = true,
  width,
  height,
  className,
}: {
  data: number[];
  /** What it shows: "Daily orders, last 14 days". */
  label: string;
  format?: Format;
  /** Which chart colour (0–5). */
  series?: number;
  area?: boolean;
  /** Pixel width, or `'fill'` to take the whole width of the container. Default: up to 10rem wide. */
  width?: number | 'fill';
  /** Pixel height. With a pixel `width` the default keeps the 120 × 32 proportions. */
  height?: number;
  className?: string;
}) {
  const fill = width === 'fill';
  const W = typeof width === 'number' ? width : 120;
  const H = height ?? (typeof width === 'number' ? Math.round((width * 32) / 120) : 32);
  const pad = 2;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [
    data.length === 1 ? W / 2 : pad + (i * (W - pad * 2)) / (data.length - 1),
    H - pad - ((v - min) / span) * (H - pad * 2),
  ]);
  const line = pts
    .map(([x, y], i) => `${i ? 'L' : 'M'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
    .join(' ');
  const s = SERIES[series % SERIES.length]!;
  const last = pts[pts.length - 1];
  return (
    <svg
      data-slot="sparkline"
      role="img"
      aria-label={`${label}. ${summarize(data, format)}`}
      viewBox={`0 0 ${W} ${H}`}
      {...(typeof width === 'number' && { width: W, height: H })}
      {...(fill && height !== undefined && { height: H })}
      preserveAspectRatio="none"
      className={cn(
        'block overflow-visible',
        typeof width === 'number'
          ? 'max-w-full'
          : fill
            ? height === undefined
              ? 'aspect-[120/32] h-auto w-full'
              : 'w-full'
            : 'aspect-[120/32] h-auto w-full max-w-40',
        className,
      )}
    >
      {area && data.length > 1 && (
        <path
          d={`${line} L${pts[pts.length - 1]![0]!.toFixed(1)} ${H} L${pts[0]![0]!.toFixed(1)} ${H} Z`}
          className={cn(s.fill, 'opacity-15')}
        />
      )}
      {data.length > 0 && (
        <path
          d={line}
          fill="none"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          className={s.stroke}
        />
      )}
      {last && <circle cx={last[0]} cy={last[1]} r={2.5} className={s.fill} />}
    </svg>
  );
}

/* ── Bar chart ─────────────────────────────────────────────────────── */

function BarChart({
  data,
  title,
  description,
  format = plain,
  series = 0,
  showTable = false,
  className,
}: {
  data: Datum[];
  title: string;
  description?: string;
  format?: Format;
  series?: number;
  showTable?: boolean;
  className?: string;
}) {
  const W = 320;
  const H = 160;
  const top = 18;
  const bottom = 22;
  const max = Math.max(0, ...data.map((d) => d.value)) || 1;
  const slot = W / Math.max(data.length, 1);
  const barW = Math.min(36, slot * 0.6);
  const plotH = H - top - bottom;
  const s = SERIES[series % SERIES.length]!;
  const desc = `${description ? `${description} ` : ''}${summarize(
    data.map((d) => d.value),
    format,
  )}`;
  return (
    <figure data-slot="bar-chart" className={cn('m-0 min-w-0', className)}>
      <svg
        role="img"
        aria-label={`${title}. ${desc}`}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
      >
        <line
          x1={0}
          x2={W}
          y1={H - bottom}
          y2={H - bottom}
          className="stroke-border"
          strokeWidth={1}
        />
        {data.map((d, i) => {
          const h = (Math.max(d.value, 0) / max) * plotH;
          const x = slot * i + (slot - barW) / 2;
          return (
            <g key={d.label}>
              <rect x={x} y={H - bottom - h} width={barW} height={h} rx={3} className={s.fill} />
              <text
                x={x + barW / 2}
                y={H - bottom - h - 4}
                textAnchor="middle"
                className="fill-foreground text-[10px] tabular-nums"
              >
                {format(d.value)}
              </text>
              <text
                x={x + barW / 2}
                y={H - 6}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">{title}</figcaption>
      <DataFallback caption={title} data={data} format={format} show={showTable} />
    </figure>
  );
}

/* ── Donut chart ───────────────────────────────────────────────────── */

function DonutChart({
  data,
  title,
  description,
  format = plain,
  centerLabel,
  showTable = false,
  className,
}: {
  data: Datum[];
  title: string;
  description?: string;
  format?: Format;
  /** Text in the hole: "Total" or a value. Defaults to the total. */
  centerLabel?: string;
  showTable?: boolean;
  className?: string;
}) {
  const total = data.reduce((n, d) => n + Math.max(d.value, 0), 0);
  const R = 40;
  const C = 2 * Math.PI * R;
  const offsets = data.reduce<number[]>((acc, d, i) => {
    acc.push((acc[i - 1] ?? 0) + (Math.max(d.value, 0) / (total || 1)) * C);
    return acc;
  }, []);
  const desc = `${description ? `${description} ` : ''}${data
    .map(
      (d) =>
        `${d.label} ${format(d.value)}${total ? ` (${Math.round((d.value / total) * 100)}%)` : ''}`,
    )
    .join(', ')}.`;
  return (
    <figure
      data-slot="donut-chart"
      className={cn('m-0 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3', className)}
    >
      <svg
        role="img"
        aria-label={`${title}. ${desc}`}
        viewBox="0 0 100 100"
        className="block size-36 shrink-0"
      >
        <circle cx={50} cy={50} r={R} fill="none" strokeWidth={14} className="stroke-fill" />
        {total > 0 &&
          data.map((d, i) => {
            const len = (Math.max(d.value, 0) / total) * C;
            const offset = (offsets[i] ?? 0) - len;
            return (
              <circle
                key={d.label}
                cx={50}
                cy={50}
                r={R}
                fill="none"
                strokeWidth={14}
                strokeDasharray={`${Math.max(len - 1, 0)} ${C - Math.max(len - 1, 0)}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
                className={SERIES[i % SERIES.length]!.stroke}
              />
            );
          })}
        <text
          x={50}
          y={50}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-[11px] font-semibold tabular-nums"
        >
          {centerLabel ?? format(total)}
        </text>
      </svg>
      <div className="min-w-0 flex-1 basis-40">
        <ul className="m-0 grid list-none gap-1.5 p-0 text-sm" aria-hidden>
          {data.map((d, i) => (
            <li key={d.label} className="flex min-w-0 items-center gap-2">
              <span className={cn('size-2.5 shrink-0 rounded-sm', SERIES[i % SERIES.length]!.bg)} />
              <span className="min-w-0 flex-1 truncate">{d.label}</span>
              <span className="text-muted-foreground tabular-nums">{format(d.value)}</span>
            </li>
          ))}
        </ul>
        <figcaption className="sr-only">{title}</figcaption>
        <DataFallback caption={title} data={data} format={format} show={showTable} />
      </div>
    </figure>
  );
}

export type { Datum as ChartDatum };
export { BarChart, DonutChart, Sparkline };
