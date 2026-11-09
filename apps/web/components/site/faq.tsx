import { Accordion, AccordionItem } from '@app/ui/components/accordion';

import { faqJsonLd, JsonLd } from './json-ld';

export type FaqItem = { q: string; a: string };

/** A FAQ: an accordion for people and FAQPage JSON-LD for search engines, from the same list. */
export function Faq({ items, id = 'faq' }: { items: FaqItem[]; id?: string }) {
  return (
    <section aria-labelledby={id} className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="max-w-3xl">
        <h2 id={id} className="text-2xl font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <Accordion className="mt-6">
          {items.map((item, i) => (
            <AccordionItem key={item.q} value={`q${i}`} title={item.q} headingLevel={3}>
              {item.a}
            </AccordionItem>
          ))}
        </Accordion>
        <JsonLd data={faqJsonLd(items)} />
      </div>
    </section>
  );
}
