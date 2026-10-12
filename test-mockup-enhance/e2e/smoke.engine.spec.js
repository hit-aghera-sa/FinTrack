import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ENGINE-OWNED acceptance exam (QAV-01) — regenerated before every web acceptance gate; do not edit.
const ARTIFACT_DIR = '.qa/shots';
const REQUIRED_ROUTES_FILE = '.qa/required-routes.json';
// SBR-1D: one structured record per walked route, so a failing screen can be routed to the lane that
// renders it instead of to whoever owns this suite. Written BEFORE the assertion, so it exists on failure.
const ROUTE_LOG_FILE = '.qa/exam-routes.json';
// E2: the session the suite's sign-in step saved. This exam opts in, as any spec may: a walk that is
// signed out sees the sign-in page behind every protected screen and grades that page over and over.
// Absent (no sign-in step ran) or empty (no credential, or the app refused it) => signed out, as before.
const SESSION_FILE = '.qa/auth/state.json';
if (fs.existsSync(SESSION_FILE)) test.use({ storageState: SESSION_FILE });

/** Source URLs a stack or a failed request names — the files the app served that threw. Line:col dropped. */
function sourceUrlsOf(text) {
  const out = [];
  const re = /https?:\/\/[^\s)'"]+/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const url = m[0].replace(/:\d+(?::\d+)?$/, '');
    if (!out.includes(url)) out.push(url);
  }
  return out.slice(0, 8);
}

/** A route becomes a stable, filesystem-safe slug: '/' -> 'home', '/orders/new' -> 'orders-new'. */
function slugFor(route) {
  const trimmed = String(route).split('?')[0].split('#')[0].replace(/^\/+|\/+$/g, '');
  if (trimmed === '') return 'home';
  return trimmed.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 60) || 'route';
}

/**
 * The screens the requirements name, when the capture wrote them (E14); an empty list otherwise.
 *
 * Kept: an ADDRESS of this app's own pages. Dropped: a route PATTERN ('/orders/:id', '/orders/[id]') —
 * nobody's address, the app answers it with its correct 'not found', and only the required-routes exam
 * can open a real record for it; an API address; anything that is not a path of this origin.
 */
function declaredRoutes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REQUIRED_ROUTES_FILE, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.routes) ? parsed.routes : null;
    if (!list) return [];
    const routes = list.filter((r) => {
      if (typeof r !== 'string' || !r.startsWith('/') || r.startsWith('//')) return false;
      const segments = r.split('?')[0].split('#')[0].toLowerCase().split('/');
      if (segments[1] === 'api') return false;
      return !segments.some((segment) => segment.startsWith(':') ||
        (segment.startsWith('[') && segment.endsWith(']')) || (segment.startsWith('{') && segment.endsWith('}')));
    });
    return Array.from(new Set(routes));
  } catch {
    return [];
  }
}

/**
 * A11 — a link that ENDS THE SESSION is never opened. Following '/logout' in the middle of the walk
 * signs the visitor out, and every screen after it is then graded as the sign-in page. Recognised by a
 * path segment that names it, or by the link's own words when the address says nothing ('/session/end').
 */
