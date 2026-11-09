import { activityLog, contacts, contactTags, eq, events, getDb, tags } from '@app/db';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { guestActor } from '../src/access';
import {
  addContactTags,
  archiveContact,
  callAction,
  createContact,
  exportActivityCsv,
  exportContactsCsv,
  importContacts,
  bulkAddContactTags,
  bulkArchiveContacts,
} from '../src/actions';
import { parseCsv, toCsv } from '../src/csv';
import { assertLocalDatabase, makeActor, resetDatabase } from './setup';

beforeAll(assertLocalDatabase);
beforeEach(resetDatabase);

const ok = async <T>(p: Promise<{ ok: boolean }>) => {
  const r = (await p) as { ok: boolean; data?: T; error?: unknown };
  if (!r.ok) throw new Error(JSON.stringify(r.error));
  return r.data as T;
};
const count = async (type: string) =>
  (await getDb().select().from(events)).filter((e) => e.type === type).length;

describe('csv helpers', () => {
  it('quotes commas, quotes and newlines and defuses spreadsheet formulas', () => {
    const csv = toCsv(
      ['a', 'b'],
      [
        ['x,y', 'say "hi"'],
        ['=1+1', 'two\nlines'],
        [null, new Date('2026-01-02T03:04:05Z')],
      ],
    );
    expect(csv).toBe(
      'a,b\r\n"x,y","say ""hi"""\r\n\'=1+1,"two\nlines"\r\n,2026-01-02T03:04:05.000Z\r\n',
    );
    expect(parseCsv(csv.replace("'=1+1", 'plain'))).toEqual([
      ['a', 'b'],
      ['x,y', 'say "hi"'],
      ['plain', 'two\nlines'],
      ['', '2026-01-02T03:04:05.000Z'],
    ]);
  });

  it('parses BOMs, CRLF, quoted fields and skips blank lines', () => {
    expect(parseCsv('﻿name,email\r\n\r\n"Ann, Jr.",ann@x.com\n')).toEqual([
      ['name', 'email'],
      ['Ann, Jr.', 'ann@x.com'],
    ]);
  });
});

