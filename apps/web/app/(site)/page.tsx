import { buttonVariants } from '@app/ui/components/button';
import { LinkButton } from '@app/ui/components/link-button';
import { Card } from '@app/ui/components/card';
import {
  ArrowRightIcon,
  BugIcon,
  KeyIcon,
  LightningIcon,
  PulseIcon,
  RobotIcon,
  ShieldCheckIcon,
} from '@app/ui/components/icons';
import Link from 'next/link';

import { SITE } from '@/lib/site';

const FEATURES = [
  {
    icon: ShieldCheckIcon,
    title: 'One set of actions',
    text: 'Every read and write is a named, validated, permission-checked action. The website, admin, REST API and AI all call the same ones.',
  },
  {
    icon: PulseIcon,
    title: 'A complete audit trail',
    text: 'Who did what, from where, and the before and after of every field, kept automatically.',
  },
  {
    icon: BugIcon,
    title: 'Errors you can hand to an AI',
    text: 'Every failure gets a short reference and a copy-ready brief with the diagnosis, the input and the stack.',
  },
  {
    icon: KeyIcon,
    title: 'Roles, not guesses',
    text: 'People are tagged for description and granted roles for access. A tag never unlocks anything.',
  },
  {
    icon: RobotIcon,
    title: 'Ready for AI assistants',
    text: 'An MCP server and a REST API over the same actions, with API keys that can only do what their owner can.',
  },
  {
    icon: LightningIcon,
    title: 'Automations and notifications',
    text: 'React to events, send email and text with consent and delivery tracking, retry what fails.',
  },
];

export default function HomePage() {
  return (
    <>
      <section className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <p className="w-fit rounded-full bg-tint px-3 py-1 text-xs font-medium text-muted-foreground ring ring-border">
            Starter kit
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {SITE.tagline}
          </h1>
          <p className="max-w-2xl text-lg text-balance text-muted-foreground">{SITE.description}</p>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/account" variant="primary" size="lg">
              Get started <ArrowRightIcon />
            </LinkButton>
            <Link href="/docs" className={buttonVariants({ size: 'lg' })}>
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 id="features" className="text-2xl font-semibold tracking-tight">
          Everything a business app needs on day one
        </h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Own the code, keep what you want, delete what you do not.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-primary dark:bg-tint">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Ready to build?</h2>
          <p className="max-w-xl opacity-90">
            Sign in with an emailed code, open Admin, and make your first change through an action.
          </p>
          <div>
            <Link href="/login" className={buttonVariants({ size: 'lg' })}>
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
