// src/screens/TasksNewScreen.tsx
//
// THE APPROVED LOOK OF /tasks/new — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
export default function TasksNewScreen(): JSX.Element {
  return (
    <div data-screen="/tasks/new">

      <div className="page-header">{' '}<div>{' '}<h1 className="page-title">Add task</h1>{' '}<p className="page-description">Create a new task and place it directly into the right column.</p>{' '}</div>{' '}</div>{' '}<div className="card">{' '}<div className="card-body">{' '}<form className="form" id="new-task-form">{' '}<div className="field">{' '}<label className="field-label" htmlFor="nt-title">Title <span className="field-required">*</span></label>{' '}<input className="input" id="nt-title" type="text" placeholder="e.g. Write release notes" />{' '}<p className="field-hint" id="nt-title-hint">Required — describe the task in a few words.</p>{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="nt-desc">Description</label>{' '}<textarea className="input" id="nt-desc" placeholder="Add any extra context for this task..."></textarea>{' '}</div>{' '}<div className="form-row">{' '}<div className="field">{' '}<label className="field-label" htmlFor="nt-assignee">Assignee</label>{' '}<select className="input" id="nt-assignee">{' '}<option defaultValue="">Unassigned</option>{' '}<option defaultValue="1">Priya Natarajan</option>{' '}<option defaultValue="2">Dan Okafor</option>{' '}<option defaultValue="3">Mei Lin</option>{' '}<option defaultValue="4">Carlos Vega</option>{' '}<option defaultValue="5">Sofia Rossi</option>{' '}</select>{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="nt-due">Due date</label>{' '}<input className="input" id="nt-due" type="date" />{' '}</div>{' '}<div className="field">{' '}<label className="field-label" htmlFor="nt-status">Status</label>{' '}<select className="input" id="nt-status">{' '}<option defaultValue="todo" defaultSelected>To do</option>{' '}<option defaultValue="doing">Doing</option>{' '}<option defaultValue="done">Done</option>{' '}</select>{' '}</div>{' '}</div>{' '}<div className="form-actions">{' '}<button type="button" className="button button-primary" id="nt-save">Save task</button>{' '}<button type="button" className="button button-secondary" data-nav="/">Cancel</button>{' '}</div>{' '}</form>{' '}</div>{' '}</div>
    
    </div>
  );
}
