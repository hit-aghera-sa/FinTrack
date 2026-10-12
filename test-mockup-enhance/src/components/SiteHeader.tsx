import type { MouseEvent, ReactElement, ReactNode } from 'react';

interface NavRoute {
  path: string;
  label: string;
}

interface SiteHeaderProps {
  brand: string;
  routes: readonly NavRoute[];
  activePath: string;
  onNavigate: (path: string) => void;
  /** The one button a visitor is meant to press - "Book a session". `null` for a site without one. */
  cta: { label: string; to: string } | null;
  /** The account end of the bar; the frame passes it only for a site with accounts. */
  account?: ReactNode;
}

/**
 * THE SITE HEADER: the name, the public pages, the call-to-action, the account area. Drawn from the page
 * list rather than from its own list of names. Every entry is a real link, so it can be opened in a new
 * tab and found by assistive technology; a plain click is handled in-page so the site does not reload.
 */
export function SiteHeader({ brand, routes, activePath, onNavigate, cta, account }: SiteHeaderProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a href="/" className="site-brand" onClick={(event) => handleClick(event, '/')}>
          {brand}
        </a>
        <nav className="site-nav" aria-label="Primary">
          <ul className="site-nav-list">
            {routes.map((route) => {
              const isActive = route.path === activePath;
              return (
                <li key={route.path}>
                  <a
                    href={route.path}
                    className={isActive ? 'site-nav-link is-active' : 'site-nav-link'}
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
        <div className="site-header-end">
          {cta ? (
            <a href={cta.to} className="site-cta" onClick={(event) => handleClick(event, cta.to)}>
              {cta.label}
            </a>
          ) : null}
          {account !== undefined && account !== null ? <div className="site-account">{account}</div> : null}
        </div>
      </div>
    </header>
  );
}
