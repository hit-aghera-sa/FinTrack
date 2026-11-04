// src/screens/BookingsDetailConfirmedScreen.tsx
//
// THE APPROVED LOOK OF /bookings/:bookingId/confirmed — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function BookingsDetailConfirmedScreen(): JSX.Element {
  return (
    <div data-screen="/bookings/:bookingId/confirmed">


  <div className="empty-state">{' '}<div className="empty-state-art">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"></path></svg>{' '}</div>{' '}<h1 className="empty-state-title">Booking confirmed</h1>{' '}<p className="empty-state-message">Booking ID <span className="text-strong">BB-10452</span> · Shree Travels · AC Sleeper · Pune – Mumbai · 12/06/2024 · 9:30 PM · Dadar boarding · Seats A1, A2 · Ramesh Kulkarni, Sita Kulkarni</p>{' '}<div className="notice notice-success" style={{ marginTop: "1rem" }}>{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 1 1-10 0V7a5 5 0 0 1 5-5z"></path></svg>
      Pay ₹1,200 in cash or UPI to the bus staff when boarding.
    </div>{' '}<div className="empty-state-action" style={{ display: "flex", gap: "var(--space-2)" }}>{' '}<button type="button" className="button button-primary" data-goto="/bookings">View my bookings</button>{' '}<button type="button" className="button button-secondary" data-goto="/search">Search buses</button>{' '}</div>{' '}</div>


    </div>
  );
}

export default BookingsDetailConfirmedScreen;
