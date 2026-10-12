// src/MockupApp.tsx — generated from the Mockup Preview the client approved
// (content 2f133fc4aba141c5). Every route below is a screen they signed off, drawn by
// the container beside it; the ones the preview showed inside the sidebar and top bar are wrapped in
// the chrome component.
import type { ReactElement, ReactNode } from 'react';
import { hasParams, matchPath, normalisePath, usePathname, type RouteParams } from './router';
import AppShell from './api/tasks/AppShell';
import HomePage from './api/tasks/HomePage';
import TasksNewPage from './api/tasks/TasksNewPage';
import TasksDetailPage from './api/tasks/TasksDetailPage';
import TeamPage from './api/tasks/TeamPage';

/** One approved screen: its address, whether the preview drew it inside the chrome, and the page. */
interface MockupRoute {
  readonly path: string;
  /** The frame this screen is drawn inside, or null when the preview drew it bare. */
  readonly chrome: ((props: { children?: ReactNode }) => JSX.Element) | null;
  readonly render: (params: RouteParams) => ReactElement;
}

export const ROUTES: readonly MockupRoute[] = [
  { path: "/", chrome: AppShell, render: () => <HomePage /> },
  { path: "/tasks/new", chrome: AppShell, render: () => <TasksNewPage /> },
  { path: "/tasks/:id", chrome: AppShell, render: () => <TasksDetailPage /> },
  { path: "/team", chrome: AppShell, render: () => <TeamPage /> },
];

/** Where an unknown address lands: the first screen of the approved preview. */
const HOME: MockupRoute = ROUTES[0] ?? { path: '/', chrome: null, render: () => <div /> };

function resolve(pathname: string): { route: MockupRoute; params: RouteParams } | null {
  const exact = ROUTES.find((r) => !hasParams(r.path) && normalisePath(r.path) === pathname);
  if (exact !== undefined) return { route: exact, params: {} };
  for (const r of ROUTES) {
    if (!hasParams(r.path)) continue;
    const params = matchPath(r.path, pathname);
    if (params !== null) return { route: r, params };
  }
  return null;
}

export default function MockupApp(): ReactElement {
  const pathname = usePathname();
  const found = resolve(pathname);
  const route = found === null ? HOME : found.route;
  const page = route.render(found === null ? {} : found.params);
  const Frame = route.chrome;
  return Frame === null ? page : <Frame>{page}</Frame>;
}
