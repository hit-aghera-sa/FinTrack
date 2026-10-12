/**
 * THE PAGE LIST — the one and only place a page of this app is registered.
 *
 * The fixed shell (src/App.tsx) reads this list: the site header and the footer
 * draw their navigation from it, so an entry added here appears in both by
 * itself. Each screen is imported from the lane that builds it; this file never
 * renders UI of its own.
 *
 * Every screen draws its own heading with the shared PageHeader primitive, so
 * each entry sets `heading: false` and the frame draws no title of its own. The
 * app has no login, so every page is `public: true` and `ACCOUNT` stays null.
 */
import type { ComponentProps, ReactElement } from 'react';
import type { UserMenu } from './components/UserMenu';
import { navigate, type RouteParams } from './router';
import { TaskActivityScreen, TASK_ACTIVITY_ROUTE } from './features/activity/index.js';
import { BoardPage } from './features/board/index.js';
import { MyWeekPage } from './features/my-week/index.js';
import { ReportsPage } from './features/reports/index.js';
import { NewTaskPage } from './features/task-create/index.js';
import { TaskDetailPage } from './features/task-detail/index.js';
import { TeamPage } from './features/team/index.js';

/** The display name of the app, shown in the header and the footer. */
export const APP_NAME = 'Test mockup enhance';

/** The footer tagline and the header's call-to-action button. */
export const SITE = {
  name: APP_NAME,
  tagline: "Plan, move and discuss the team's work on one shared board.",
  description: "Plan, move and discuss the team's work on one shared board.",
  cta: { label: 'Add task', to: '/tasks/new' },
  ctaLabel: 'Add task',
  ctaHref: '/tasks/new',
};

/** The person the account area shows, exactly as the shared user menu types it. */
export type AppUser = ComponentProps<typeof UserMenu>['user'];

/** The entries the account menu may hold, exactly as the shared user menu types them. */
export type AppUserMenu = ComponentProps<typeof UserMenu>['menu'];

/** The account wiring the shell needs when a site has a private area. */
export interface AppAccount {
  signInPath: string;
  useUser: () => AppUser | null | undefined;
  signOut: () => void | Promise<void>;
  menu?: AppUserMenu;
  labels?: { signIn?: string; signOut?: string };
}

/**
 * No accounts anywhere in this product: the board opens immediately, with no
 * sign-in and no per-person setup.
 */
export const ACCOUNT: AppAccount | null = null;

/** One registered page: its address, its navigation label and the screen it draws. */
export interface AppRoute {
  /** The address, optionally with `:name` parameter parts. */
  path: string;
  /** The words the navigation shows for this page. */
  label: string;
  /** The screen, given the values of the path's parameter parts. */
  render: (params: RouteParams) => ReactElement;
  /** A page anyone may open. Every page of this app carries it. */
  public?: boolean;
  /** `false` when the page draws its own heading — every screen here does. */
  heading?: boolean;
  /** `false` keeps a record page out of the navigation. */
  nav?: boolean;
  /** The frame the page is drawn inside; the site frame by default. */
  frame?: 'site' | 'panel' | 'none';
}

/** The address of one task's detail page. */
function taskDetailPath(taskId: string): string {
  return '/tasks/' + encodeURIComponent(taskId);
}

/** Opens a task's detail page. */
function openTask(taskId: string): void {
  navigate(taskDetailPath(taskId));
}

/** Goes back to the board. */
function openBoard(): void {
  navigate('/');
}

/** Opens the add-task screen. */
function openAddTask(): void {
  navigate('/tasks/new');
}

export const ROUTES: readonly AppRoute[] = [
  {
    path: '/',
    label: 'Board',
    public: true,
    heading: false,
    render: (): ReactElement => <BoardPage onOpenTask={openTask} onAddTask={openAddTask} />,
  },
  {
    // Everything due within the next 7 days, grouped by the day it is due.
    // The screen reports the clicked task upward; the navigation happens here.
    path: '/my-week',
    label: 'My week',
    public: true,
    heading: false,
    render: (): ReactElement => <MyWeekPage onOpenTask={openTask} />,
  },
  {
    path: '/tasks/new',
    label: 'Add task',
    public: true,
    heading: false,
    render: (): ReactElement => <NewTaskPage onCreated={openTask} onCancel={openBoard} />,
  },
  {
    path: '/tasks/:id',
    label: 'Task detail',
    public: true,
    heading: false,
    nav: false,
    render: (params: RouteParams): ReactElement => <TaskDetailPage taskId={params.id ?? ''} onBack={openBoard} />,
  },
  {
    // One task's activity timeline. A record page, so it stays out of the navigation.
    path: TASK_ACTIVITY_ROUTE,
    label: 'Activity',
    public: true,
    heading: false,
    nav: false,
    render: (params: RouteParams): ReactElement => (
      <TaskActivityScreen
        taskId={params.id ?? ''}
        onBack={(): void => {
          openTask(params.id ?? '');
        }}
      />
    ),
  },
  {
    path: '/team',
    label: 'Team',
    public: true,
    heading: false,
    render: (): ReactElement => <TeamPage />,
  },
  {
    path: '/reports',
    label: 'Reports',
    public: true,
    heading: false,
    render: (): ReactElement => <ReportsPage />,
  },
];
