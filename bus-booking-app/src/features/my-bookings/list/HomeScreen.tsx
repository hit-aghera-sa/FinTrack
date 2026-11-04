// src/screens/HomeScreen.tsx
//
// THE APPROVED LOOK OF / — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export function HomeScreen(): JSX.Element {
  return (
    <div data-screen="/">


  <div className="empty-state">{' '}<div className="empty-state-art">{' '}<svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="18" height="12" rx="2"></rect><path d="M3 11h18"></path><circle cx="7" cy="17" r="1"></circle><circle cx="17" cy="17" r="1"></circle></svg>{' '}</div>{' '}<h1 className="empty-state-title">Bus Booking</h1>{' '}<p className="empty-state-message">Search buses, book seats and manage your trips — all in one place.</p>{' '}<div className="empty-state-action">{' '}<button type="button" className="button button-primary" data-goto="/search">Search buses</button>{' '}</div>{' '}</div>


    </div>
  );
}

export default HomeScreen;
