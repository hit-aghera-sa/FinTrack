import { useEffect, type ReactElement } from 'react';
import { EmptyState } from './components/EmptyState';
import { PageHeader } from './components/PageHeader';
import { Sidebar } from './components/Sidebar';
import { hasParams, Link, matchPath, navigate, normalisePath, usePathname, type RouteParams } from './router';
import { ACCOUNT, APP_NAME, ROUTES, type AppRoute, type AppUser } from './routes';
import './styles/app.css';

/** The page for `pathname` and its parameter values. A fixed path wins over a pattern (`/todos/new` over `/todos/:id`). */
function resolveRoute(pathname: string): { route: AppRoute; params: RouteParams } | null {
  const exact = ROUTES.find((route) => !hasParams(route.path) && normalisePath(route.path) === pathname);
  if (exact) return { route: exact, params: {} };
  for (const route of ROUTES) {
    if (!hasParams(route.path)) continue;
    const params = matchPath(route.path, pathname);
    if (params) return { route, params };
  }
  return null;
}

function frameOf(route: AppRoute): 'app' | 'panel' | 'none' {
  return route.frame ?? 'app';
}

/** The pages that get a sidebar link: one address, drawn in the app frame, and not opted out. */
const NAV_ROUTES: readonly AppRoute[] = ROUTES.filter(
  (route) => route.nav !== false && !hasParams(route.path) && frameOf(route) === 'app',
);

/** Where a signed-out person is sent, or `null` for an app with no accounts. */
const SIGN_IN_PATH: string | null = ACCOUNT ? normalisePath(ACCOUNT.signInPath) : null;

/** Whether a page can be opened without signing in. With no accounts, every page can. */
function isOpen(route: AppRoute): boolean {
  return !ACCOUNT || route.public === true || normalisePath(route.path) === SIGN_IN_PATH;
}

const useNobody = (): AppUser | null => null;
/**
 * The app's own session hook when it has accounts; a constant "nobody" when it has none. Chosen ONCE,
 * when the module loads, so the frame calls the same hook on every render.
 */
const useAccountUser: () => AppUser | null | undefined = ACCOUNT ? ACCOUNT.useUser : useNobody;

/**
 * The sidebar entry to mark as current: the page itself, or — on a detail or form page — the section it
 * belongs to (`/todos/42` and `/todos/new` both mark `/todos`). The longest matching entry wins, so "/"
 * is current only on the home page.
 */
function activeNavPath(pathname: string, routes: readonly AppRoute[]): string {
  let best = '';
  for (const route of routes) {
    const path = normalisePath(route.path);
    const within = path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
    if (within && path.length > best.length) best = path;
  }
  return best;
}

function signOutAndLeave(): void {
  const account = ACCOUNT;
  if (!account) return;
  void Promise.resolve(account.signOut()).then(() => navigate(account.signInPath));
}

/**
 * THE APPLICATION SHELL: sidebar on the left, the current page on the right.
 *
 * This file is the frame around every page and does not change from app to app. Pages are added in
 * `routes.tsx` — the shell reads that list for the navigation, the URL matching, the page heading, and
 * (when the app has accounts) who may open what.
 */
export function App(): ReactElement {
  const pathname = usePathname();
  const user = useAccountUser();
  const resolved = resolveRoute(pathname);
  const needsUser = resolved !== null && !isOpen(resolved.route);
  const mustSignIn = needsUser && user === null;

  const title = resolved ? resolved.route.label + ' · ' + APP_NAME : APP_NAME;
  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (mustSignIn && SIGN_IN_PATH !== null) navigate(SIGN_IN_PATH, { replace: true });
  }, [mustSignIn]);

  // Still finding out who this is: wait, rather than flash the page or bounce to sign-in.
  if (needsUser && user === undefined) {
    return (
      <div className="app-status" role="status">
        Loading…
      </div>
    );
  }
  // On the way to the sign-in page (the effect above); draw nothing meanwhile.
  if (mustSignIn) return <></>;

  if (resolved && frameOf(resolved.route) === 'none') {
    return <main className="app-bare">{resolved.route.render(resolved.params)}</main>;
  }

  if (resolved && frameOf(resolved.route) === 'panel') {
    return (
      <div className="auth-shell">
        <main className="auth-card">
          <div className="auth-brand">{APP_NAME}</div>
          <h1 className="auth-title">{resolved.route.label}</h1>
          {resolved.route.render(resolved.params)}
        </main>
      </div>
    );
  }

  // Someone signed out sees only the pages they can open.
  const navRoutes = ACCOUNT && !user ? NAV_ROUTES.filter((route) => route.public === true) : NAV_ROUTES;

  return (
    <div className="app-shell">
      <Sidebar
        brand={APP_NAME}
        routes={navRoutes}
        activePath={activeNavPath(pathname, navRoutes)}
        onNavigate={navigate}
        account={
          ACCOUNT
            ? {
                user: user ?? null,
                menu: ACCOUNT.menu ?? [],
                signInPath: ACCOUNT.signInPath,
                signInLabel: ACCOUNT.labels?.signIn ?? 'Sign in',
                signOutLabel: ACCOUNT.labels?.signOut ?? 'Sign out',
                onSignOut: signOutAndLeave,
              }
            : undefined
        }
      />
      <main className="app-main">
        {resolved ? (
          <>
            {resolved.route.heading !== false ? <PageHeader title={resolved.route.label} /> : null}
            {resolved.route.render(resolved.params)}
          </>
        ) : (
          <EmptyState
            title="Page not found"
            message="There is no page at this address."
            action={
              <Link className="text-link" to="/">
                Go to the home page
              </Link>
            }
          />
        )}
      </main>
    </div>
  );
}

export default App;
