import type * as React from 'react';

/** A /brand section: an anchor target for the table of contents (id) and a heading. */
export function BrandSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="scroll-mt-20 border-t border-hairline py-10"
    >
      <h2 id={`${id}-h`} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <p className="mb-5 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}