const SIGN_OUT_SEGMENTS = ['logout', 'log-out', 'log_out', 'logoff', 'log-off', 'signout', 'sign-out', 'sign_out', 'signoff', 'sign-off'];
const SIGN_OUT_LABELS = ['logout', 'log out', 'log off', 'signout', 'sign out', 'sign off'];
function endsSession(pathname, label) {
  if (pathname.toLowerCase().split('/').some((segment) => SIGN_OUT_SEGMENTS.includes(segment))) return true;
  return SIGN_OUT_LABELS.includes(String(label || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim());
}

/**
 * Every SCREEN of this app the shell links to — the app's own account of its screens.
 *
 * A11 — a link is not a screen merely because it is a link. The crawl used to open everything that
 * was not 'http(s):', 'mailto:', 'tel:', 'data:', 'blob:' or '#', as a path of the app. So a correct
 * app was failed for: a protocol-relative link to its CDN ('//cdn…', opened as a path, then as another
 * site); any other scheme ('javascript:void(0)', 'sms:', 'whatsapp://' — opened as '/javascript:…');
 * its API ('/api/orders/export' — a data address, 401 for a visitor); a download; and its own sign-out
 * link. Each href is now RESOLVED the way the browser resolves it, and kept only when it is a page
 * address of this origin. What a link turns out to be once it answers — a file, not a page — is
 * settled where it is opened (see the walk).
 */
async function crawlNav(page) {
  const links = await page.evaluate(() =>
    Array.from(globalThis.document.querySelectorAll('a[href]')).map((a) => ({
      href: a.getAttribute('href') || '',
      label: a.textContent || '',
      download: a.hasAttribute('download'),
    })),
  );
  const here = new URL(page.url());
  const routes = new Set(['/']);
  for (const link of links) {
    const href = link.href.trim();
    // A fragment of the page already open is not another screen.
    if (href === '' || href.startsWith('#')) continue;
    let target;
    try {
      target = new URL(href, here);
    } catch {
      continue;
    }
    // Another scheme, or another site: not a screen of this app.
    if (target.protocol !== 'http:' && target.protocol !== 'https:') continue;
    if (target.origin !== here.origin) continue;
    // The app says so itself: this link hands the visitor a file.
    if (link.download) continue;
    const clean = target.pathname.replace(/\/+$/, '');
    // The app's data addresses are graded by its own specs, never opened as screens — the same rule
    // the required-routes exam applies to the routes it is given.
    if (/^\/api(?:\/|$)/i.test(clean)) continue;
    if (endsSession(clean, link.label)) continue;
    // A parameterised link ('/orders/:id') is a template, not a distinct screen to grade.
    if (/:[A-Za-z]/.test(clean)) continue;
    if (clean.length > 1) routes.add(clean);
  }
  // Bound the walk: a nav linking a hundred screens is a crawl, not an exam, and the gate has a budget.
  return Array.from(routes).slice(0, 12);
}

/**
 * Readiness — the rule of the required-routes exam, word for word (a test pins the two together): the
 * network has gone quiet, and nothing on the page says it is busy.
 */
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await expect.poll(() => page.locator('[aria-busy="true"]:visible').count(), { timeout: 10000 }).toBe(0);
}

/** Did the page render anything at all? A mounted-but-empty root is the classic silent failure. */
async function renderedSomething(page) {
  return await page.evaluate(() => {
    const body = globalThis.document.body;
    if (!body) return { ok: false, text: 0, elements: 0 };
    const text = (body.innerText || '').trim().length;
    const elements = body.querySelectorAll('*').length;
    return { ok: text > 0 || elements > 8, text, elements };
  });
}

