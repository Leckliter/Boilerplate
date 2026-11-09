import { buttonVariants } from '@app/ui/components/button';
import { Card } from '@app/ui/components/card';
import {
  ArrowRightIcon,
  BugIcon,
  KeyIcon,
  LightningIcon,
  PulseIcon,
  QuotesIcon,
  RobotIcon,
  ShieldCheckIcon,
  StarIcon,
} from '@app/ui/components/icons';
import { LinkButton } from '@app/ui/components/link-button';
import type { Metadata } from 'next';
import Link from 'next/link';

import { Faq, type FaqItem } from '@/components/site/faq';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: `${SITE.name}: ${SITE.tagline}` },
  description: SITE.description,
  alternates: { canonical: '/' },
};

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
    text: 'React to events, send email, text and push with consent and delivery tracking, retry what fails.',
  },
];

// Placeholders: replace with real customers (or delete the section) before you launch.
const QUOTES = [
  {
    quote: 'We went from idea to a working customer portal in a weekend.',
    name: 'Alex Rivera',
    role: 'Founder, Example Co.',
  },
  {
    quote: 'The error references alone have saved us hours of back and forth.',
    name: 'Sam Okafor',
    role: 'Operations, Sample Studio',
  },
  {
    quote: 'Our assistant can do everything staff can, and nothing more. That’s the point.',
    name: 'Jordan Lee',
    role: 'CTO, Placeholder Inc.',
  },
];

const FAQ: FaqItem[] = [
  {
    q: 'What do I get?',
    a: 'A public website, a customer portal, an admin and an API, all running on one set of business actions, with logging, errors, notifications and automations already wired in.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'To change how it looks or what it does, an AI coding assistant is enough: the rules the code follows are written down and checked automatically.',
  },
  {
    q: 'Where is my data kept?',
    a: 'In a Postgres database you own (Neon or Supabase), and files in your own S3-compatible bucket. Nothing is sent to us.',
  },
  {
    q: 'Do you track visitors?',
    a: 'No. The public site sets no cookies and loads no analytics. If you add analytics, tell your visitors.',
  },
  {
    q: 'How do I get help?',
    a: 'Read the help pages, or send us a message from the contact page and we’ll reply by email.',
  },
];

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-heading" className="border-b border-border bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:px-6 sm:py-24">
          <p className="w-fit rounded-full bg-tint px-3 py-1 text-xs font-medium text-muted-foreground ring ring-border">
            Starter kit
          </p>
          <h1
            id="hero-heading"
            className="max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl"
          >
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

      <section aria-labelledby="proof" className="border-y border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="proof" className="text-2xl font-semibold tracking-tight">
            What people say
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Placeholder quotes: replace them with real ones, or remove this section.
          </p>
          <ul className="mt-8 grid gap-4 md:grid-cols-3">
            {QUOTES.map((q) => (
              <li key={q.name}>
                <figure className="grid h-full content-between gap-4 rounded-lg bg-background p-5 ring ring-border">
                  <div className="grid gap-3">
                    <QuotesIcon aria-hidden weight="fill" className="size-5 text-primary" />
                    <div
                      className="flex gap-0.5 text-primary"
                      role="img"
                      aria-label="Five out of five stars"
                    >
                      {Array.from({ length: 5 }, (_, i) => (
                        <StarIcon key={i} aria-hidden weight="fill" className="size-4" />
                      ))}
                    </div>
                    <blockquote className="text-base text-balance">{q.quote}</blockquote>
                  </div>
                  <figcaption className="text-sm">
                    <span className="font-medium">{q.name}</span>
                    <span className="block text-muted-foreground">{q.role}</span>
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Faq items={FAQ} />

      <section aria-labelledby="cta" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-4 rounded-2xl bg-primary p-8 text-primary-foreground sm:p-12">
          <h2 id="cta" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Ready to build?
          </h2>
          <p className="max-w-xl">
            Sign in with an emailed code, open Admin, and make your first change through an action.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={buttonVariants({ size: 'lg' })}>
              Sign in
            </Link>
            <Link
              href="/contact"
              className={buttonVariants({
                size: 'lg',
                variant: 'ghost',
                className: 'text-primary-foreground hover:bg-primary-foreground/10',
              })}
            >
              Talk to us
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
