import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { navigate, usePathname } from "../router.js";
import "./tokens.css";
import "./NavBar.css";

export interface NavBarItem {
  /** The path this entry points at, e.g. "/team". */
  readonly href: string;
  /** The visible label. */
  readonly label: string;
}

export interface NavBarProps {
  readonly items: readonly NavBarItem[];
  /** Accessible name for the nav landmark. */
  readonly label?: string;
  /** Override the active path (useful in tests); defaults to the current URL. */
  readonly currentPath?: string;
  /** Optional trailing controls, e.g. a primary action button. */
  readonly actions?: ReactNode;
}

function samePath(a: string, b: string): boolean {
  const trim = (value: string): string => {
    const withoutQuery = value.split("?")[0].split("#")[0];
    const trimmed = withoutQuery.replace(/\/+$/, "");
    return (trimmed === "" ? "/" : trimmed).toLowerCase();
  };
  return trim(a) === trim(b);
}

/**
 * A secondary navigation strip for use INSIDE a page (the app shell draws the
 * site header itself). The active entry is marked with `aria-current`, bold
 * weight and an underline, never by colour alone.
 */
export function NavBar({ items, label = "Sections", currentPath, actions }: NavBarProps): JSX.Element {
  const pathname = usePathname();
  const active: string = currentPath ?? String(pathname);

  const handleClick = (event: ReactMouseEvent<HTMLAnchorElement>, href: string): void => {
    if (event.defaultPrevented) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
    event.preventDefault();
    navigate(href);
  };

  return (
    <nav className="ui-navbar" aria-label={label}>
      <ul className="ui-navbar__list">
        {items.map((item: NavBarItem) => {
          const isActive = samePath(item.href, active);
          return (
            <li key={item.href} className="ui-navbar__item">
              <a
                href={item.href}
                className={isActive ? "ui-navbar__link is-active" : "ui-navbar__link"}
                aria-current={isActive ? "page" : undefined}
                onClick={(event: ReactMouseEvent<HTMLAnchorElement>) => handleClick(event, item.href)}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
      {actions ? <div className="ui-navbar__actions">{actions}</div> : null}
    </nav>
  );
}