test('the app boots, and every screen it offers loads clean', async ({ page, baseURL }) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const errors = [];
  const errorSources = [];
  page.on('pageerror', (e) => {
    errors.push('pageerror: ' + String(e));
    errorSources.push(sourceUrlsOf(e && e.stack));
  });
  // A10 — WHAT COUNTS AS A BROKEN SCREEN. Not the console.
  //
  // This exam used to fail a screen for ANY message of console level 'error'. That level carries two
  // things that are not the application failing. The app's own handled errors: a catch block that
  // logs — console.error('Session check failed', e) on a signed-out walk — is the code doing the right
  // thing. And the browser's own notices: Chrome writes 'Failed to load resource' for every request
  // answered 4xx, so a cart that is empty (404), a session probe that is signed out (401), and a
  // third-party asset the capture environment cannot reach each failed a correct screen. R3 excused
  // one of those notices (401/403, auth-gated apps only); the others stayed, and every one of them
  // was filed as runtime_error on a screen with nothing wrong.
  //
  // What a broken screen does is counted directly instead, where the browser states it as a fact:
  //   - the page THREW: an uncaught exception or an unhandled promise rejection (pageerror);
  //   - the app's OWN CODE did not load: a script or stylesheet of this origin answered 4xx/5xx, never
  //     arrived, or was answered with a page instead of code — the single-page fallback serving the
  //     shell where a chunk should be, which the browser refuses to run;
  //   - the app's OWN SERVER failed: any request to this origin answered 5xx.
  // A request the app made and was REFUSED (4xx) is the app's to handle, and so is everything on
  // another origin. A screen that then shows nothing is still caught below, by rendered_nothing.
  //
  // Deliberately backslash-free: this spec is emitted from a TEMPLATE LITERAL, where an escape such
  // as a word boundary or an escaped paren is consumed by the template and never reaches the
  // generated code. (For the same reason there are no backticks anywhere in this spec.)
  const appOrigin = baseURL ? new URL(baseURL).origin : '';
  const brokenByApp = (what, url) => {
    errors.push(what + ': ' + url);
    errorSources.push(sourceUrlsOf(url));
  };
  page.on('response', (response) => {
    try {
      const url = response.url();
      if (new URL(url).origin !== appOrigin) return;
      const request = response.request();
      const type = request.resourceType();
      // The document itself is graded by its own status below (http_error).
      if (type === 'document' && request.frame() === page.mainFrame()) return;
      const status = response.status();
      const ownCode = type === 'script' || type === 'stylesheet';
      if (status >= 500) brokenByApp('the app answered HTTP ' + status + ' to its own ' + request.method() + ' request', url);
      else if (ownCode && status >= 400) brokenByApp('the app did not serve its own ' + type + ' (HTTP ' + status + ')', url);
      else if (type === 'script' && status === 200 && String(response.headers()['content-type'] || '').toLowerCase().startsWith('text/html')) {
        brokenByApp('the app answered its own script with a document, which the browser will not run', url);
      }
    } catch {
      // a response that cannot be read says nothing
    }
  });
  page.on('requestfailed', (request) => {
    try {
      const type = request.resourceType();
      if (type !== 'script' && type !== 'stylesheet') return;
      if (new URL(request.url()).origin !== appOrigin) return;
      const failure = request.failure();
      const why = failure && failure.errorText ? failure.errorText : 'no response';
      // Abandoned because the page moved on (the walk opened the next screen): nothing failed.
      if (why.toLowerCase().includes('abort')) return;
      brokenByApp('the app did not serve its own ' + type + ' (' + why + ')', request.url());
    } catch {
      // a request that cannot be read says nothing
    }
  });
  const routeLog = [];
  const logRoute = (route, kind, detail, status, sources) =>
    routeLog.push({ route, kind, detail: String(detail).slice(0, 500), status, sourceUrls: sources || [] });

  // A13 — THE APP MAY BE GOING SOMEWHERE WHILE THE EXAM LOOKS AT IT.
  //
  // A single-page app that sends a signed-out visitor to its sign-in page does it by script, a moment
  // AFTER the page loaded: an interceptor sees a 401 and sets location.href. The exam used to wait a
  // fixed 250 ms and then read the page. A read that met the redirect half-way threw ('Execution
  // context was destroyed', 'page is navigating'): outside any catch that ended the whole exam with no
  // route record, and inside one it failed a correct screen for 'could not capture evidence'. And the
  // NEXT address was refused by the browser ('interrupted by another navigation') and filed as that
  // screen's own navigation failure — the same after any navigation that really failed, whose error
  // page was still arriving.
  //
  // So the exam does what the required-routes exam does: it lets the page settle before it reads, and
  // a read or a navigation that still loses the race is made once more after the page has arrived.
  // Twice, never more: an address that cannot be opened or read then is reported, as before.
  const read = async (reading) => {
    try {
      return await reading();
    } catch {
      await page.waitForLoadState('load', { timeout: 5000 }).catch(() => undefined);
      await settle(page).catch(() => undefined);
    }
    try {
      return await reading();
    } catch {
      return null;
    }
  };
  const open = async (address) => {
    let response;
    try {
      response = await page.goto(address, { waitUntil: 'load' });
    } catch (err) {
      const said = String(err);
      if (!said.includes('interrupted by another navigation') && !said.includes('ERR_ABORTED')) throw err;
      await page.waitForLoadState('load', { timeout: 5000 }).catch(() => undefined);
      response = await page.goto(address, { waitUntil: 'load' });
    }
    // A page that never stops being busy is still read: what it shows by then is what is graded.
    await settle(page).catch(() => undefined);
    return response;
  };

  // 1. The app must boot at all. Everything below is meaningless if this fails, and saying so here
  //    means the failure names the boot rather than a screen that never had a chance.
  const first = await open('/');
  expect(first, 'the app did not respond on /').not.toBeNull();
  expect(first.status(), 'the app did not serve / successfully').toBeLessThan(400);

  // The navigation is read from wherever the entry page ARRIVED: an entry that redirects by script
  // shows no links until it has.
  const offered = (await read(() => crawlNav(page))) || ['/'];
  // E14 — BOTH lists, not one or the other. The screens the requirements name are graded first, and
  // the screens the app itself links to are still walked: the list is now really written on every
  // build that has requirements, so 'the list replaces the crawl' would have switched the crawl — and
  // with it every dead link this exam catches — off for good.
  const declared = declaredRoutes();
  const routes = declared.concat(offered.filter((route) => !declared.includes(route)));
  const failures = [];
  // Every wait below is bounded per screen, so the budget follows the number of screens.
  test.setTimeout(120000 + routes.length * 25000);

  const grade = async (route) => {
    const slug = slugFor(route);
    const before = errors.length;
    let status = null;
    let contentType = '';
    try {
      const res = await open(route);
      status = res ? res.status() : null;
      contentType = res ? String(res.headers()['content-type'] || '').toLowerCase() : '';
    } catch (err) {
      // A11 — the app answered this address with a FILE (a brochure, an export): the browser starts a
      // download and abandons the navigation, which is the link working. Not a screen; nothing to grade.
      if (String(err).includes('Download is starting')) return;
      failures.push(route + ': navigation threw — ' + String(err));
      logRoute(route, 'navigation_threw', err, null, []);
      return;
    }
    // A11 — likewise an address answered successfully with something that is not a page (a feed, a
    // JSON document, an image shown inline). An address that FAILS is still graded below, whatever
    // its body is: a dead link answered with a JSON 'not found' is a dead link.
    if (status !== null && status < 400 && contentType !== '' && !contentType.includes('html')) return;

    // A14 — A SCREEN STILL LOADING HAS NOT RENDERED NOTHING. 250 ms after 'load' a screen that waits
    // for its first request (a cold session check) shows a spinner with no text, and was filed as
    // rendered_nothing. The page has settled above — the network went quiet and nothing says it is
    // busy — and a screen that paints on a timer of its own is given a few seconds more. One that
    // shows nothing after all that renders nothing, and fails exactly as before.
    let render = await read(() => renderedSomething(page));
    const paintBy = Date.now() + 5000;
    while (render !== null && !render.ok && (status === null || status < 400) && Date.now() < paintBy) {
      await page.waitForTimeout(250);
      render = await read(() => renderedSomething(page));
    }

    // E14 — a screen the requirements name and the app does NOT link to is GRADED here and nothing
    // more. Its evidence belongs to the required-routes exam, which signs in and proves which screen
    // it captured: this walk may have been sent to the sign-in page, and that page saved under the
    // screen's own name would be graded as the screen. For the same reason its status is the
    // requirement's business, not this exam's — 'opening an order that does not exist shows Not
    // found' is a 404 by design, and a protected screen may answer a visitor 401. Only a SERVER
    // failure is a failure whoever asked for the address.
    const linked = offered.includes(route);

    // Evidence FIRST, so a screen that then fails an assertion still leaves artefacts on disk.
    // 'reality proof not met' exists because evidence was missing, not because a screen was broken.
    if (linked) {
      try {
        const shot = await read(() => page.screenshot({ fullPage: true }));
        const html = await read(() => page.content());
        if (shot === null || html === null) throw new Error('the page could not be read: it was still navigating');
        fs.writeFileSync(path.join(ARTIFACT_DIR, slug + '.png'), shot);
        fs.writeFileSync(path.join(ARTIFACT_DIR, slug + '.html'), html);
      } catch (err) {
        failures.push(route + ': could not capture evidence — ' + String(err));
        logRoute(route, 'evidence_capture_failed', err, status, []);
      }
    }

    const freshSources = Array.from(new Set(errorSources.slice(before).flat()));
    if (status !== null && (status >= 500 || (linked && status >= 400))) {
      failures.push(route + ': served HTTP ' + status);
      logRoute(route, 'http_error', 'served HTTP ' + status, status, freshSources);
      return;
    }
    if (render === null) {
      failures.push(route + ': navigation threw — the page was still navigating and could not be read');
      logRoute(route, 'navigation_threw', 'the page was still navigating and could not be read', status, freshSources);
    } else if (!render.ok) {
      failures.push(route + ': rendered nothing (text ' + render.text + ', elements ' + render.elements + ')');
      logRoute(route, 'rendered_nothing', 'text ' + render.text + ', elements ' + render.elements, status, freshSources);
    }
    const fresh = errors.slice(before);
    if (fresh.length > 0) {
      failures.push(route + ': ' + fresh.slice(0, 3).join(' | '));
      logRoute(route, 'runtime_error', fresh.slice(0, 3).join(' | '), status, freshSources);
    }
    // 'ok' says a capture of this route is on disk under its name; a screen graded only has none.
    if (linked && !routeLog.some((r) => r.route === route)) logRoute(route, 'ok', '', status, []);
  };

  try {
    for (const route of routes) {
      try {
        await grade(route);
      } catch (err) {
        // Nothing a screen does may end the walk: the screens after it are still owed a result.
        failures.push(route + ': navigation threw — ' + String(err));
        logRoute(route, 'navigation_threw', err, null, []);
      }
    }
  } finally {
    // Written whatever happened above, so a failing run always says which screens it reached.
    try {
      fs.mkdirSync(path.dirname(ROUTE_LOG_FILE), { recursive: true });
      fs.writeFileSync(ROUTE_LOG_FILE, JSON.stringify({ version: 1, routes: routeLog }, null, 2));
    } catch {
      // The structured log is attribution evidence, never a reason to change the exam's verdict.
    }
  }

  // ONE assertion carrying EVERY failing screen. Failing on the first would hide the rest, and the
  // correction loop would then fix one screen per cycle — the shape that burns a run's whole budget.
  expect(failures, 'screens that did not load cleanly:\n' + failures.join('\n')).toEqual([]);
});
