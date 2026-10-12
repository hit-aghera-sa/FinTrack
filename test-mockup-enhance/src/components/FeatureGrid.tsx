import type { ReactElement } from 'react';

/** One tile of a feature grid. */
export interface Feature {
  title: string;
  text: string;
  /** A short label above the title - a price, a duration, a category. */
  eyebrow?: string;
}

export interface FeatureGridProps {
  features: readonly Feature[];
}

/**
 * Tiles of equal weight: services, reasons, steps. Three across on a wide screen, one on a phone.
 *
 *   <FeatureGrid features={[{ title: 'Portraits', text: '…', eyebrow: 'From £120' }, …]} />
 */
export function FeatureGrid({ features }: FeatureGridProps): ReactElement {
  return (
    <ul className="feature-grid">
      {features.map((feature) => (
        <li key={feature.title} className="feature-tile">
          {feature.eyebrow ? <p className="feature-eyebrow">{feature.eyebrow}</p> : null}
          <h3 className="feature-title">{feature.title}</h3>
          <p className="feature-text">{feature.text}</p>
        </li>
      ))}
    </ul>
  );
}
