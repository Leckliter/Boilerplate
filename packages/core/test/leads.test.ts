import {
  contacts,
  contactTags,
  eq,
  getDb,
  inquiries,
  newsletterSubscriptions,
  notificationDeliveries,
  notifications,
  tags,
} from '@app/db';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor, withRequest } from '../src/access';
import { callAction } from '../src/actions';
import {
  archiveInquiry,
  createInquiry,
  getInquiry,
  listInquiries,
  updateInquiry,
} from '../src/actions/inquiries';
import {
  confirmNewsletter,
  subscribeNewsletter,
  unsubscribeNewsletter,
} from '../src/actions/newsletter';
import { setSendersForTests } from '../src/notifications';
import { signLink } from '../src/notifications/tokens';
import { assertLocalDatabase, ifEventsEnabled, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);
afterEach(() => setSendersForTests(null));

const visitor = (ip = '203.0.113.9') => withRequest(guestActor('web'), { id: 'req', ip });
const ok = async <T>(p: Promise<{ ok: boolean }>) => {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
};
const tagsOf = async (contactId: string) =>
  (
    await getDb()
      .select({ slug: tags.slug })
      .from(contactTags)
      .innerJoin(tags, eq(tags.id, contactTags.tagId))
      .where(eq(contactTags.contactId, contactId))
  ).map((t) => t.slug);

const form = (over: object = {}) => ({
  name: 'Pat Example',
  email: 'Pat@Example.com',
  message: 'Do you take weekend appointments?',
  subject: 'Weekends',
  ...over,
});

describe('inquiries.create (public form)', () => {
  it('stores the message, creates a lead contact, emits inquiry.created and tells staff', async () => {
    const manager = await makeActor(['manager']);
    await makeActor(['staff']); // no inquiries.manage: not notified
    expect(await ok(callAction(createInquiry, form(), visitor()))).toEqual({ received: true });

    const [row] = await getDb().select().from(inquiries);
    expect(row).toMatchObject({
      name: 'Pat Example',
      email: 'pat@example.com',
      status: 'new',
      source: 'website',
    });
    const [lead] = await getDb().select().from(contacts).where(eq(contacts.id, row!.contactId!));
    expect(lead).toMatchObject({ firstName: 'Pat', lastName: 'Example', source: 'website' });
    expect(await tagsOf(lead!.id)).toEqual(['lead']);
    await ifEventsEnabled(undefined, (all) => {
      const types = all.map((e) => e.type);
      expect(types).toContain('inquiry.created');
      expect(types).toContain('contact.created');
    });
    const told = await getDb().select().from(notifications);
    expect(told.map((n) => [n.type, n.contactId])).toEqual([
      ['staff.newInquiry', manager.contactId],
    ]);
    expect(told[0]!.content.url).toBe(`/admin/inquiries/${row!.id}`);
  });

  it('links an existing contact instead of duplicating or re-tagging them', async () => {
    const [customer] = await getDb()
      .insert(contacts)
      .values({ displayName: 'Pat C', email: 'pat@example.com', source: 'seed' })
      .returning();
    await ok(callAction(createInquiry, form(), visitor()));
    expect(
      await getDb().select().from(contacts).where(eq(contacts.email, 'pat@example.com')),
    ).toHaveLength(1);
    expect((await getDb().select().from(inquiries))[0]!.contactId).toBe(customer!.id);
    expect(await tagsOf(customer!.id)).toEqual([]);
    await ifEventsEnabled('inquiry.created', (e) =>
      expect(e[0]!.data).toMatchObject({ newContact: false }),
    );
  });

  it('silently drops a filled honeypot, rejects a short message, and rate-limits by IP', async () => {
    expect(
      await ok(callAction(createInquiry, form({ website: 'http://spam.example' }), visitor())),
    ).toEqual({ received: true });
    expect(await getDb().select().from(inquiries)).toHaveLength(0);
    expect(await getDb().select().from(contacts)).toHaveLength(0);
    expect(await callAction(createInquiry, form({ message: 'hi' }), visitor())).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await callAction(createInquiry, form({ email: 'nope' }), visitor())).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    const ip = '198.51.100.7';
    for (let i = 0; i < 5; i++)
      await callAction(createInquiry, form({ message: `Hello number ${i}` }), visitor(ip));
    expect(await callAction(createInquiry, form(), visitor(ip))).toMatchObject({
      ok: false,
      error: { code: 'rate_limited' },
    });
  });
});

