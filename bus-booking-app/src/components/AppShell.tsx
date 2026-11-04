// src/components/AppShell.tsx
//
// THE APPROVED LOOK OF /__shell__ — converted mechanically from the Mockup Preview the client
// signed off. Every class, word and element here is theirs. This file is FIXED: behaviour belongs in
// the container beside it, which decides what to show while data loads, when it is empty, and when it
// fails. Changing the markup here changes what the client approved.
import type { ReactNode } from 'react';
export function ShellScreen({ children }: { children?: ReactNode }): JSX.Element {
  return (
    <div data-screen="/__shell__">
<div id="auth-frame" className="frame app-bare">{' '}<div className="auth-shell">{' '}<div className="auth-card" data-screen-outlet>{children}</div>{' '}</div>{' '}</div><div id="toast-root"></div>
    </div>
  );
}

export default ShellScreen;
