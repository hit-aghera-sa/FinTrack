// src/components/AppShell.tsx
//
// THE APPROVED LOOK OF /__shell__ — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
import type { ReactNode } from 'react';
export default function ShellScreen({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <div data-screen="/__shell__">
<div id="app-frame" className="app-shell">{' '}<header className="topnav">{' '}<div className="topnav-inner">{' '}<div className="topnav-brand">{' '}<span className="topnav-mark">TB</span>{' '}<span>Team Task Board</span>{' '}</div>{' '}<nav className="topnav-nav">{' '}<ul className="topnav-list" id="app-nav-list">{' '}<li><button type="button" className="topnav-link" data-nav="/">Board</button></li>{' '}<li><button type="button" className="topnav-link" data-nav="/team">Team</button></li>{' '}</ul>{' '}</nav>{' '}</div>{' '}</header>{' '}<div id="app-pages" data-screen-outlet>{children}</div>{' '}</div><div className="dialog-backdrop hidden" id="remove-dialog">{' '}<div className="dialog" role="alertdialog" aria-labelledby="remove-dialog-title">{' '}<h2 className="dialog-title" id="remove-dialog-title">Remove this member?</h2>{' '}<p className="dialog-message">They'll be removed from the roster. Any tasks assigned to them will become unassigned but will stay on the board.</p>{' '}<div className="dialog-actions">{' '}<button type="button" className="button button-secondary" id="remove-cancel-btn">Cancel</button>{' '}<button type="button" className="button button-danger" id="remove-confirm-btn">Remove member</button>{' '}</div>{' '}</div>{' '}</div>
    </div>
  );
}
