// src/screens/PrivacyScreen.tsx
//
// THE APPROVED LOOK OF /privacy — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function PrivacyScreen(): JSX.Element {
  return (
    <div data-screen="/privacy">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Legal</div>{' '}<h1 className="page-title">Privacy policy</h1>{' '}<p className="page-description">What we store, why, and how to have it deleted.</p>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-body">{' '}<div className="form-section">{' '}<h2 className="form-section-title">What we store</h2>{' '}<p className="form-section-lead">Your full name, mobile number (used only as your login identifier), your password and security answer — kept only as one-way hashes that cannot be reversed — your bookings, passengers and boarding points, and the list of browser sessions signed in to your account.</p>{' '}</div>{' '}<div className="form-section">{' '}<h2 className="form-section-title">Who we share it with</h2>{' '}<p className="form-section-lead">Nobody. Nothing is shared with, and no request is made to, any outside company. No payment, email, SMS, or advertising provider is contacted by this product.</p>{' '}</div>{' '}<div className="form-section">{' '}<h2 className="form-section-title">How payment works</h2>{' '}<p className="form-section-lead">No money moves through this product. The fare shown at booking is handed to the bus staff in cash or by UPI when boarding.</p>{' '}</div>{' '}<div className="form-section">{' '}<h2 className="form-section-title">How long we keep it, and deletion</h2>{' '}<p className="form-section-lead">Your data is kept for as long as your account exists. You can delete your account and all of its data at any time from your Profile; this cancels and removes your bookings, revokes every session, and permanently deletes your account.</p>{' '}</div>{' '}</div>{' '}</div>


    </div>
  );
}

export default PrivacyScreen;
