import type { ReactElement, ReactNode } from 'react';

export interface SectionProps {
  title?: string;
  lead?: string;
  /** A shaded band. */
  tinted?: boolean;
  /** A reading-width column (a form, prose) instead of the full content width. */
  narrow?: boolean;
  children: ReactNode;
}

/**
 * One band of a public page: an optional heading and lead, then whatever the page puts inside - a
 * feature grid, a form, text. Public pages are a stack of these; the frame draws nothing around them.
 *
 *   <Section title="What we offer" lead="Three ways to work with us.">
 *     <FeatureGrid features={SERVICES} />
 *   </Section>
 */
export function Section({ title, lead, tinted, narrow, children }: SectionProps): ReactElement {
  const className = ['section', tinted ? 'section-tinted' : '', narrow ? 'section-narrow' : ''].filter(Boolean).join(' ');
  return (
    <section className={className} aria-label={title}>
      <div className="section-inner">
        {title || lead ? (
          <header className="section-head">
            {title ? <h2 className="section-title">{title}</h2> : null}
            {lead ? <p className="section-lead">{lead}</p> : null}
          </header>
        ) : null}
        {children}
      </div>
    </section>
  );
}
