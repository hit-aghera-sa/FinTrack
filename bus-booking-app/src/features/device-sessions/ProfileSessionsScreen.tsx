// src/screens/ProfileSessionsScreen.tsx
//
// THE APPROVED LOOK OF /profile/sessions — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function ProfileSessionsScreen(): JSX.Element {
  return (
    <div data-screen="/profile/sessions">


  <div className="page-header">{' '}<div>{' '}<div className="page-eyebrow">Account</div>{' '}<h1 className="page-title">Active devices</h1>{' '}<p className="page-description">These browsers and devices are currently signed in.</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-danger" data-goto="/login">Sign out everywhere</button>{' '}</div>{' '}</div>{' '}<div className="table-card has-head">{' '}<div className="table-head">{' '}<div className="card-title">Signed-in sessions</div>{' '}</div>{' '}<div className="table-scroll">{' '}<table className="data-table is-striped">{' '}<caption>Active devices</caption>{' '}<thead>{' '}<tr><th>Device</th><th>Started</th><th>Status</th></tr>{' '}</thead>{' '}<tbody>{' '}<tr>{' '}<td>Chrome on Windows</td>{' '}<td>12/05/2024, 9:14 AM</td>{' '}<td><span className="badge badge-success"><span className="badge-dot"></span>This device</span></td>{' '}</tr>{' '}<tr>{' '}<td>Safari on iPhone</td>{' '}<td>10/05/2024, 7:02 PM</td>{' '}<td><span className="badge badge-info">Signed in</span></td>{' '}</tr>{' '}<tr>{' '}<td>Chrome on Android</td>{' '}<td>02/05/2024, 11:40 AM</td>{' '}<td><span className="badge badge-info">Signed in</span></td>{' '}</tr>{' '}<tr>{' '}<td>Edge on Windows</td>{' '}<td>28/04/2024, 6:21 PM</td>{' '}<td><span className="badge badge-info">Signed in</span></td>{' '}</tr>{' '}</tbody>{' '}</table>{' '}</div>{' '}<div className="table-foot">{' '}<span>4 devices signed in</span>{' '}<button type="button" className="button button-ghost" data-goto="/profile">Back to Profile</button>{' '}</div>{' '}</div>


    </div>
  );
}

export default ProfileSessionsScreen;
