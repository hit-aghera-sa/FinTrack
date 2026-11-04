// src/features/privacy/PrivacyPolicyScreen.tsx
//
// THE PUBLIC PRIVACY POLICY of Bus Booking App, mounted at /privacy.
//
// Static content only: no props, no session, no fetching, no domain logic — so it renders identically
// for a signed-out visitor and for a signed-in traveller, on a phone browser and on desktop.
//
// The client-approved look (`PrivacyScreen` beside this file) is rendered unchanged; the sections the
// approved preview did not cover are appended below it using the same approved classes, so the page
// states everything the policy must state without rearranging what the client signed off.
import PrivacyScreen from './PrivacyScreen';
import './privacy.css';

/** Where a traveller can reach a person about their data. Shown, never used as a credential. */
const CONTACT_EMAIL = 'abhishek.shete.sa+6@gmail.com';

/** The address this policy covers. */
const APP_ADDRESS = 'bus-booking-app.apps.stage.vowworks.ai';

/** Every outside service this product deliberately does not contact. */
const SERVICES_NOT_USED: readonly string[] = [
  'No email or SMS provider — nothing about your account is ever emailed or texted to you.',
  'No OTP service and no push notification service. Every message in this product is shown on screen.',
  'No payment gateway, card processor or wallet.',
  'No maps, location or geocoding service.',
  'No social login — there is no Google, Facebook or Apple sign-in here.',
  'No advertising network, and no analytics or tracking service of any kind.',
];

/** How long each kind of stored data stays, in plain English. */
const RETENTION: readonly string[] = [
  'Your full name, your mobile number and the one-way hashes of your password and security answer are kept for as long as your account exists.',
  'A booking, the passengers travelling on it and the boarding point you chose stay in your travel history for as long as your account exists, so you can look up a past journey. A cancelled booking is kept the same way, marked as cancelled.',
  'A browser session record is removed as soon as that session is logged out, and every session record is removed the moment you sign out everywhere.',
  'When your account is deleted, everything above is deleted with it. There is no copy anywhere else, because nothing is ever sent outside this product.',
];

export function PrivacyPolicyScreen(): JSX.Element {
  return (
    <div className="privacy-policy" data-testid="privacy-policy-page-page">
      <PrivacyScreen />

      <div className="card" data-testid="privacy-policy-page-details">
        <div className="card-body">
          <div className="form-section">
            <h2 className="form-section-title">Services we do not use</h2>
            <p className="form-section-lead">
              Bus Booking App is self-contained. Every screen you use is served by this website alone, and the website
              makes no request to any outside company on your behalf:
            </p>
            <ul className="privacy-policy-list" data-testid="privacy-policy-page-no-third-parties">
              {SERVICES_NOT_USED.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">How long we keep your data</h2>
            <ul className="privacy-policy-list" data-testid="privacy-policy-page-retention">
              {RETENTION.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>

          <div className="form-section">
            <h2 className="form-section-title">Deleting your account and its data</h2>
            <p className="form-section-lead">
              You can delete your account yourself from Profile at any time, and you can also ask us to delete it for
              you — write to the address below and your account and its data are removed. Deleting the account cancels
              your upcoming bookings and releases their seats, signs out every browser session, and permanently removes
              your name, mobile number, stored hashes, bookings and passengers.
            </p>
            <div className="privacy-policy-contact" data-testid="privacy-policy-page-contact">
              <span>
                Email:{' '}
                <a className="text-link" href={`mailto:${CONTACT_EMAIL}`}>
                  {CONTACT_EMAIL}
                </a>
              </span>
              <span>This policy covers {APP_ADDRESS} and nothing else.</span>
            </div>
          </div>

          <p className="privacy-policy-updated">
            Written in plain English on purpose. If any line here is unclear, ask us at the address above and we will
            explain it.
          </p>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyScreen;
