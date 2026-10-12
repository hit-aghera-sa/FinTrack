import { useEffect, useId, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';

interface UserMenuProps {
  /** The signed-in person. */
  user: { name: string; email?: string };
  /** Account links shown above the sign-out entry, e.g. Profile. */
  menu: ReadonlyArray<{ label: string; to: string }>;
  /** The sign-out entry's text. The app may say "Log out". */
  signOutLabel: string;
  onNavigate: (path: string) => void;
  onSignOut: () => void;
}

/**
 * THE FRAME'S ACCOUNT MENU: the signed-in person's name in the navigation bar, opening a small menu
 * with the app's account links and the sign-out entry. The frame draws it only when the app declares
 * accounts (`ACCOUNT` in `routes.tsx`) and someone is signed in - an app without sign-in never shows it.
 *
 * Closes on Escape, on a click outside, and after choosing an entry.
 */
export function UserMenu({ user, menu, signOutLabel, onNavigate, onSignOut }: UserMenuProps): ReactElement {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event: MouseEvent): void => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const follow = (event: ReactMouseEvent<HTMLAnchorElement>, path: string): void => {
    // Let the browser handle "open in new tab/window" gestures itself.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    setOpen(false);
    onNavigate(path);
  };

  return (
    <div className="user-menu" ref={rootRef}>
      <button
        type="button"
        className="user-menu-button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={'Account menu for ' + user.name}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="user-avatar" aria-hidden="true">
          {user.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="user-name">{user.name}</span>
      </button>
      {open ? (
        <div id={panelId} className="user-menu-panel">
          <div className="user-menu-identity">
            <span className="user-menu-name">{user.name}</span>
            {user.email !== undefined ? <span className="user-menu-email">{user.email}</span> : null}
          </div>
          <ul className="user-menu-list">
            {menu.map((item) => (
              <li key={item.to}>
                <a href={item.to} className="user-menu-item" onClick={(event) => follow(event, item.to)}>
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="user-menu-item"
                onClick={() => {
                  setOpen(false);
                  onSignOut();
                }}
              >
                {signOutLabel}
              </button>
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
