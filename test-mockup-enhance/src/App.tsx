import { useEffect, type ReactElement, type ReactNode } from 'react';
import { buttonClass } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { PageHeader } from './components/PageHeader';
import { SiteFooter } from './components/SiteFooter';
import { SiteHeader } from './components/SiteHeader';
import { UserMenu } from './components/UserMenu';
import { hasParams, Link, matchPath, navigate, normalisePath, usePathname, type RouteParams } from './router';
import { ACCOUNT, APP_NAME, ROUTES, SITE, type AppRoute, type AppUser } from './routes';
import './styles/app.css';

/** The page for `pathname` and its parameter values. A fixed path wins over a pattern. */
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

function frameOf(route: AppRoute): 'site' | 'panel' | 'none' {
  return route.frame ?? 'site';
}

/** The pages that get a navigation link: one address, drawn in the site frame, and not opted out. */
const NAV_ROUTES: readonly AppRoute[] = ROUTES.filter(
  (route) => route.nav !== false && !hasParams(route.path) && frameOf(route) === 'site',
);

const SIGN_IN_PATH: string | null = ACCOUNT ? normalisePath(ACCOUNT.signInPath) : null;

/** Whether a page can be opened without signing in. With no accounts, every page can. */
function isOpen(route: AppRoute): boolean {
  return !ACCOUNT || route.public === true || normalisePath(route.path) === SIGN_IN_PATH;
}

const useNobody = (): AppUser | null => null;
const useAccountUser: () => AppUser | null | undefined = ACCOUNT ? ACCOUNT.useUser : useNobody;

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

/** The account end of the header: nothing without accounts; the person's menu; or a "Sign in" link. */
function accountArea(user: AppUser | null | undefined): ReactNode {
  const account = ACCOUNT;
  if (!account) return undefined;
  if (!user) {
    return (
      <Link className={buttonClass('ghost', true)} to={account.signInPath}>
        {account.labels?.signIn ?? 'Sign in'}
      </Link>
    );
  }
  return (
    <UserMenu
      user={user}
      menu={account.menu ?? []}
      signOutLabel={account.labels?.signOut ?? 'Sign out'}
      onNavigate={navigate}
      onSignOut={signOutAndLeave}
    />
  );
}

/**
 * THE SITE FRAME: the header across the top, the page, the footer at the foot.
 *
 * This file does not change from site to site. Pages are added in `routes.tsx` - the frame reads that
 * list for the navigation, the URL matching, the heading, and (when the site has accounts) who may open
 * what. A public page draws itself in full-width bands (`heading: false`); a form page or a private
 * list is drawn in a content column under its heading.
 */
export function App(): ReactElement {
  const pathname = usePathname();
  const user = useAccountUser();
  const resolved = resolveRoute(pathname);
  const needsUser = resolved !== null && !isOpen(resolved.route);
  const mustSignIn = needsUser && user === null;

  const title = resolved && resolved.route.path !== '/' ? resolved.route.label + ' · ' + APP_NAME : APP_NAME;
  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    if (mustSignIn && SIGN_IN_PATH !== null) navigate(SIGN_IN_PATH, { replace: true });
  }, [mustSignIn]);

  if (needsUser && user === undefined) {
    return (
      <div className="app-status" role="status">
        Loading…
      </div>
    );
  }
  if (mustSignIn) return <></>;

  if (resolved && frameOf(resolved.route) === 'none') {
    return <main className="app-bare">{resolved.route.render(resolved.params)}</main>;
  }

  if (resolved && frameOf(resolved.route) === 'panel') {
    return (
      <div className="auth-shell">
        <main className="auth-card">
          <div className="auth-brand">
            <span>{APP_NAME}</span>
          </div>
          <h1 className="auth-title">{resolved.route.label}</h1>
          {resolved.route.render(resolved.params)}
        </main>
      </div>
    );
  }

  const navRoutes = ACCOUNT && !user ? NAV_ROUTES.filter((route) => route.public === true) : NAV_ROUTES;
  const withHeading = resolved !== null && resolved.route.heading !== false;

  return (
    <div className="site-shell">
      <SiteHeader
        brand={APP_NAME}
        routes={navRoutes}
        activePath={activeNavPath(pathname, navRoutes)}
        onNavigate={navigate}
        cta={SITE.cta}
        account={accountArea(user)}
      />
      <main className={withHeading || !resolved ? 'site-main site-main-page' : 'site-main'}>
        {resolved ? (
          <>
            {withHeading ? <PageHeader title={resolved.route.label} /> : null}
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
      <SiteFooter brand={APP_NAME} tagline={SITE.tagline} routes={navRoutes} onNavigate={navigate} />
    </div>
  );
}

export default App;
