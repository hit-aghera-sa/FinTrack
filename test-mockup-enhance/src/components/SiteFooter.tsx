import type { MouseEvent, ReactElement } from 'react';

interface NavRoute {
  path: string;
  label: string;
}

interface SiteFooterProps {
  brand: string;
  tagline: string | null;
  routes: readonly NavRoute[];
  onNavigate: (path: string) => void;
}

/** THE SITE FOOTER: the name, the tagline, the same pages as the header, the year. Drawn from the page list. */
export function SiteFooter({ brand, tagline, routes, onNavigate }: SiteFooterProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>, path: string): void => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate(path);
  };
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="site-footer-brand">{brand}</p>
        {tagline ? <p className="site-footer-tagline">{tagline}</p> : null}
        <nav className="site-footer-nav" aria-label="Footer">
          {routes.map((route) => (
            <a key={route.path} href={route.path} onClick={(event) => handleClick(event, route.path)}>
              {route.label}
            </a>
          ))}
        </nav>
        <p className="site-footer-note">
          © {new Date().getFullYear()} {brand}
        </p>
      </div>
    </footer>
  );
}