describe('exports', () => {
  it('contacts.exportCsv returns a CSV of the filtered contacts and writes an activity row', async () => {
    const owner = await makeActor(['owner']);
    await ok(
      callAction(
        createContact,
        { firstName: 'Ann', email: 'ann@example.com', tags: ['customer'], notes: '=cmd()' },
        owner,
      ),
    );
    const bo = await ok<{ id: string }>(
      callAction(
        createContact,
        { firstName: 'Bo', email: 'bo@example.com', tags: ['lead'] },
        owner,
      ),
    );
    await ok(callAction(archiveContact, { id: bo.id }, owner));
    const all = await ok<{ csv: string; rows: number; truncated: boolean; filename: string }>(
      callAction(exportContactsCsv, {}, owner),
    );
    expect(all.filename).toMatch(/^contacts-\d{4}-\d\d-\d\d\.csv$/);
    expect(all.rows).toBe(2); // Olivia (the owner) and Ann; Bo is archived
    const rows = parseCsv(all.csv);
    expect(rows[0]).toContain('email');
    expect(all.csv).toContain("'=cmd()");
    const ann = rows.find((r) => r.includes('ann@example.com'))!;
    expect(ann[rows[0]!.indexOf('tags')]).toBe('customer');
    expect(
      (await ok<{ rows: number }>(callAction(exportContactsCsv, { includeArchived: true }, owner)))
        .rows,
    ).toBe(3);
    expect(
      (
        await ok<{ rows: number }>(
          callAction(exportContactsCsv, { tag: 'lead', includeArchived: true }, owner),
        )
      ).rows,
    ).toBe(1);
    expect(
      (await ok<{ rows: number }>(callAction(exportContactsCsv, { search: 'ann' }, owner))).rows,
    ).toBe(1);
    const logged = (await getDb().select().from(activityLog)).filter(
      (a) => a.action === 'contacts.exportCsv',
    );
    expect(logged.length).toBeGreaterThan(0);
    expect(logged[0]!.summary).toContain('Exported');
  });

  it('activity.exportCsv exports a period without the inputs', async () => {
    const owner = await makeActor(['owner']);
    await ok(callAction(createContact, { firstName: 'Ann', email: 'ann@example.com' }, owner));
    const r = await ok<{ csv: string; rows: number }>(
      callAction(exportActivityCsv, { kind: 'change' }, owner),
    );
    expect(r.rows).toBeGreaterThan(0);
    expect(r.csv).toContain('contacts.create');
    expect(r.csv).not.toContain('ann@example.com');
    const future = await ok<{ rows: number }>(
      callAction(exportActivityCsv, { from: '2999-01-01' }, owner),
    );
    expect(future.rows).toBe(0);
  });

  it('exports are for data.export holders only (owner/admin/manager)', async () => {
    for (const actor of [await makeActor(['staff']), await makeActor([])]) {
      expect(await callAction(exportContactsCsv, {}, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
      expect(await callAction(exportActivityCsv, {}, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
    }
    expect(await callAction(exportContactsCsv, {}, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
    expect((await callAction(exportContactsCsv, {}, await makeActor(['manager']))).ok).toBe(true);
  });
});

describe('contacts.import', () => {
  const file = [
    'first_name,last_name,Email,Phone,tags',
    'Ann,Archer,ann@example.com,(816) 555-0101,customer;vip',
    'Bo,Baker,bo@example.com,,',
    'Cy,Cook,not-an-email,,',
    'Dee,Dunn,ann@example.com,,',
    'Eve,Ellis,eve@example.com,555,',
    'Fay,Fox,fay@example.com,,nonsense',
    'Gus,Gray,existing@example.com,,',
  ].join('\n');
  type Report = {
    dryRun: boolean;
    total: number;
    created: number;
    duplicates: number;
    invalid: number;
    problems: { row: number; status: string; message: string }[];
  };

  async function world() {
    const manager = await makeActor(['manager']);
    await ok(
      callAction(createContact, { firstName: 'Existing', email: 'existing@example.com' }, manager),
    );
    await getDb().insert(tags).values({ slug: 'vip', label: 'VIP', kind: 'label' });
    return manager;
  }

  it('dry run validates everything and saves nothing', async () => {
    const manager = await world();
    const before = (await getDb().select().from(contacts)).length;
    const r = await ok<Report>(callAction(importContacts, { csv: file, dryRun: true }, manager));
    expect(r).toMatchObject({ dryRun: true, total: 7, created: 2, duplicates: 2, invalid: 3 });
    expect(r.problems.map((p) => [p.row, p.status])).toEqual([
      [4, 'invalid'], // Cy: bad email
      [5, 'duplicate'], // Dee: ann@ appears earlier in the file
      [6, 'invalid'], // Eve: phone 555
      [7, 'invalid'], // Fay: unknown tag
      [8, 'duplicate'], // Gus: exists already
    ]);
    expect(r.problems[0]!.message).toMatch(/email/i);
    expect((await getDb().select().from(contacts)).length).toBe(before);
    expect(await count('contact.created')).toBe(1); // only the one the test created itself
  });

  it('imports the valid rows (source "import", tags, events), skips the rest, and is not repeatable', async () => {
    const manager = await world();
    const r = await ok<Report>(callAction(importContacts, { csv: file, tags: ['lead'] }, manager));
    expect(r).toMatchObject({ dryRun: false, created: 2, duplicates: 2, invalid: 3 });
    const ann = (
      await getDb().select().from(contacts).where(eq(contacts.email, 'ann@example.com'))
    )[0]!;
    expect(ann).toMatchObject({
      firstName: 'Ann',
      lastName: 'Archer',
      phone: '+18165550101',
      source: 'import',
    });
    const slugs = async (id: string) =>
      (
        await getDb()
          .select({ slug: tags.slug })
          .from(contactTags)
          .innerJoin(tags, eq(tags.id, contactTags.tagId))
          .where(eq(contactTags.contactId, id))
      )
        .map((t) => t.slug)
        .sort();
    expect(await slugs(ann.id)).toEqual(['customer', 'lead', 'vip']);
    expect(await count('contact.created')).toBe(3);
    // The same file again creates nothing new: everything valid is now a duplicate.
    const again = await ok<Report>(callAction(importContacts, { csv: file }, manager));
    expect(again).toMatchObject({ created: 0, duplicates: 4, invalid: 3 });
  });

  it('refuses unknown tags, unrecognised columns, huge files and people without users.manage', async () => {
    const manager = await world();
    expect(await callAction(importContacts, { csv: file, tags: ['nope'] }, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    expect(await callAction(importContacts, { csv: 'foo,bar\n1,2' }, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    const huge = ['email', ...Array.from({ length: 2001 }, (_, i) => `u${i}@example.com`)].join(
      '\n',
    );
    expect(await callAction(importContacts, { csv: huge }, manager)).toMatchObject({
      ok: false,
      error: { code: 'invalid_input' },
    });
    const staff = await makeActor(['staff']);
    expect(await callAction(importContacts, { csv: file }, staff)).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    });
    expect(await callAction(importContacts, { csv: file }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});

describe('bulk actions', () => {
  async function many(actor: Awaited<ReturnType<typeof makeActor>>, n = 4) {
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      out.push(
        (
          await ok<{ id: string }>(
            callAction(createContact, { firstName: `P${i}`, email: `p${i}@example.com` }, actor),
          )
        ).id,
      );
    }
    return out;
  }

  it('bulkAddTags tags everyone in one go, one activity row, events only for real additions', async () => {
    const manager = await makeActor(['manager']);
    const ids = await many(manager);
    await ok(callAction(addContactTags, { id: ids[0]!, tags: ['customer'] }, manager));
    const taggedBefore = await count('contact.tagged');
    const activityBefore = (await getDb().select().from(activityLog)).length;
    expect(
      await ok(callAction(bulkAddContactTags, { ids, tags: ['customer', 'lead'] }, manager)),
    ).toEqual({ contacts: 4, tagged: 4 });
    expect(
      await ok(callAction(bulkAddContactTags, { ids, tags: ['customer', 'lead'] }, manager)),
    ).toEqual({ contacts: 4, tagged: 0 });
    expect(await count('contact.tagged')).toBe(taggedBefore + 4);
    const bulk = (await getDb().select().from(activityLog)).filter(
      (a) => a.action === 'contacts.bulkAddTags',
    );
    expect(bulk).toHaveLength(2);
    expect(bulk[0]!.summary ?? bulk[1]!.summary).toContain('Tagged 4 of 4 contacts');
    expect((await getDb().select().from(activityLog)).length).toBe(activityBefore + 2);
  });

  it('is all-or-nothing: one unknown id or tag fails the whole call', async () => {
    const manager = await makeActor(['manager']);
    const ids = await many(manager, 2);
    expect(
      await callAction(
        bulkAddContactTags,
        { ids: [...ids, crypto.randomUUID()], tags: ['lead'] },
        manager,
      ),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(
      await callAction(bulkAddContactTags, { ids, tags: ['lead', 'nope'] }, manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
    expect((await getDb().select().from(contactTags)).length).toBe(0);
    expect(
      await callAction(bulkAddContactTags, { ids: [], tags: ['lead'] }, manager),
    ).toMatchObject({ ok: false, error: { code: 'invalid_input' } });
  });

  it('bulkArchive archives the active ones, skips archived, and never archives the last owner', async () => {
    const owner = await makeActor(['owner']);
    const ids = await many(owner, 3);
    await ok(callAction(archiveContact, { id: ids[0]! }, owner));
    expect(await ok(callAction(bulkArchiveContacts, { ids }, owner))).toEqual({
      archived: 2,
      alreadyArchived: 1,
    });
    expect(await count('contact.archived')).toBe(3);
    expect(
      await callAction(bulkArchiveContacts, { ids: [owner.contactId!, ...ids] }, owner),
    ).toMatchObject({ ok: false, error: { code: 'conflict' } });
    expect(
      (await getDb().select().from(contacts).where(eq(contacts.id, owner.contactId!)))[0]!.status,
    ).toBe('active');
  });

  it('are refused to staff, customers and visitors', async () => {
    const id = [crypto.randomUUID()];
    for (const actor of [await makeActor(['staff']), await makeActor([])]) {
      expect(
        await callAction(bulkAddContactTags, { ids: id, tags: ['lead'] }, actor),
      ).toMatchObject({ ok: false, error: { code: 'forbidden' } });
      expect(await callAction(bulkArchiveContacts, { ids: id }, actor)).toMatchObject({
        ok: false,
        error: { code: 'forbidden' },
      });
    }
    expect(await callAction(bulkArchiveContacts, { ids: id }, guestActor())).toMatchObject({
      ok: false,
      error: { code: 'unauthenticated' },
    });
  });
});
