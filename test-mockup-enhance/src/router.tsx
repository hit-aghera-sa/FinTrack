import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent, type ReactElement } from 'react';

/**
 * THE APP'S ROUTING — real URLs through the browser's own History API, so the app needs no routing
 * library. Pages use two things from here: `<Link>` to move between pages, and `navigate()` to move
 * from code (after saving a form, after deleting a record).
 */

/** The values of the `:name` parts of a route path — `/todos/:id` on `/todos/42` gives `{ id: '42' }`. */
export type RouteParams = Record<string, string>;

/** Fired on every in-app navigation; `usePathname` listens to it alongside the browser's `popstate`. */
const NAVIGATE_EVENT = 'app:navigate';

/** "/todos/" and "/todos" are the same page; "/" stays "/". Query string and hash are not part of the path. */
export function normalisePath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? '';
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/**
 * Whether `pathname` is the page described by `pattern`, and if so its parameter values.
 *
 * A pattern is a path whose segments are literal (`todos`) or a parameter (`:id`). A parameter matches
 * exactly one non-empty segment. Returns `null` when the path is a different page.
 */
export function matchPath(pattern: string, pathname: string): RouteParams | null {
  const patternParts = normalisePath(pattern).split('/');
  const pathParts = normalisePath(pathname).split('/');
  if (patternParts.length !== pathParts.length) return null;
  const params: RouteParams = {};
  for (let i = 0; i < patternParts.length; i += 1) {
    const expected = patternParts[i] ?? '';
    const actual = pathParts[i] ?? '';
    if (expected.startsWith(':')) {
      if (actual === '') return null;
      try {
        params[expected.slice(1)] = decodeURIComponent(actual);
      } catch {
        return null; // a malformed escape is not a page
      }
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

/** Whether a route path has `:name` parts — such a page has no single address to link to from the sidebar. */
export function hasParams(pattern: string): boolean {
  return pattern.split('/').some((part) => part.startsWith(':'));
}

/**
 * Go to another page of the app without reloading it. `to` is a path, optionally with a query string
 * (`/todos/42`, `/todos?status=done`). Pass `{ replace: true }` to replace the current history entry
 * instead of adding one — e.g. after a redirect, so Back does not bounce.
 */
export function navigate(to: string, options?: { replace?: boolean }): void {
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (to !== current) {
    if (options?.replace === true) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/** The current URL path, kept in step with the browser (in-app navigation, Back and Forward). */
export function usePathname(): string {
  const [pathname, setPathname] = useState<string>(() => normalisePath(window.location.pathname));

  useEffect(() => {
    const sync = (): void => setPathname(normalisePath(window.location.pathname));
    window.addEventListener('popstate', sync);
    window.addEventListener(NAVIGATE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAVIGATE_EVENT, sync);
    };
  }, []);

  return pathname;
}

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  /** Where the link goes — a path of this app, e.g. `/todos/42`. */
  to: string;
}

/**
 * A link to another page of the app. It is a real `<a href>` — it can be opened in a new tab, copied
 * and found by assistive technology as a link — and a plain click is handled in-page, without a reload.
 */
export function Link({ to, onClick, children, ...rest }: LinkProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>): void => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    // Let the browser handle "open in new tab/window" gestures itself.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
}
