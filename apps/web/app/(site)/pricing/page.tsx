import { Card } from '@app/ui/components/card';
import { CheckIcon, MinusIcon } from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
import type { Metadata } from 'next';

import { Faq, type FaqItem } from '@/components/site/faq';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Simple pricing: start free, add a team when you need one. Placeholder plans to replace with your own.',
  alternates: { canonical: '/pricing' },
};

/** Placeholder: replace the plans with your own (or delete the page and its links in components/site). */
const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    note: 'For trying things out',
    features: ['Public site and sign-in', 'Customer portal', 'Community support'],
    cta: 'Start free',
    href: '/login',
  },
  {
    name: 'Team',
    price: '$29',
    note: 'per month',
    features: [
      'Everything in Starter',
      'Admin with roles',
      'Activity log and errors',
      'Email support',
    ],
    cta: 'Choose Team',
    href: '/login',
    featured: true,
  },
  {
    name: 'Business',
    price: '$99',
    note: 'per month',
    features: ['Everything in Team', 'REST API and MCP', 'Automations', 'Priority support'],
    cta: 'Contact us',
    href: '/contact',
  },
];

/** Rows of the comparison table: one cell per plan, in the order of PLANS. */
const COMPARE: { label: string; cells: (string | boolean)[] }[] = [
  { label: 'Public website and sign-in', cells: [true, true, true] },
  { label: 'Customer portal', cells: [true, true, true] },
  { label: 'Admin with roles', cells: [false, true, true] },
  { label: 'Activity log and error reports', cells: [false, true, true] },
  { label: 'REST API and MCP for AI', cells: [false, false, true] },
  { label: 'Automations', cells: [false, false, true] },
  { label: 'Support', cells: ['Community', 'Email', 'Priority'] },
];

const FAQ: FaqItem[] = [
  {
    q: 'Can I change plans later?',
    a: 'Yes. Move up or down any time; the change applies from your next billing date.',
  },
  {
    q: 'Is there a free trial?',
    a: 'Starter is free forever. Team and Business can be tried for 14 days without a card.',
  },
  {
    q: 'How does billing work?',
    a: 'Plans are billed monthly. You can cancel any time and keep access until the period ends.',
  },
  {
    q: 'Do you offer discounts?',
    a: 'We offer discounts for non-profits and students. Send us a message and tell us about your project.',
  },
];

function Cell({ value, plan }: { value: string | boolean; plan: string }) {
  if (typeof value === 'string') return <span>{value}</span>;
  return value ? (
    <CheckIcon aria-label={`Included in ${plan}`} className="mx-auto size-4 text-primary" />
  ) : (
    <MinusIcon aria-label={`Not in ${plan}`} className="mx-auto size-4 text-muted-foreground" />
  );
}

export default function PricingPage() {
  return (
    <>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          These plans are placeholders. Replace them with your own.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <Card key={p.name} className={p.featured ? 'p-6 ring-2 ring-primary' : 'p-6'}>
              <h2 className="font-semibold">{p.name}</h2>
              <p className="mt-3 text-4xl font-semibold tracking-tight">{p.price}</p>
              <p className="text-sm text-muted-foreground">{p.note}</p>
              <ul className="mt-6 grid gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                  </li>
                ))}
              </ul>
              <LinkButton
                href={p.href}
                variant={p.featured ? 'primary' : 'secondary'}
                className="mt-6 w-full"
              >
                {p.cta}
              </LinkButton>
            </Card>
          ))}
        </div>

        <h2 className="mt-16 text-xl font-semibold tracking-tight">Compare plans</h2>
        <div className="mt-4 overflow-x-auto rounded-lg bg-card ring ring-border">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <caption className="sr-only">What each plan includes</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Feature</span>
                </th>
                {PLANS.map((p) => (
                  <th key={p.name} scope="col" className="px-4 py-3 text-center font-semibold">
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b border-hairline last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-normal">
                    {row.label}
                  </th>
                  {row.cells.map((c, i) => (
                    <td
                      key={PLANS[i]!.name}
                      className="px-4 py-3 text-center text-muted-foreground"
                    >
                      <Cell value={c} plan={PLANS[i]!.name} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Faq items={FAQ} id="pricing-faq" />
    </>
  );
}