describe('inquiries staff actions', () => {
  async function seed() {
    await ok(callAction(createInquiry, form(), visitor()));
    await ok(
      callAction(
        createInquiry,
        form({
          name: 'Sam',
          email: 'sam@example.com',
          message: 'Pricing for ten users?',
          subject: 'Pricing',
        }),
        visitor('203.0.113.10'),
      ),
    );
    return (await getDb().select().from(inquiries)).find((i) => i.name === 'Pat Example')!;
  }

  it('list filters by status and search and counts per status; get returns the contact', async () => {
    const manager = await makeActor(['manager']);
    const pat = await seed();
    const all = await ok<{
      inquiries: { id: string }[];
      total: number;
      counts: Record<string, number>;
    }>(callAction(listInquiries, {}, manager));
    expect(all.total).toBe(2);
    expect(all.counts).toMatchObject({ new: 2, archived: 0 });
    const found = await ok<{ inquiries: { name: string }[] }>(
      callAction(listInquiries, { q: 'pricing' }, manager),
    );
    expect(found.inquiries.map((i) => i.name)).toEqual(['Sam']);
    const one = await ok<{ contact: { tags: { slug: string }[] } | null; message: string }>(
      callAction(getInquiry, { id: pat.id }, manager),
    );
    expect(one.message).toContain('weekend');
    expect(one.contact?.tags.map((t) => t.slug)).toEqual(['lead']);
    expect(await callAction(getInquiry, { id: crypto.randomUUID() }, manager)).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    });
  });

  it('update changes status and note (recording who handled it); archive hides it from the list', async () => {
    const manager = await makeActor(['manager']);
    const pat = await seed();
    const updated = await ok<{ status: string; staffNote: string; handledByContactId: string }>(
      callAction(
        updateInquiry,
        { id: pat.id, status: 'in_progress', note: 'Called back' },
        manager,
      ),
    );
    expect(updated).toMatchObject({
      status: 'in_progress',
      staffNote: 'Called back',
      handledByContactId: manager.contactId,
    });
    expect(await callAction(updateInquiry, { id: pat.id }, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    await ok(callAction(archiveInquiry, { id: pat.id }, manager));
    const list = await ok<{ inquiries: unknown[]; total: number }>(
      callAction(listInquiries, {}, manager),
    );
    expect(list.total).toBe(1);
    const archived = await ok<{ total: number }>(
      callAction(listInquiries, { status: 'archived' }, manager),
    );
    expect(archived.total).toBe(1);
  });

  it('is refused to staff without inquiries.manage, customers and visitors', async () => {
    const pat = await seed();
    for (const actor of [await makeActor(['staff']), await makeActor([])]) {
      for (const [action, input] of [
        [listInquiries, {}],
        [getInquiry, { id: pat.id }],
        [updateInquiry, { id: pat.id, status: 'resolved' }],
        [archiveInquiry, { id: pat.id }],
      ] as const) {
        expect(await callAction(action as never, input as never, actor)).toMatchObject({
          ok: false,
          error: { code: 'forbidden' },
        });
      }
    }
    expect(await callAction(listInquiries, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});

describe('newsletter double opt-in', () => {
  const idOf = async (email: string) =>
    (
      await getDb()
        .select()
        .from(newsletterSubscriptions)
        .where(eq(newsletterSubscriptions.email, email))
    )[0]!;

  it('subscribe records a pending subscription and emails a confirmation link; nobody is tagged yet', async () => {
    const res = await ok<{ received: boolean }>(
      callAction(subscribeNewsletter, { email: 'New@Example.com', firstName: 'Nia' }, visitor()),
    );
    expect(res.received).toBe(true);
    const sub = await idOf('new@example.com');
    expect(sub).toMatchObject({ status: 'pending', consentAt: null });
    expect(sub.consentText).toContain('newsletter');
    const [c] = await getDb().select().from(contacts).where(eq(contacts.email, 'new@example.com'));
    expect(await tagsOf(c!.id)).toEqual(['lead']);
    const [n] = await getDb().select().from(notifications);
    expect(n).toMatchObject({ type: 'newsletter.confirm', contactId: c!.id });
    expect(n!.content.url).toMatch(/\/api\/v1\/newsletter\/confirm\?t=/);
    const [d] = await getDb().select().from(notificationDeliveries);
    expect(d).toMatchObject({ channel: 'email', to: 'new@example.com' });
    // Asking twice the same day does not send twice.
    await ok(callAction(subscribeNewsletter, { email: 'new@example.com' }, visitor()));
    expect(await getDb().select().from(notifications)).toHaveLength(1);
  });

  it('confirm subscribes, tags, records consent and emits newsletter.subscribed; unsubscribe undoes it', async () => {
    await ok(callAction(subscribeNewsletter, { email: 'new@example.com' }, visitor()));
    const sub = await idOf('new@example.com');
    const token = signLink('newsletter.confirm', sub.id, 60_000);
    expect(await ok(callAction(confirmNewsletter, { token }, visitor()))).toMatchObject({
      status: 'subscribed',
      email: 'new@example.com',
    });
    await ok(callAction(confirmNewsletter, { token }, visitor())); // twice is fine
    expect(await idOf('new@example.com')).toMatchObject({ status: 'subscribed' });
    expect((await idOf('new@example.com')).consentAt).not.toBeNull();
    expect(await tagsOf(sub.contactId!)).toEqual(expect.arrayContaining(['lead', 'newsletter']));
    await ifEventsEnabled('newsletter.subscribed', (e) => expect(e).toHaveLength(1));

    const unsub = signLink('newsletter.unsubscribe', sub.id, 60_000);
    expect(await ok(callAction(unsubscribeNewsletter, { token: unsub }, visitor()))).toEqual({
      status: 'unsubscribed',
    });
    expect(await idOf('new@example.com')).toMatchObject({ status: 'unsubscribed' });
    expect(await tagsOf(sub.contactId!)).toEqual(['lead']);
  });

  it('a subscribed person is not asked again, and the answer does not reveal it', async () => {
    await ok(callAction(subscribeNewsletter, { email: 'new@example.com' }, visitor()));
    const sub = await idOf('new@example.com');
    await ok(
      callAction(
        confirmNewsletter,
        { token: signLink('newsletter.confirm', sub.id, 60_000) },
        visitor(),
      ),
    );
    const before = (await getDb().select().from(notifications)).length;
    const again = await ok(
      callAction(subscribeNewsletter, { email: 'new@example.com' }, visitor('203.0.113.77')),
    );
    const fresh = await ok(
      callAction(subscribeNewsletter, { email: 'other@example.com' }, visitor('203.0.113.78')),
    );
    expect(again).toEqual(fresh);
    expect((await getDb().select().from(notifications)).length).toBe(before + 1); // only the unknown address got an email
  });

  it('refuses forged, expired and wrong-purpose tokens', async () => {
    await ok(callAction(subscribeNewsletter, { email: 'new@example.com' }, visitor()));
    const sub = await idOf('new@example.com');
    for (const token of [
      'not-a-token-at-all',
      signLink('newsletter.confirm', sub.id, -1000), // expired
      signLink('newsletter.unsubscribe', sub.id, 60_000), // wrong purpose
    ]) {
      expect(await callAction(confirmNewsletter, { token }, visitor())).toMatchObject({
        ok: false,
        error: { code: 'invalid_input' },
      });
    }
    expect((await idOf('new@example.com')).status).toBe('pending');
    expect(await callAction(unsubscribeNewsletter, {}, visitor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });

  it('a signed-in person can unsubscribe themself without a token; honeypot subscribes nobody', async () => {
    const me = await makeActor([]);
    const [mine] = await getDb().select().from(contacts).where(eq(contacts.id, me.contactId!));
    await ok(callAction(subscribeNewsletter, { email: mine!.email! }, visitor()));
    await ok(
      callAction(
        confirmNewsletter,
        { token: signLink('newsletter.confirm', (await idOf(mine!.email!)).id, 60_000) },
        visitor(),
      ),
    );
    expect(await ok(callAction(unsubscribeNewsletter, {}, me))).toEqual({ status: 'unsubscribed' });
    await ok(
      callAction(subscribeNewsletter, { email: 'bot@example.com', website: 'x' }, visitor()),
    );
    expect(
      await getDb()
        .select()
        .from(newsletterSubscriptions)
        .where(eq(newsletterSubscriptions.email, 'bot@example.com')),
    ).toHaveLength(0);
  });
});
