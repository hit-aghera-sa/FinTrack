// src/screens/TripsScreen.tsx
//
// THE APPROVED LOOK OF /trips — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function TripsScreen(): JSX.Element {
  return (
    <div data-screen="/trips">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Browse</div>{' '}<h1 className="page-title">Trips</h1>{' '}<p className="page-description">Buses available across all routes today.</p>{' '}</div>{' '}</div>{' '}<div className="table-card has-head">{' '}<div className="table-head"><div className="card-title">All trips</div></div>{' '}<div className="table-scroll">{' '}<table className="data-table is-striped">{' '}<caption>Trips</caption>{' '}<thead>{' '}<tr><th>Bus</th><th>Route</th><th>Type</th><th>Departs</th><th className="is-numeric">Fare</th><th className="is-numeric">Seats left</th><th></th></tr>{' '}</thead>{' '}<tbody>{' '}<tr data-goto="/trips/:tripId">{' '}<td className="text-strong">Shree Travels</td>{' '}<td>Mumbai → Pune</td>{' '}<td>AC Sleeper</td>{' '}<td>9:30 PM</td>{' '}<td className="is-numeric">₹850</td>{' '}<td className="is-numeric">18</td>{' '}<td className="row-actions"><button type="button" className="button button-secondary button-small" data-goto="/trips/:tripId">View</button></td>{' '}</tr>{' '}<tr data-goto="/trips/:tripId">{' '}<td className="text-strong">Purple Express</td>{' '}<td>Mumbai → Pune</td>{' '}<td>AC Seater</td>{' '}<td>7:00 AM</td>{' '}<td className="is-numeric">₹600</td>{' '}<td className="is-numeric">4</td>{' '}<td className="row-actions"><button type="button" className="button button-secondary button-small" data-goto="/trips/:tripId">View</button></td>{' '}</tr>{' '}<tr data-goto="/trips/:tripId">{' '}<td className="text-strong">VRL Travels</td>{' '}<td>Pune → Bengaluru</td>{' '}<td>Non-AC Sleeper</td>{' '}<td>10:45 PM</td>{' '}<td className="is-numeric">₹550</td>{' '}<td className="is-numeric">22</td>{' '}<td className="row-actions"><button type="button" className="button button-secondary button-small" data-goto="/trips/:tripId">View</button></td>{' '}</tr>{' '}<tr data-goto="/trips/:tripId">{' '}<td className="text-strong">Orange Tours</td>{' '}<td>Hyderabad → Bengaluru</td>{' '}<td>AC Seater</td>{' '}<td>2:30 PM</td>{' '}<td className="is-numeric">₹700</td>{' '}<td className="is-numeric">30</td>{' '}<td className="row-actions"><button type="button" className="button button-secondary button-small" data-goto="/trips/:tripId">View</button></td>{' '}</tr>{' '}<tr data-goto="/trips/:tripId">{' '}<td className="text-strong">Sharma Yatra</td>{' '}<td>Delhi → Jaipur</td>{' '}<td>AC Sleeper</td>{' '}<td>11:59 PM</td>{' '}<td className="is-numeric">₹900</td>{' '}<td className="is-numeric">12</td>{' '}<td className="row-actions"><button type="button" className="button button-secondary button-small" data-goto="/trips/:tripId">View</button></td>{' '}</tr>{' '}</tbody>{' '}</table>{' '}</div>{' '}</div>


    </div>
  );
}

export default TripsScreen;
