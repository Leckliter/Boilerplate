import { LinkButton } from '@app/ui/components/link-button';
import { Card } from '@app/ui/components/card';
import { CheckIcon } from '@app/ui/components/icons';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Placeholder pricing page: replace the plans with your own.',
};

/** Placeholder: replace the plans with your own (or delete the page and its links in components/site). */
const PLANS = [
  {
    name: 'Starter',
    price: '$0',
    note: 'For trying things out',
    features: ['Public site and sign-in', 'Customer portal', 'Community support'],
    cta: 'Start free',
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
    featured: true,
  },
  {
    name: 'Business',
    price: '$99',
    note: 'per month',
    features: ['Everything in Team', 'REST API and MCP', 'Automations', 'Priority support'],
    cta: 'Contact us',
  },
];

export default function PricingPage() {
  return (
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
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" /> {f}
                </li>
              ))}
            </ul>
            <LinkButton
              href="/login"
              variant={p.featured ? 'primary' : 'secondary'}
              className="mt-6 w-full"
            >
              {p.cta}
            </LinkButton>
          </Card>
        ))}
      </div>
    </div>
  );
}
