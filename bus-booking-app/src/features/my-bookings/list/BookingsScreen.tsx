// src/screens/BookingsScreen.tsx
//
// THE APPROVED LOOK OF /bookings — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function BookingsScreen(): JSX.Element {
  return (
    <div data-screen="/bookings">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Your trips</div>{' '}<h1 className="page-title">My bookings</h1>{' '}<p className="page-description">Review upcoming journeys and past or cancelled bookings.</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-secondary" data-goto="/search">Search buses</button>{' '}</div>{' '}</div>{' '}<div className="tabs" role="tablist">{' '}<button type="button" className="tab" role="tab" aria-selected="true" data-toast="Done — this is a preview, so nothing is saved.">Upcoming <span className="tab-count">3</span></button>{' '}<button type="button" className="tab" role="tab" aria-selected="false" data-toast="Past & cancelled bookings">Past &amp; cancelled <span className="tab-count">2</span></button>{' '}</div>{' '}<ul className="list-rows">{' '}<li className="list-row" data-goto="/bookings/:bookingId">{' '}<div className="list-row-text">{' '}<span className="list-row-title">BB-10452 · Pune – Mumbai</span>{' '}<span className="list-row-sub">12/06/2024 · 9:30 PM departure · Dadar boarding · Seats A1, A2 · Ramesh Kulkarni, Sita Kulkarni</span>{' '}</div>{' '}<span className="badge badge-info">Booked</span>{' '}<span className="text-strong">₹1,200</span>{' '}</li>{' '}<li className="list-row" data-goto="/bookings/:bookingId">{' '}<div className="list-row-text">{' '}<span className="list-row-title">BB-10455 · Nashik – Pune</span>{' '}<span className="list-row-sub">14/06/2024 · 6:15 AM departure · Nashik Road · Seat B3 · Asha Patil</span>{' '}</div>{' '}<span className="badge badge-info">Booked</span>{' '}<span className="text-strong">₹550</span>{' '}</li>{' '}<li className="list-row" data-goto="/bookings/:bookingId">{' '}<div className="list-row-text">{' '}<span className="list-row-title">BB-10460 · Mumbai – Goa</span>{' '}<span className="list-row-sub">20/06/2024 · 10:00 PM departure · Borivali · Seats S4, S5, S6 · Vikram, Neha, Omkar</span>{' '}</div>{' '}<span className="badge badge-info">Booked</span>{' '}<span className="text-strong">₹2,400</span>{' '}</li>{' '}</ul>


    </div>
  );
}

export default BookingsScreen;
