// src/screens/BusesScreen.tsx
//
// THE APPROVED LOOK OF /buses — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function BusesScreen(): JSX.Element {
  return (
    <div data-screen="/buses">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Fleet</div>{' '}<h1 className="page-title">Buses</h1>{' '}<p className="page-description">All buses configured on the network.</p>{' '}</div>{' '}</div>{' '}<div className="table-card">{' '}<div className="table-scroll">{' '}<table className="data-table is-striped">{' '}<thead>{' '}<tr><th>Bus name</th><th>Type</th><th>Route</th><th className="is-numeric">Fare per seat</th><th className="is-numeric">Total seats</th></tr>{' '}</thead>{' '}<tbody>{' '}<tr data-goto="/trips/:tripId"><td>Shree Travels</td><td>AC Sleeper</td><td>Pune – Mumbai</td><td className="is-numeric">₹600</td><td className="is-numeric">36</td></tr>{' '}<tr data-goto="/trips/:tripId"><td>Neeta Travels</td><td>AC Seater</td><td>Nashik – Pune</td><td className="is-numeric">₹450</td><td className="is-numeric">42</td></tr>{' '}<tr data-goto="/trips/:tripId"><td>VRL Travels</td><td>Non-AC Sleeper</td><td>Mumbai – Goa</td><td className="is-numeric">₹800</td><td className="is-numeric">30</td></tr>{' '}<tr data-goto="/trips/:tripId"><td>Purple Line</td><td>Non-AC Seater</td><td>Pune – Nagpur</td><td className="is-numeric">₹550</td><td className="is-numeric">45</td></tr>{' '}<tr data-goto="/trips/:tripId"><td>Orange Travels</td><td>AC Sleeper</td><td>Mumbai – Nashik</td><td className="is-numeric">₹500</td><td className="is-numeric">36</td></tr>{' '}</tbody>{' '}</table>{' '}</div>{' '}</div>


    </div>
  );
}

export default BusesScreen;
