import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrivacyPolicyScreen } from './PrivacyPolicyScreen';

/**
 * The policy page is static content with no props and no session, so rendering it the way a signed-out
 * visitor receives it needs nothing injected: the markup below is exactly what /privacy serves before
 * anybody logs in.
 */
const html = renderToStaticMarkup(<PrivacyPolicyScreen />);

describe('PrivacyPolicyScreen', () => {
  it('renders for a signed-out visitor with no props, session or data', () => {
    expect(PrivacyPolicyScreen.length).toBe(0);
    expect(html.length).toBeGreaterThan(0);
  });

  it('carries the page test hook on its root element', () => {
    expect(html).toContain('data-testid="privacy-policy-page-page"');
    expect(html.indexOf('data-testid="privacy-policy-page-page"')).toBeLessThan(html.indexOf('Privacy policy'));
  });

  it('is headed "Privacy policy"', () => {
    expect(html).toContain('Privacy policy');
  });

  it('states what is stored, including the one-way hashes and the signed-in sessions', () => {
    expect(html).toContain('full name');
    expect(html).toContain('mobile number');
    expect(html).toContain('one-way hashes');
    expect(html).toContain('boarding points');
    expect(html).toContain('browser sessions');
  });

  it('states that nothing is shared with any outside company', () => {
    expect(html).toContain('Nobody.');
    expect(html).toContain('Services we do not use');
    expect(html).toContain('analytics');
    expect(html).toContain('advertising');
    expect(html).toContain('social login');
  });

  it('states that no money moves through the product', () => {
    expect(html).toContain('No money moves through this product');
    expect(html).toContain('cash or by UPI');
  });

  it('states how long data is kept and how to have the account deleted', () => {
    expect(html).toContain('How long we keep your data');
    expect(html).toContain('Deleting your account and its data');
    expect(html).toContain('mailto:abhishek.shete.sa+6@gmail.com');
    expect(html).toContain('bus-booking-app.apps.stage.vowworks.ai');
  });

  it('shows no database identifier in its visible text', () => {
    expect(html).not.toMatch(/>\s*\d{6,}\s*</);
  });
});
