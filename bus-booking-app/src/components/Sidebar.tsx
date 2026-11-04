import type { MouseEvent, ReactElement } from 'react';

/** The part of a route the navigation needs. */
interface NavRoute {
  path: string;
  label: string;
}

/** The account area at the foot of the sidebar. Passed only by an app that has sign-in. */
interface NavAccount {
  /** The signed-in person, or `null` when nobody is signed in. */
  user: { name: string; email?: string } | null;
  /** Account links shown above "Sign out", e.g. Profile. */
  menu: ReadonlyArray<{ label: string; to: string }>;
  /** Where the sign-in link goes when nobody is signed in. */
  signInPath: string;
  /** The sign-in link's text. The app may say "Log in". */
  signInLabel: string;
  /** The sign-out entry's text. The app may say "Log out". */
  signOutLabel: string;
  onSignOut: () => void;
}

interface SidebarProps {
  /** The app's name, shown above the links. */
  brand: string;
  routes: readonly NavRoute[];
  /** The path of the entry to mark as the current page. */
  activePath: string;
  onNavigate: (path: string) => void;
  /** Omitted for an app with no accounts - then the sidebar has no account area at all. */
  account?: NavAccount;
}

/**
 * THE APP'S NAVIGATION, drawn from the page list rather than from its own list of names. With
 * accounts, its foot shows the signed-in person, the app's account links and "Sign out" - or a
 * "Sign in" link when nobody is signed in.
 *
 * Every entry is a real link (`<a href>`), so it can be opened in a new tab, copied and found by
 * assistive technology as a link. A plain click is handled in-page so the app does not reload.
 */
export function Sidebar({ brand, routes, activePath, onNavigate, account }: SidebarProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string): void => {
    // Let the browser handle "open in new tab/window" gestures itself.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav" aria-label="Primary">
        <div className="sidebar-brand">{brand}</div>
        <ul className="sidebar-list">
          {routes.map((route) => {
            const isActive = route.path === activePath;
            return (
              <li key={route.path}>
                <a
                  href={route.path}
                  className={isActive ? 'sidebar-link is-active' : 'sidebar-link'}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={(event) => handleClick(event, route.path)}
                >
                  {route.label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
      {account !== undefined ? (
        <div className="sidebar-account" role="group" aria-label="Account">
          {account.user !== null ? (
            <>
              <div className="sidebar-user">
                <span className="sidebar-user-name">{account.user.name}</span>
                {account.user.email !== undefined ? <span className="sidebar-user-email">{account.user.email}</span> : null}
              </div>
              <ul className="sidebar-list">
                {account.menu.map((item) => (
                  <li key={item.to}>
                    <a href={item.to} className="sidebar-link" onClick={(event) => handleClick(event, item.to)}>
                      {item.label}
                    </a>
                  </li>
                ))}
                <li>
                  <button type="button" className="sidebar-link" onClick={account.onSignOut}>
                    {account.signOutLabel}
                  </button>
                </li>
              </ul>
            </>
          ) : (
            <a href={account.signInPath} className="sidebar-link" onClick={(event) => handleClick(event, account.signInPath)}>
              {account.signInLabel}
            </a>
          )}
        </div>
      ) : null}
    </aside>
  );
}
