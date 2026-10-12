import type { ReactElement, ReactNode } from 'react';
import { Link } from '../router';

export interface HeroProps {
  /** A short label above the headline - the category, the place. */
  eyebrow?: string;
  title: string;
  /** The line under the headline. */
  lead?: string;
  /** The main action: `{ label, to }`. */
  primary?: { label: string; to: string };
  /** A quieter second action. */
  secondary?: { label: string; to: string };
  /** Draw on the soft brand tint rather than the plain canvas. Defaults to true. */
  tinted?: boolean;
  children?: ReactNode;
}

/**
 * The opening band of a public page: a headline, a line under it, and up to two actions. Full width;
 * the page puts it first, before its `<Section>`s.
 *
 *   <Hero eyebrow="Photography" title="Portraits that feel like you" lead="…"
 *     primary={{ label: 'Book a session', to: bookPath }} secondary={{ label: 'See services', to: servicesPath }} />
 */
export function Hero({ eyebrow, title, lead, primary, secondary, tinted = true, children }: HeroProps): ReactElement {
  return (
    <section className={tinted ? 'hero hero-tinted' : 'hero'}>
      <div className="hero-inner">
        {eyebrow ? <p className="hero-eyebrow">{eyebrow}</p> : null}
        <h1 className="hero-title">{title}</h1>
        {lead ? <p className="hero-lead">{lead}</p> : null}
        {primary || secondary ? (
          <div className="hero-actions">
            {primary ? (
              <Link className="hero-action hero-action-primary" to={primary.to}>
                {primary.label}
              </Link>
            ) : null}
            {secondary ? (
              <Link className="hero-action hero-action-secondary" to={secondary.to}>
                {secondary.label}
              </Link>
            ) : null}
          </div>
        ) : null}
        {children}
      </div>
    </section>
  );
}
