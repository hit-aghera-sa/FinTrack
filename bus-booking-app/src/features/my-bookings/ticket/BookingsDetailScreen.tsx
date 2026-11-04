// src/screens/BookingsDetailScreen.tsx
//
// THE APPROVED LOOK OF /bookings/:bookingId — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function BookingsDetailScreen(): JSX.Element {
  return (
    <div data-screen="/bookings/:bookingId">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Ticket</div>{' '}<h1 className="page-title">Ticket</h1>{' '}<p className="page-description">Show this screen to the bus staff when boarding.</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-secondary" data-goto="/bookings">Back</button>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-header">{' '}<div className="card-heading">{' '}<div className="card-icon">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="12" rx="2"></rect><path d="M3 11h18"></path></svg>{' '}</div>{' '}<div>{' '}<div className="card-title">Shree Travels · AC Sleeper</div>{' '}<div className="card-description">Pune – Mumbai · 12/06/2024</div>{' '}</div>{' '}</div>{' '}<span className="badge badge-info">Booked</span>{' '}</div>{' '}<div className="card-body">{' '}<dl className="detail-list">{' '}<div>{' '}<dt>Booking ID</dt>{' '}<dd>BB-10452</dd>{' '}</div>{' '}<div>{' '}<dt>Departure</dt>{' '}<dd>9:30 PM</dd>{' '}</div>{' '}<div>{' '}<dt>Arrival</dt>{' '}<dd>5:00 AM +1 day</dd>{' '}</div>{' '}<div>{' '}<dt>Boarding point</dt>{' '}<dd>Dadar, near TT Circle · 9:00 PM</dd>{' '}</div>{' '}<div>{' '}<dt>Seats</dt>{' '}<dd>A1, A2</dd>{' '}</div>{' '}<div>{' '}<dt>Fare per seat</dt>{' '}<dd>₹600</dd>{' '}</div>{' '}<div className="is-wide">{' '}<dt>Passengers</dt>{' '}<dd>Ramesh Kulkarni (34, Male) · Sita Kulkarni (31, Female)</dd>{' '}</div>{' '}</dl>{' '}<div className="notice notice-success" style={{ marginTop: "1rem" }}>{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a5 5 0 0 1 5 5v2a5 5 0 1 1-10 0V7a5 5 0 0 1 5-5z"></path></svg>
        Pay ₹1,200 in cash or UPI to the bus staff when boarding.
      </div>{' '}</div>{' '}<div className="card-footer">{' '}<button type="button" className="button button-danger" data-toast="Cancel this booking?">Cancel booking</button>{' '}</div>{' '}</div>


    </div>
  );
}

export default BookingsDetailScreen;
