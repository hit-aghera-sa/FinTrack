import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// ENGINE-OWNED acceptance exam (QAV-01) — regenerated before every web acceptance gate; do not edit.
const ARTIFACT_DIR = '.qa/shots';
const REQUIRED_ROUTES_FILE = '.qa/required-routes.json';
// SBR-1D: one structured record per walked route, so a failing screen can be routed to the lane that
// renders it instead of to whoever owns this suite. Written BEFORE the assertion, so it exists on failure.
const ROUTE_LOG_FILE = '.qa/exam-routes.json';

/** Source URLs a stack or console location names — the files the app served that threw. Line:col dropped. */
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

/** The authoritative route list when one was written; null when the app's own nav is the source. */
function declaredRoutes() {
  try {
    const parsed = JSON.parse(fs.readFileSync(REQUIRED_ROUTES_FILE, 'utf8'));
    const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.routes) ? parsed.routes : null;
    if (!list) return null;
    const routes = list.filter((r) => typeof r === 'string' && r.startsWith('/'));
    return routes.length > 0 ? Array.from(new Set(routes)) : null;
  } catch {
    return null;
  }
}

/** Every same-origin route the shell links to from '/' — the app's own account of its screens. */
async function crawlNav(page) {
  const hrefs = await page.evaluate(() =>
    Array.from(globalThis.document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')).filter(Boolean),
  );
  const routes = new Set(['/']);
  for (const href of hrefs) {
    if (/^(https?:|mailto:|tel:|data:|blob:|#)/i.test(href)) continue;
    const clean = (href.startsWith('/') ? href : '/' + href.replace(/^\.\//, '')).split('?')[0].split('#')[0];
    // A parameterised link ('/orders/:id') is a template, not a distinct screen to grade.
    if (/:[A-Za-z]/.test(clean)) continue;
    if (clean.length > 1) routes.add(clean.replace(/\/+$/, ''));
  }
  // Bound the walk: a nav linking a hundred screens is a crawl, not an exam, and the gate has a budget.
  return Array.from(routes).slice(0, 12);
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

test('the app boots, and every screen it offers loads clean', async ({ page }) => {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

  const errors = [];
  const errorSources = [];
  page.on('pageerror', (e) => {
    errors.push('pageerror: ' + String(e));
    errorSources.push(sourceUrlsOf(e && e.stack));
  });
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    errors.push('console.error: ' + msg.text());
    const loc = typeof msg.location === 'function' ? msg.location() : null;
    errorSources.push(sourceUrlsOf((loc && loc.url ? loc.url : '') + ' ' + msg.text()));
  });
  const routeLog = [];
  const logRoute = (route, kind, detail, status, sources) =>
    routeLog.push({ route, kind, detail: String(detail).slice(0, 500), status, sourceUrls: sources || [] });

  // 1. The app must boot at all. Everything below is meaningless if this fails, and saying so here
  //    means the failure names the boot rather than a screen that never had a chance.
  const first = await page.goto('/', { waitUntil: 'load' });
  expect(first, 'the app did not respond on /').not.toBeNull();
  expect(first.status(), 'the app did not serve / successfully').toBeLessThan(400);

  const routes = declaredRoutes() ?? (await crawlNav(page));
  const failures = [];

  for (const route of routes) {
    const slug = slugFor(route);
    const before = errors.length;
    let status = null;
    try {
      const res = await page.goto(route, { waitUntil: 'load' });
      status = res ? res.status() : null;
      await page.waitForTimeout(250);
    } catch (err) {
      failures.push(route + ': navigation threw — ' + String(err));
      logRoute(route, 'navigation_threw', err, null, []);
      continue;
    }

    // Evidence FIRST, so a screen that then fails an assertion still leaves artefacts on disk.
    // 'reality proof not met' exists because evidence was missing, not because a screen was broken.
    try {
      fs.writeFileSync(path.join(ARTIFACT_DIR, slug + '.png'), await page.screenshot({ fullPage: true }));
      fs.writeFileSync(path.join(ARTIFACT_DIR, slug + '.html'), await page.content());
    } catch (err) {
      failures.push(route + ': could not capture evidence — ' + String(err));
      logRoute(route, 'evidence_capture_failed', err, status, []);
    }

    const freshSources = Array.from(new Set(errorSources.slice(before).flat()));
    if (status !== null && status >= 400) {
      failures.push(route + ': served HTTP ' + status);
      logRoute(route, 'http_error', 'served HTTP ' + status, status, freshSources);
      continue;
    }
    const render = await renderedSomething(page);
    if (!render.ok) {
      failures.push(route + ': rendered nothing (text ' + render.text + ', elements ' + render.elements + ')');
      logRoute(route, 'rendered_nothing', 'text ' + render.text + ', elements ' + render.elements, status, freshSources);
    }
    const fresh = errors.slice(before);
    if (fresh.length > 0) {
      failures.push(route + ': ' + fresh.slice(0, 3).join(' | '));
      logRoute(route, 'runtime_error', fresh.slice(0, 3).join(' | '), status, freshSources);
    }
    if (!routeLog.some((r) => r.route === route)) logRoute(route, 'ok', '', status, []);
  }

  try {
    fs.mkdirSync(path.dirname(ROUTE_LOG_FILE), { recursive: true });
    fs.writeFileSync(ROUTE_LOG_FILE, JSON.stringify({ version: 1, routes: routeLog }, null, 2));
  } catch {
    // The structured log is attribution evidence, never a reason to change the exam's verdict.
  }

  // ONE assertion carrying EVERY failing screen. Failing on the first would hide the rest, and the
  // correction loop would then fix one screen per cycle — the shape that burns a run's whole budget.
  expect(failures, 'screens that did not load cleanly:\n' + failures.join('\n')).toEqual([]);
});
