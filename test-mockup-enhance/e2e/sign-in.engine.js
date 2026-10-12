import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ENGINE-OWNED sign-in step (E2) — regenerated before every web acceptance gate; do not edit.
// Signs in ONCE as the seeded admin and saves the session for the specs that opt in:
//   test.use({ storageState: '.qa/auth/state.json' });
const SESSION_FILE = '.qa/auth/state.json';
const NO_SESSION = JSON.stringify({ cookies: [], origins: [] });
// The whole step is bounded: an app that never answers costs the suite this long, once, and no more.
const SETUP_LIMIT = 90000;
const authGated = process.env.ENGINE_QA_APP_AUTH_GATED === 'true';
const adminEmail = process.env.APP_INITIAL_ADMIN_EMAIL || '';
const adminPassword = process.env.APP_INITIAL_ADMIN_PASSWORD || '';
let declaredAuthRoutes = [];
try {
  const named = JSON.parse(process.env.ENGINE_QA_CAPTURE_AUTH_ROUTES || '[]');
  if (Array.isArray(named)) declaredAuthRoutes = named;
} catch {
  declaredAuthRoutes = [];
}
// ── the required-routes exam's own sign-in, verbatim ──────────────────────────────────────────────
const SIGN_IN_SEGMENT = /^(login|log-in|log_in|signin|sign-in|sign_in|auth|authenticate|sso)$/i;
// Where the app's sign-in form may be when the page the app sent the visitor to does not hold one: the
// conventional pages first, then any page the app itself names. A server API route is never a page —
// there is no form on it — so one is never opened, whoever names it.
function signInPages() {
  const pages = ['/login', '/sign-in', '/signin'];
  for (const named of declaredAuthRoutes) {
    if (typeof named !== 'string' || !named.startsWith('/') || named.startsWith('//')) continue;
    if (named.split('/').some((segment) => /^(api|graphql|trpc|rpc|rest|v\d+)$/i.test(segment))) continue;
    if (!pages.includes(named)) pages.push(named);
  }
  return pages;
}
// Every wait of the sign-in check has its own limit: an app that never answers costs seconds, not the test.
const STEP_LIMIT = 10000;
// The screen a visitor is looking at: the path, plus the hash when the app routes by hash (/#/login).
function screenOf(url) {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  return url.hash.startsWith('#/') ? path + url.hash.split('?')[0] : path;
}
function namesSignIn(url) {
  return screenOf(url).split(/[/#]+/).some((segment) => SIGN_IN_SEGMENT.test(segment));
}
// The app's sign-in form, recognised by what it IS: a form holding exactly one visible password field. Two
// or more is a sign-up or a change of password, and so is a field marked new-password or a form whose
// button says "Sign up". Null when the page shows none — or is between two documents, when nothing can
// be said about it yet.
async function signInForm(page) {
  try {
    const shown = 'input[type="password"]:visible';
    if ((await page.locator(shown).count()) === 0) return null;
    const forms = page.locator('form', { has: page.locator(shown) });
    const scopes = [];
    const count = await forms.count();
    for (let index = 0; index < count; index++) scopes.push(forms.nth(index));
    // A form built without a form element: the page is the form.
    if (scopes.length === 0) scopes.push(page.locator('body'));
    for (const scope of scopes) {
      const fields = scope.locator(shown);
      if ((await fields.count()) !== 1) continue;
      if (/new-password/i.test((await fields.first().getAttribute('autocomplete')) || '')) continue;
      const submit = await submitControl(scope, fields.first());
      if (submit !== null && SIGN_UP_WORDS.test(submit.label)) continue;
      // What the form is made of: its controls and its buttons' words, never a value. It tells the app's
      // sign-in form from another form with one password field — an admin's "create user" screen.
      const mark = await scope.evaluate((node) => Array.from(node.querySelectorAll('input, select, textarea, button'))
        .map((control) => [control.tagName, control.getAttribute('type') || '', control.getAttribute('name') || '', control.id || '',
          control.tagName === 'BUTTON' ? String(control.innerText || '').replace(/\s+/g, ' ').trim() : ''].join(':')).join('|'));
      return { scope, password: fields.first(), mark };
    }
  } catch {
    // between two documents
  }
  return null;
}
// What the app is saying to the visitor: alerts, live regions and anything it styles as an error. A
// wrapper that holds the form's own controls is not a message.
const SAID = '[role="alert"]:visible, [role="status"]:visible, [aria-live]:visible, [class*="error" i]:visible, ' +
  '[class*="invalid" i]:visible, [class*="danger" i]:visible, [data-testid*="error" i]:visible';
async function saidOnScreen(page) {
  try {
    return await page.locator(SAID).evaluateAll((nodes) => nodes
      .filter((node) => node.querySelector('input, button, select, textarea') === null)
      .map((node) => String(node.innerText || '').replace(/\s+/g, ' ').trim())
      .filter((text) => text !== ''));
  } catch { return []; }
}
// The app's words go into a build brief: one short line, and never the credential that was typed.
function scrub(text) {
  let out = String(text).replace(/\s+/g, ' ').trim();
  if (adminPassword !== '') out = out.split(adminPassword).join('[redacted]');
  if (adminEmail !== '') out = out.split(adminEmail).join('[the seeded email]');
  return out.length > 160 ? out.slice(0, 157) + '...' : out;
}
// Presses the filled form's button and WATCHES what the app does — the step the capture used to skip.
// MEASURED (stage 2026-10-01, Ledger V1): twelve routes failed with "the sign-in did not establish a
// session the app accepts" while the app itself was answering "Username or password is incorrect.". The
// capture had clicked the button and assumed the rest. Two different things can happen, and they have
// two different owners:
//   'rejected' — the app is still showing its sign-in screen (with its own words, when it gives any);
//   'accepted' — the app left its sign-in screen: the form is gone, or a DIFFERENT form stands there and
//                nothing was refused (the screen behind the gate may hold a password field of its own).
//                Whether the app KEPT the session is settled by the caller, which opens the route again.
// A sign-in answered with a redirect to another screen, which then bounces straight back to the form
// with nothing said and nothing refused, was accepted too: the app let the visitor through and lost them.
// N9 — what the browser holds for the app: its cookies and its two stores, by name. A sign-in leaves
// something here; a refusal, as a rule, does not.
async function heldState(page) {
  try {
    const held = new Map();
    for (const cookie of await page.context().cookies()) held.set('cookie:' + cookie.name, String(cookie.value));
    const stores = await page.evaluate(() => {
      const entries = (store) => Object.keys(store).map((key) => [key, String(store.getItem(key))]);
      return { local: entries(globalThis.localStorage), session: entries(globalThis.sessionStorage) };
    });
    for (const [key, value] of stores.local) held.set('local:' + key, value);
    for (const [key, value] of stores.session) held.set('session:' + key, value);
    return held;
  } catch {
    return null;
  }
}
// Something new the app put in the browser that could be a session: a new or changed entry long enough to
// be a token, and not merely the email the capture typed (a form that remembers the last email does that
// whether or not the sign-in worked).
function gainedSession(before, after) {
  if (before === null || after === null) return false;
  for (const [key, value] of after) {
    if (before.get(key) === value) continue;
    if (value.length < 16 || value.trim() === adminEmail) continue;
    return true;
  }
  return false;
}
// The words of a refusal, in whatever form the app says it.
const REFUSAL_WORDS = /incorrect|invalid|wrong|not (?:correct|valid|recogni[sz]ed|match)|(?:does|did)(?:n['’]t| not) match|fail|denied|unauthori[sz]ed|forbidden|locked|too many|try again|unable|could not|couldn['’]t|error|expired|disabled|not found|unknown|required/i;
async function pressAndWatch(page, mark, press) {
  const attempt = { outcome: 'rejected', said: '', answered: '', stayed: false, mark, blind: false };
  const startedOn = screenOf(new URL(page.url()));
  const heldBefore = await heldState(page);
  const refusals = [];
  let movedOn = false;
  const onResponse = (response) => {
    try {
      const request = response.request();
      if (request.method() === 'GET') return;
      const status = response.status();
      if (status >= 400) {
        refusals.push(request.method() + ' ' + new URL(response.url()).pathname + ' answered ' + status);
      } else if (status >= 300) {
        const location = response.headers()['location'];
        if (!location) return;
        const sentTo = new URL(location, response.url());
        if (screenOf(sentTo) !== startedOn && !namesSignIn(sentTo)) movedOn = true;
      }
    } catch {
      // a response that cannot be read says nothing
    }
  };
  const saidBefore = await saidOnScreen(page);
  page.on('response', onResponse);
  try {
    await press();
    const deadline = Date.now() + STEP_LIMIT;
    while (Date.now() < deadline) {
      await page.waitForTimeout(250);
      let shown = await signInForm(page);
      if (shown === null || shown.mark !== mark) {
        // The form is gone — or the page is between two documents. Let it finish, then look again.
        await page.waitForLoadState('load', { timeout: STEP_LIMIT }).catch(() => undefined);
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
        shown = await signInForm(page);
        if (shown === null || (shown.mark !== mark && refusals.length === 0)) { attempt.outcome = 'accepted'; break; }
      }
      const answered = refusals.length > 0 || movedOn;
      // The app's words can land a moment after its answer.
      if (answered) await page.waitForTimeout(500);
      const said = (await saidOnScreen(page)).find((text) => !saidBefore.includes(text));
      if (said !== undefined) attempt.said = scrub(said);
      if (attempt.said !== '' || answered) break;
    }
  } finally {
    page.off('response', onResponse);
  }
  if (refusals.length > 0) attempt.answered = refusals[refusals.length - 1];
  if (attempt.outcome === 'rejected' && attempt.said === '' && refusals.length === 0 && movedOn) attempt.outcome = 'accepted';
  // N9 — a sign-in page that STAYS after a successful sign-in: the form remains (to switch account) and the
  // app says so beside it ("✓ Signed in as Clinic Administrator"). Read as a refusal, every gated screen
  // was captured signed out (Clinic, stage build of 2026-09-28). Accepted only when nothing was refused,
  // what the app said is not a refusal, and the app left a session in the browser.
  if (attempt.outcome === 'rejected' && refusals.length === 0 && !REFUSAL_WORDS.test(attempt.said) &&
      gainedSession(heldBefore, await heldState(page))) {
    attempt.outcome = 'accepted';
  }
  attempt.stayed = attempt.outcome === 'accepted' && screenOf(new URL(page.url())) === startedOn;
  return attempt;
}
function rejectedMessage(attempt) {
  return 'the app rejected the seeded credential: the capture filled the sign-in form with ' +
    'APP_INITIAL_ADMIN_EMAIL and APP_INITIAL_ADMIN_PASSWORD, and the app still showed its sign-in screen' +
    (attempt.said !== '' ? ', saying "' + attempt.said + '"' : '') +
    (attempt.answered !== '' ? ' (' + attempt.answered + ')' : '') +
    // Only the password was typed: the refusal may be of the form, not of the credential.
    (attempt.blind ? ' — no field for the email or username was found in the form, so only the password was typed' : '');
}
const SESSION_NOT_KEPT = 'the app accepted the sign-in but did not keep the session: it left its sign-in ' +
  'screen after the seeded admin credential was submitted, and then sent this protected route back to it';
// The fields and the button are found INSIDE the form that holds the password field, by what they are.
// The capture used to take the first field and the first button on the whole page: a "Company code"
// field above the email received the email, a "Sign in with Google" button above the form received the
// click, and a hidden field standing first was waited on until the test's whole budget ran out.
const TEXT_FIELD = 'input:visible:not([type="password"]):not([type="hidden"]):not([type="checkbox"])' +
  ':not([type="radio"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="file"])';
const SIGN_IN_WORDS = /^(sign[ -]?in|log[ -]?in|continue|next|submit|enter)\b/i;
const SIGN_UP_WORDS = /sign[ -]?up|register|create (an |my |your |a new |new )?account|join|get started/i;
const PROVIDER_WORDS = /google|github|gitlab|facebook|apple|microsoft|twitter|linkedin|okta|\bsso\b|passkey|magic link/i;
// The identifier field: what the form itself says first (autocomplete, type), then its name, its label
// and its placeholder, and — when nothing names it — the text field nearest above the password.
async function identityField(form) {
  const texts = form.scope.locator(TEXT_FIELD);
  const hints = [
    form.scope.locator('[autocomplete~="username" i], [autocomplete~="email" i]'),
    form.scope.locator('[type="email"]'),
    form.scope.locator('[name*="email" i], [id*="email" i]'),
    form.scope.locator('[name*="user" i], [name*="login" i], [id*="user" i], [id*="login" i]'),
    form.scope.getByLabel(/e-?mail|user ?name|login/i),
    form.scope.getByPlaceholder(/e-?mail|user ?name|login/i),
  ];
  for (const hint of hints) {
    const named = texts.and(hint);
    if ((await named.count()) > 0) return named.first();
  }
  const above = form.password.locator('xpath=preceding::input[not(@type) or @type="text" or @type="email" or @type="tel"][1]');
  if ((await above.count()) > 0 && (await above.first().isVisible())) return above.first();
  return null;
}
// The control that submits: a submit button of the form, or a button worded as a sign-in — never simply
// the first one. A provider button and a show-password toggle are buttons too. Among equals, the one
// after the anchor field wins.
async function submitControl(scope, anchor) {
  const controls = scope.locator('button:visible, input[type="submit"]:visible, [role="button"]:visible');
  // The anchor was counted a moment ago: if it is gone already, the page is changing — say so at once.
  const handle = await anchor.elementHandle({ timeout: 1000 });
  try {
    const best = await controls.evaluateAll((nodes, given) => {
      const worded = new RegExp(given.words, 'i');
      const provider = new RegExp(given.providers, 'i');
      let found = null;
      nodes.forEach((node, index) => {
        const label = String(node.innerText || node.value || node.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
        const type = String(node.getAttribute('type') || '').toLowerCase();
        if (provider.test(label) || type === 'reset') return;
        const submits = type === 'submit' || (type === '' && node.tagName === 'BUTTON' && node.closest('form') !== null);
        const named = worded.test(label);
        if (!submits && !named) return;
        const after = given.anchor !== null && (given.anchor.compareDocumentPosition(node) & 4) !== 0;
        const score = (submits ? 4 : 0) + (named ? 2 : 0) + (after ? 1 : 0);
        if (found === null || score >= found.score) found = { index, label, score };
      });
      return found;
    }, { anchor: handle, words: SIGN_IN_WORDS.source, providers: PROVIDER_WORDS.source });
    return best === null ? null : { control: controls.nth(best.index), label: best.label };
  } finally {
    if (handle) await handle.dispose().catch(() => undefined);
  }
}
// Fills the sign-in form and presses its button. Every action has its own limit, and the caller catches
// what they throw: Playwright's timeout error quotes the value it was typing, and that value is the
// credential.
async function fillAndPress(page, form) {
  const identity = await identityField(form);
  if (identity !== null && (await identity.isEditable())) await identity.fill(adminEmail, { timeout: STEP_LIMIT });
  await form.password.fill(adminPassword, { timeout: STEP_LIMIT });
  const attempt = await pressAndWatch(page, form.mark, async () => {
    // Chosen after the fields are filled: many forms keep the button disabled, or swap it, until then.
    const submit = await submitControl(form.scope, form.password);
    if (submit !== null) await submit.control.click({ timeout: STEP_LIMIT });
    else await form.password.press('Enter', { timeout: STEP_LIMIT });
  });
  attempt.blind = identity === null;
  return attempt;
}
// A sign-in that asks for the identifier first and shows the password field second: fill the first step,
// continue, and wait — within the limit — for the password. Called only on an address that names a
// sign-in screen, so the email is never typed into some other page's form.
async function passwordStep(page) {
  const named = page.locator(TEXT_FIELD).and(page.locator('[autocomplete~="username" i], [autocomplete~="email" i], ' +
    '[type="email"], [name*="email" i], [id*="email" i], [name*="user" i], [name*="login" i], [id*="user" i], [id*="login" i]'));
  if ((await named.count()) === 0) return null;
  const identity = named.first();
  await identity.fill(adminEmail, { timeout: STEP_LIMIT });
  const own = identity.locator('xpath=ancestor::form[1]');
  const next = await submitControl((await own.count()) > 0 ? own.first() : page.locator('body'), identity);
  if (next !== null) await next.control.click({ timeout: STEP_LIMIT });
  else await identity.press('Enter', { timeout: STEP_LIMIT });
  await page.locator('input[type="password"]:visible').first().waitFor({ state: 'visible', timeout: STEP_LIMIT });
  return await signInForm(page);
}
// Form sign-in with the credential the platform minted for THIS app. Never throws: the outcome is 'no_form'
// when no sign-in form could be found or completed, and otherwise what the app did with it.
//
// The form is looked for on the page the app itself sent the visitor to FIRST — the one address known to
// be the app's sign-in screen, and it already carries the app's own return address. The capture used to
// leave that page for a list of the app's server routes (/api/auth/login), where no form can be.
async function signIn(page, baseURL, gate) {
  // A page whose form could not be completed is not opened a second time under another name.
  const failedOn = [];
  try {
    // With no form on display the gate was recognised by its address, so this IS a sign-in address.
    const form = gate.form !== null ? gate.form : await passwordStep(page);
    if (form !== null) {
      failedOn.push(screenOf(new URL(page.url())));
      return await fillAndPress(page, form);
    }
  } catch {
    // the form on this page could not be completed: look for the app's sign-in page
  }
  for (const candidate of signInPages()) {
    try {
      const address = new URL(candidate, baseURL);
      if (failedOn.includes(screenOf(address))) continue;
      const response = await page.goto(address.href, { waitUntil: 'load', timeout: 2 * STEP_LIMIT });
      if (!response || response.status() >= 400) continue;
      await settle(page).catch(() => undefined);
      const form = (await signInForm(page)) || (await passwordStep(page));
      if (form === null) continue;
      failedOn.push(screenOf(new URL(page.url())));
      return await fillAndPress(page, form);
    } catch {
      // try the next page
    }
  }
  return { outcome: 'no_form', said: '', answered: '', stayed: false, mark: '', blind: false };
}
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await expect.poll(() => page.locator('[aria-busy="true"]:visible').count(), { timeout: 10000 }).toBe(0);
}
// ──────────────────────────────────────────────────────────────────────────────────────────────────
function save(state) {
  const directory = path.dirname(SESSION_FILE);
  fs.mkdirSync(directory, { recursive: true });
  // A live session is never source: nothing in this directory may be staged by a git add of the app.
  fs.writeFileSync(path.join(directory, '.gitignore'), '*\n');
  fs.writeFileSync(SESSION_FILE, state, { mode: 0o600 });
}
function forget() {
  try {
    fs.rmSync(SESSION_FILE, { force: true });
  } catch {
    // nothing to remove
  }
}
// Why no session was saved — said once, and never with a credential in it.
let said = false;
function say(why) {
  if (said) return;
  said = true;
  console.log('[engine sign-in] no session was saved, so a spec that opts in to ' + SESSION_FILE + ' runs signed out: ' + why);
}
// Signs in through the app's own form. Resolves to { state } or { why }; the browser is the caller's to close.
async function signInOnce(held, baseURL) {
  held.browser = await chromium.launch({ headless: true });
  const context = await held.browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto(baseURL, { waitUntil: 'load', timeout: 2 * STEP_LIMIT });
  await settle(page).catch(() => undefined);
  const form = await signInForm(page);
  // The entry page is public and shows no sign-in form: the sign-in page is found by its name, from a
  // blank page — so the seeded email is never typed into some other form the public page holds.
  if (form === null && !namesSignIn(new URL(page.url()))) await page.goto('about:blank');
  const attempt = await signIn(page, baseURL, { away: false, form });
  if (attempt.outcome === 'no_form') {
    return { why: 'no sign-in form could be completed on the entry page or at /login, /sign-in, /signin' +
      (declaredAuthRoutes.length > 0 ? ', ' + declaredAuthRoutes.filter((named) => typeof named === 'string').join(', ') : '') };
  }
  if (attempt.outcome === 'rejected') return { why: rejectedMessage(attempt) };
  await settle(page).catch(() => undefined);
  const state = await context.storageState();
  const carried = state.cookies.length + state.origins.reduce((count, origin) => count + (origin.localStorage || []).length, 0);
  if (carried === 0) {
    return { why: 'the app accepted the sign-in and left neither a cookie nor a localStorage entry — a session kept ' +
      'only in memory or in sessionStorage cannot be saved, so such a spec signs in itself' };
  }
  return { state: JSON.stringify(state) };
}
// Playwright calls this once before the first spec; the function it returns runs once after the last.
export default async function signInBeforeTheSuite(config) {
  const held = { browser: null };
  let timer;
  try {
    // FIRST, an empty session: a spec that opted in must find a readable file whatever happens below.
    save(NO_SESSION);
    // An app with no login: nothing to do, and nothing to say.
    if (!authGated) return forget;
    if (adminEmail === '' || adminPassword === '') {
      say('this app has a login, and APP_INITIAL_ADMIN_EMAIL / APP_INITIAL_ADMIN_PASSWORD were not both supplied to the suite');
      return forget;
    }
    const project = config && config.projects && config.projects[0];
    const baseURL = (project && project.use && project.use.baseURL) || (config && config.webServer && config.webServer.url) || '';
    if (baseURL === '') {
      say('the suite has no base URL to sign in at');
      return forget;
    }
    const cannotRun = (err) => ({ why: 'the sign-in step could not run (' + scrub(String(err && err.message ? err.message : err).split('\n')[0]) + ')' });
    const result = await Promise.race([
      signInOnce(held, baseURL).catch(cannotRun),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve({ why: 'the sign-in did not finish within ' + SETUP_LIMIT / 1000 + ' seconds' }), SETUP_LIMIT);
      }),
    ]);
    if (result.state) save(result.state);
    else say(result.why);
  } catch (err) {
    say('the sign-in step could not run (' + scrub(String(err && err.message ? err.message : err).split('\n')[0]) + ')');
  } finally {
    if (timer) clearTimeout(timer);
    if (held.browser) await held.browser.close().catch(() => undefined);
  }
  return forget;
}
