import type { ReactElement } from 'react';
import { FeatureGrid } from '../components/FeatureGrid';
import { Hero } from '../components/Hero';
import { Section } from '../components/Section';
import { SAMPLE_SERVICES } from '../data/sampleData';

/** SAMPLE - a content page: a short hero and the services in a grid. Not part of a real site. */
export function SampleServicesScreen(): ReactElement {
  return (
    <>
      <Hero
        title="Services"
        lead="Every session includes a pre-call, the shoot, and edited files within a week."
        primary={{ label: 'Book a session', to: '/book' }}
        tinted={false}
      />
      <Section>
        <FeatureGrid features={SAMPLE_SERVICES} />
      </Section>
    </>
  );
}
