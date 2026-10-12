import type { ReactElement } from 'react';
import { FeatureGrid } from '../components/FeatureGrid';
import { Hero } from '../components/Hero';
import { Section } from '../components/Section';
import { SAMPLE_SERVICES, SAMPLE_STEPS } from '../data/sampleData';
import { Link } from '../router';

/**
 * SAMPLE - the landing page: a hero, then sections. Its route sets `heading: false`, so the page lays
 * itself out in full-width bands. Not part of a real site.
 */
export function SampleHomeScreen(): ReactElement {
  return (
    <>
      <Hero
        eyebrow="Design and photography"
        title="Pictures and pages that feel like your business"
        lead="A small studio for small businesses: portraits, brand photography and event coverage, delivered within a week."
        primary={{ label: 'Book a session', to: '/book' }}
        secondary={{ label: 'See services', to: '/services' }}
      />
      <Section title="What we offer" lead="Three ways to work with us. Every session includes edited, web-ready files.">
        <FeatureGrid features={SAMPLE_SERVICES} />
      </Section>
      <Section tinted title="How booking works" lead="Request a slot, we confirm within a day, and you pay after the session.">
        <FeatureGrid features={SAMPLE_STEPS} />
        <p className="text-sm text-muted">
          Questions first?{' '}
          <Link className="text-link" to="/book">
            Send a note with your request
          </Link>
          .
        </p>
      </Section>
    </>
  );
}
