// src/screens/TripsDetailScreen.tsx
//
// THE APPROVED LOOK OF /trips/:tripId — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function TripsDetailScreen(): JSX.Element {
  return (
    <div data-screen="/trips/:tripId">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Mumbai → Pune</div>{' '}<h1 className="page-title">Shree Travels</h1>{' '}<p className="page-description">AC Sleeper · 20/05/2024</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-secondary" data-goto="/search/results">Back to results</button>{' '}<button type="button" className="button button-primary" data-goto="/trips/:tripId/seats">Select seats</button>{' '}</div>{' '}</div>{' '}<div className="page-grid">{' '}<div className="page-grid-column">{' '}<div className="card">{' '}<div className="card-header"><div className="card-title">Trip details</div></div>{' '}<div className="card-body">{' '}<dl className="detail-list">{' '}<div><dt>Departure</dt><dd>9:30 PM</dd></div>{' '}<div><dt>Arrival</dt><dd>5:00 AM +1 day</dd></div>{' '}<div><dt>Bus type</dt><dd>AC Sleeper</dd></div>{' '}<div><dt>Fare per seat</dt><dd>₹850</dd></div>{' '}<div><dt>Total seats</dt><dd>36</dd></div>{' '}<div><dt>Seats left</dt><dd>18</dd></div>{' '}</dl>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-header"><div className="card-title">Boarding points</div></div>{' '}<div className="card-body is-flush">{' '}<ul className="list-rows">{' '}<li className="list-row">{' '}<div className="list-row-text">{' '}<span className="list-row-title">Dadar Bus Depot</span>{' '}<span className="list-row-sub">Pickup at 9:15 PM</span>{' '}</div>{' '}</li>{' '}<li className="list-row">{' '}<div className="list-row-text">{' '}<span className="list-row-title">Andheri East</span>{' '}<span className="list-row-sub">Pickup at 9:35 PM</span>{' '}</div>{' '}</li>{' '}<li className="list-row">{' '}<div className="list-row-text">{' '}<span className="list-row-title">Thane Station</span>{' '}<span className="list-row-sub">Pickup at 10:05 PM</span>{' '}</div>{' '}</li>{' '}</ul>{' '}</div>{' '}</div>{' '}</div>{' '}<div className="page-grid-column">{' '}<div className="card">{' '}<div className="card-header"><div className="card-title">Amount to pay</div></div>{' '}<div className="card-body">{' '}<div className="notice notice-info">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none"><path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"></circle></svg>
            Pay ₹850 per seat in cash or UPI to the bus staff when boarding.
          </div>{' '}</div>{' '}<div className="card-footer">{' '}<button type="button" className="button button-primary" data-goto="/trips/:tripId/seats">Continue to seats</button>{' '}</div>{' '}</div>{' '}</div>{' '}</div>


    </div>
  );
}

export default TripsDetailScreen;
