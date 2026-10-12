// src/screens/HomeScreen.tsx
//
// THE APPROVED LOOK OF / — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export default function HomeScreen(): JSX.Element {
  return (
    <div data-screen="/">

      <div className="page-header">{' '}<div>{' '}<h1 className="page-title">Board</h1>{' '}<p className="page-description">All tasks for the team, grouped by status. Move a card between columns or open it for details.</p>{' '}</div>{' '}<div className="page-actions">{' '}<button type="button" className="button button-primary" data-nav="/tasks/new">+ Add task</button>{' '}</div>{' '}</div>{' '}<div className="board-columns">{' '}<div>{' '}<div className="board-column-title">{' '}<h2 className="card-title">To do</h2>{' '}<span className="badge" id="count-todo">3</span>{' '}</div>{' '}<div className="column-stack" id="col-todo"></div>{' '}</div>{' '}<div>{' '}<div className="board-column-title">{' '}<h2 className="card-title">Doing</h2>{' '}<span className="badge" id="count-doing">2</span>{' '}</div>{' '}<div className="column-stack" id="col-doing"></div>{' '}</div>{' '}<div>{' '}<div className="board-column-title">{' '}<h2 className="card-title">Done</h2>{' '}<span className="badge" id="count-done">2</span>{' '}</div>{' '}<div className="column-stack" id="col-done"></div>{' '}</div>{' '}</div>
    
    </div>
  );
}
