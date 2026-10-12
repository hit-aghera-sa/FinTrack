import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createHash } from 'node:crypto';

// ENGINE-OWNED: capture addresses only. The independent acceptance oracle grades the contents.
const routes = JSON.parse(process.env.ENGINE_QA_CAPTURE_ROUTES || '[]');
const authGated = process.env.ENGINE_QA_APP_AUTH_GATED === 'true';
const declaredAuthRoutes = JSON.parse(process.env.ENGINE_QA_CAPTURE_AUTH_ROUTES || '[]');
const adminEmail = process.env.APP_INITIAL_ADMIN_EMAIL || '';
const adminPassword = process.env.APP_INITIAL_ADMIN_PASSWORD || '';
const haveCredential = authGated && adminEmail !== '' && adminPassword !== '';
// Conventional sign-in entries, used only when the app named none of its own.
const AUTH_ENTRY = /^\/(login|log-in|signin|sign-in|auth|authenticate|session|sessions|account\/login|users\/sign_in)(\/|$)/i;
function routeKey(url) {
  return (url.pathname.replace(/\/+$/, '') || '/') + url.search + url.hash;
}
// <route-arrival> — the same rule as routeArrival() in the engine; a test pins the two together.
const SIGN_IN_SEGMENT = /^(login|log-in|log_in|signin|sign-in|sign_in|auth|authenticate|sso)$/i;
function splitRoute(route) {
  try {
    const url = new URL(route, 'http://capture.invalid');
    return { path: url.pathname.replace(/\/+$/, '') || '/', state: url.search + url.hash };
  } catch { return null; }
}
const PARAM_SEGMENT = /^(?::[A-Za-z_][\w-]*|\[[^\]/]+\]|\{[^}/]+\})$/;
const NOT_A_RECORD = /^(new|create|add)$/i;
function pathSegments(path) {
  return path.split('/').filter((segment) => segment !== '').map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
}
function isRoutePattern(route) {
  const split = splitRoute(route);
  return split !== null && pathSegments(split.path).some((segment) => PARAM_SEGMENT.test(segment));
}
function matchesRoutePattern(pattern, observed) {
  const want = splitRoute(pattern);
  const got = splitRoute(observed);
  if (!want || !got) return false;
  const wanted = pathSegments(want.path);
  const given = pathSegments(got.path);
  if (wanted.length !== given.length) return false;
  let sawParameter = false;
  for (let index = 0; index < wanted.length; index++) {
    if (PARAM_SEGMENT.test(wanted[index])) {
      sawParameter = true;
      const value = given[index];
      if (PARAM_SEGMENT.test(value) || NOT_A_RECORD.test(value) || SIGN_IN_SEGMENT.test(value)) return false;
    } else if (wanted[index] !== given[index]) return false;
  }
  return sawParameter;
}
function routeArrival(requested, observed, requiredRoutes) {
  const want = splitRoute(requested);
  const got = splitRoute(observed);
  if (!want || !got) return requested === observed ? 'exact' : 'elsewhere';
  if (pathSegments(want.path).some((segment) => PARAM_SEGMENT.test(segment))) {
    if (!matchesRoutePattern(requested, observed)) return 'elsewhere';
    return want.state === '' || want.state === got.state ? 'pattern_match' : 'elsewhere';
  }
  if (want.path === got.path && want.state === got.state) return 'exact';
  if (want.state !== '') return 'elsewhere';
  if (want.path === got.path) return 'default_state';
  if (got.path.split('/').some((segment) => SIGN_IN_SEGMENT.test(segment))) return 'elsewhere';
  if (want.path === '/') {
    return (requiredRoutes || []).some((route) => { const r = splitRoute(route); return r !== null && r.path === got.path; }) ? 'root_redirect' : 'elsewhere';
  }
  return got.path.startsWith(want.path + '/') ? 'index_redirect' : 'elsewhere';
}
// </route-arrival>
// <token-route>
// A page the app reaches only through a link it SENDS — a password reset, an email check, an invitation, an
// activation, a magic link. No screen links to one, so when following links finds none, the test below opens it
// with a made-up token instead. A parameter is such a link's token when its name is token, otp or signature, or
// one of those qualified only by words of such a link (:resetToken, :verificationToken, :inviteToken,
// :emailVerificationToken) — or is a code, key or hash qualified only by such words (:resetCode, :inviteCode,
// :verificationCode, :activationKey) — or is :code, :key or :hash under a segment that only such a link has
// (/reset-password/:code, /verify-email/:key, /invitations/accept/:code). Never a parameter named id or …Id, and
// never a token named for a record (:orderToken, :bookingToken, :paymentToken): a record keyed by a token, a code,
// a key or a hash (/coupons/:code, /projects/:key, /files/:hash) is a record, and so is anything under a bare
// /confirm, /verify, /invite or /reset.
const TOKEN_WORD = /^(?:token|tokens|otp|signature)$/;
const LINK_WORD = /^(?:reset|password|verify|verification|invite|invitation|magic|activation|activate|confirm|confirmation|email)$/;
const LINK_KEY = /^(?:code|key|hash)$/;
const LINK_ONLY_SEGMENT = /^(?:reset-password|password-reset|set-password|verify-email|email-verification|confirm-email|activate|activation|magic-link|accept-invite)$/i;
// The words of a parameter's name: resetToken, reset_token and reset-token are all "reset token".
function parameterWords(segment) {
  return segment.replace(/^[:[{]|[\]}]$/g, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word !== '');
}
function isTokenParameter(segments, index) {
  if (!PARAM_SEGMENT.test(segments[index])) return false;
  const words = parameterWords(segments[index]);
  if (words.length === 0 || words[words.length - 1] === 'id') return false;
  if (words.some((word) => TOKEN_WORD.test(word))) return words.every((word) => TOKEN_WORD.test(word) || LINK_WORD.test(word));
  if (!LINK_KEY.test(words[words.length - 1])) return false;
  // :resetCode, :inviteCode, :verificationCode, :activationKey — a code, key or hash named only for such a link.
  if (words.length > 1) return words.slice(0, -1).every((word) => LINK_WORD.test(word));
  for (let at = 0; at < index; at++) {
    if (LINK_ONLY_SEGMENT.test(segments[at])) return true;
    if (/^invitations?$/i.test(segments[at]) && at + 1 < index && /^accept$/i.test(segments[at + 1])) return true;
  }
  return false;
}
function isTokenRoute(route) {
  const split = splitRoute(route);
  if (!split) return false;
  const segments = pathSegments(split.path);
  return segments.some((segment, index) => isTokenParameter(segments, index));
}
// The address a made-up token is opened at: each token parameter is 32 hex characters, the shape of a real token,
// derived from the route so that every pass opens the same address (the failure's words are compared between
// passes) and no link the app ever sent can match it. Any OTHER parameter (/orgs/:orgId/invite/:token) is never
// made up: it takes the value a link gave it (patternValues), and without one there is no address — null.
function tokenAddress(route) {
  const split = splitRoute(route);
  if (!split) return null;
  const segments = pathSegments(split.path);
  const out = [];
  for (let index = 0; index < segments.length; index++) {
    if (!PARAM_SEGMENT.test(segments[index])) { out.push(encodeURIComponent(segments[index])); continue; }
    if (isTokenParameter(segments, index)) {
      out.push(createHash('sha256').update('engine-made-up-token ' + route + ' ' + index).digest('hex').slice(0, 32));
      continue;
    }
    const value = patternValues.get(patternKey(segments, index));
    if (value === undefined) return null;
    out.push(encodeURIComponent(value));
  }
  return '/' + out.join('/') + split.state;
}
// </token-route>
// <token-page>
// Does the app show a page of its OWN at a token address? Read from what the page shows (readTokenPage), with the
// record-page check's own words for a wrong page — the not-found screen (C28), the app's error screen, a heading
// that IS a status — written in here from the engine. The app's answer to a made-up token is its own page: its
// message that the link is invalid or has expired, or its form (a new password, a code). Its not-found screen, an
// error screen, a server error, a refusal (401/403), its sign-in screen standing in the page's place and a page that
// renders nothing are not: the route is not mounted, not open to the link's visitor, or the page fails. Null when
// the page is the app's own; otherwise what was seen, and the words it was seen in.
const NOT_FOUND_SCREEN = new RegExp("(?:screen|page|route)\\s+not\\s+found|nothing\\s+(?:lives|is|here|exists)\\s+at|no\\s+(?:route|page|screen)s?\\s+(?:matches|matched|for|at|found)|\\b404\\b\\s*(?:[-—:·|]|not\\s+found|page)", "i");
const ERROR_SCREEN = new RegExp("\\bsomething\\s+went\\s+wrong\\b|\\bunexpected\\s+error\\b|\\ban?\\s+error\\s+(?:has\\s+)?occurred\\b|\\binternal\\s+server\\s+error\\b|\\bserver\\s+error\\b|\\bfailed\\s+to\\s+load\\b|\\b(?:could\\s*not|couldn['’]t|unable\\s+to)\\s+load\\b|\\berror\\s+loading\\b|\\boops\\b", "i");
const STATUS_HEADING = new RegExp("^(?:error\\s*)?(404|50[0-4])\\b", "i");
// The app's own answer to a link that is no good: a word for the link and a word for its state, close together
// ("This link is invalid or has expired", "Invalid or expired token", "This invitation has already been used").
const INVALID_LINK = /\b(?:link|token|code|invitation|invite|url|request)s?\b[^.!?\n]{0,60}?\b(?:invalid|expired|no\s+longer\s+valid|not\s+valid|already\s+(?:been\s+)?used)\b|\b(?:invalid|expired)\b[^.!?\n]{0,40}?\b(?:link|token|code|invitation|invite|url)s?\b/i;
function tokenPageProblem(seen, status) {
  const statusOf = (text) => { const found = STATUS_HEADING.exec(text); return found ? found[1] : ''; };
  if (typeof status === 'number' && status >= 500) return { kind: 'server_error', text: String(status) };
  const notFound = seen.said.find((text) => NOT_FOUND_SCREEN.test(text) || statusOf(text) === '404');
  if (notFound !== undefined) return { kind: 'not_found', text: notFound };
  const notFoundInMain = NOT_FOUND_SCREEN.exec(seen.main);
  if (notFoundInMain !== null) return { kind: 'not_found', text: notFoundInMain[0] };
  if (seen.said.some((text) => INVALID_LINK.test(text)) || INVALID_LINK.test(seen.main)) return null;
  // A page that refuses its visitor (with no word about the link) is not open to the visitor of a sent link, whose
  // whole point is to be.
  if (status === 401 || status === 403) return { kind: 'refused', text: String(status) };
  // A server that has no such page answers 404 ("Cannot GET /reset-password/…") with whatever words it has.
  if (status === 404) return { kind: 'no_page', text: '404' };
  // The app's sign-in screen standing at the address (seen.signIn, read where the page stayed): what an app shows in
  // place of a page it never mounted, or guards. Only the link's invalid/expired words, above, make it an answer.
  if (seen.signIn === true) return { kind: 'sign_in', text: '' };
  if (seen.fields > 0) return null;
  const error = seen.said.find((text) => ERROR_SCREEN.test(text) || /^50[0-4]$/.test(statusOf(text)));
  if (error !== undefined) return { kind: 'error', text: error };
  if (seen.words === 0 && seen.controls === 0) return { kind: 'blank', text: '' };
  return null;
}
// A made-up token's page that stayed at its address and could not be read at all (readTokenPage failed twice) has
// shown no sign of being the app's own: it fails rather than pass unseen. Null otherwise.
function tokenPageUnread(stayed, seen) {
  return stayed && (seen === null || seen === undefined) ? { kind: 'unread', text: '' } : null;
}
// </token-page>
// What a page shows, read in the browser: its headings and messages (h1–h6, role=heading, alert, status and live
// regions — where the record-page check reads them), and its OWN content outside its navigation, header, footer,
// asides and breadcrumb: the visible words, the controls, and the fields that ask for a password or a code.
async function readTokenPage(page) {
  return await page.evaluate(() => {
    const around = 'nav, header, footer, aside, [role="navigation"], [role="banner"], [role="contentinfo"], [role="complementary"], ' +
      '[aria-label*="breadcrumb" i], [class*="breadcrumb" i], [id*="breadcrumb" i]';
    const shown = (element) => typeof element.checkVisibility === 'function' ? element.checkVisibility() : element.getClientRects().length > 0;
    const flat = (text) => String(text || '').replace(/\s+/g, ' ').trim();
    const said = Array.from(globalThis.document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"], [role="alert"], [role="status"], ' +
      '[aria-live="polite"], [aria-live="assertive"]')).filter(shown).map((element) => flat(element.textContent)).filter((text) => text !== '');
    const parts = [];
    if (globalThis.document.body) {
      const walker = globalThis.document.createTreeWalker(globalThis.document.body, globalThis.NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
        const parent = node.parentElement;
        if (!parent || parent.closest(around) || parent.closest('script, style, noscript, template') || !shown(parent)) continue;
        const text = flat(node.nodeValue);
        if (text !== '') parts.push(text);
      }
    }
    const main = parts.join(' ');
    const controls = Array.from(globalThis.document.querySelectorAll('input:not([type="hidden"]), select, textarea, button'))
      .filter((element) => element.closest(around) === null && shown(element));
    const fields = controls.filter((element) => element.tagName === 'INPUT' && (
      String(element.getAttribute('type') || '').toLowerCase() === 'password' ||
      /one-time-code/i.test(element.getAttribute('autocomplete') || '') ||
      /code|otp|token|\bpin\b/i.test([element.getAttribute('name'), element.id, element.getAttribute('placeholder'), element.getAttribute('aria-label')].join(' '))));
    return { said, main, words: main.split(' ').filter((word) => /[A-Za-z0-9]/.test(word)).length, controls: controls.length, fields: fields.length };
  });
}
// The failure, when a token address shows no page of the app's own. Its first words, up to the route and its colon,
// are how the engine reads it (TOKEN_PAGE_PHRASE in required-route-attribution.ts; a test pins the two together).
function tokenPageMessage(route, address, problem, landed) {
  const quoted = problem.text === '' ? '' : ' ("' + scrub(problem.text) + '")';
  const what = problem.kind === 'server_error' ? 'the server answered ' + problem.text + ', so the page fails when it is opened'
    : problem.kind === 'no_page' ? 'the server answered 404, so the route is not mounted'
      : problem.kind === 'refused' ? 'the server answered ' + problem.text + ', so the page is not open to a visitor of the link'
      : problem.kind === 'sign_in' ? 'the app showed its sign-in screen in its place, so the page is not mounted or not open to a visitor of the link'
      : problem.kind === 'unread' ? 'the page could not be read (it was still changing after two tries), so nothing showed it is the app\'s own page'
      : problem.kind === 'same_as_no_page' ? 'the app showed its not-found screen — the same page it shows at ' + problem.text +
        ', an address it has no page for — so the route is not mounted'
      : problem.kind === 'sent_as_no_page' ? 'the app showed its not-found screen — it sent the visitor where it sends one of ' + problem.text +
        ', an address it has no page for — so the route is not mounted'
      : problem.kind === 'error' ? 'the app showed an error screen' + quoted + ', so the page fails when it is opened'
        : problem.kind === 'blank' ? 'the page rendered nothing, so the route is not mounted or the page fails before it renders'
          : 'the app showed its not-found screen' + quoted + ', so the route is not mounted';
  return 'the app shows no page of its own at ' + route + ': ' + what + '. The page is reached only from a link the app sends ' +
    '(a password reset, an email check, an invitation), and no screen links to one: the check opened it as ' + address +
    ' with a made-up token' + (landed !== address ? ' (the app sent it on to ' + landed + ')' : '') +
    ', as a visitor with an old or mistyped link would, and expects the page the app shows there — ' +
    'its form, or its message that the link is invalid or has expired.';
}
// A made-up token's address is opened as the visitor of an old link would open it: signed out, once, and never
// signed in on. A form standing there is the page's own (a reset form is never handed the seeded credential), and a
// sign-in screen it is sent on to is never a gate to pass: whether it is the app's answer is tokenHandled's question.
async function openTokenAddress(page, target, opened) {
  await forgetVisitor(page);
  opened.response = await page.goto(target.href, { waitUntil: 'load' });
  await settle(page);
}
// The app's answer at an address it certainly has no page for: a nonsense address as deep as the token route
// (/<hex>/<hex>, the same on every pass), opened signed out, once per worker and depth. An app that never mounted
// the token route answers the made-up token exactly so — its catch-all's page (the home page, a sign-in form, an
// empty shell), or its catch-all's redirect — which no word on the page needs to say. Null when it could not be read.
const noPageSeen = new Map();
function noPageAddress(depth) {
  const segments = [];
  for (let index = 0; index < depth; index++) segments.push(createHash('sha256').update('engine-no-such-page ' + index).digest('hex').slice(0, 32));
  return '/' + segments.join('/');
}
async function readNoPage(page, baseURL, depth) {
  if (noPageSeen.has(depth)) return noPageSeen.get(depth);
  let answer = null;
  try {
    await forgetVisitor(page);
    const target = new URL(noPageAddress(depth), baseURL);
    await page.goto(target.href, { waitUntil: 'load' });
    await settle(page);
    answer = { address: routeKey(target), landed: routeKey(new URL(page.url())), seen: await readTokenPage(page) };
  } catch {
    answer = null;
  }
  noPageSeen.set(depth, answer);
  return answer;
}
// <token-landing>
// Is the made-up token's answer the app's answer at an address it has no page for (readNoPage)? Where the visitor
// stayed: the same headings and main text. Where the app sent it on: the same path and query. Either way the route is
// not mounted, and is said so in the not-found screen's words (so the suite's own capture of a real page of the route
// may still answer it). Null otherwise, and when nothing was read.
function landedAt(key) {
  try {
    const url = new URL(key, 'http://capture.invalid');
    return (url.pathname.replace(/\/+$/, '') || '/') + url.search;
  } catch { return key; }
}
function sameAsNoPage(stayed, landed, seen, noPage, address) {
  if (noPage === null || noPage === undefined) return null;
  // Sent where a catch-all sends — but saying it handled the token (a lasting "link expired" notice, a link-named
  // error): a positive sign wins over the match. The app's reset page may well send a bad token to its sign-in.
  if (!stayed) return landedAt(landed) === landedAt(noPage.landed) && !tokenHandled(landed, seen, address) ? { kind: 'sent_as_no_page', text: noPage.address } : null;
  const print = (shown) => shown === null || shown === undefined ? '' : [...shown.said, shown.main].join('\n');
  return print(seen) !== '' && print(seen) === print(noPage.seen) ? { kind: 'same_as_no_page', text: noPage.address } : null;
}
// A made-up token's visitor sent on to ANOTHER address: did the app say it handled the token? A catch-all that sends
// every unknown address to the sign-in screen or to the home page says nothing, and an app that never mounted its
// reset page must not pass by it. Only a positive sign counts, any one of:
//   · the landing's query or hash names the LINK — token, link, reset, verify, invite, invitation, activation,
//     magic (?error=invalid_link, ?reason=token_expired, ?invite=expired). A guard's signal never does: a return
//     address (next=…) is not read, and session or sign-in words (login_required, session_expired,
//     SessionRequired, unauthorized) void the part they stand in;
//   · the landing page says the link is invalid, expired or used (INVALID_LINK, as at the address itself);
//   · the landing is a forgot-password or reset-request page — no catch-all sends a visitor there.
const LINK_SIGNAL_WORD = /^(?:token|tokens|link|links|reset|verify|verification|invite|invitation|activation|activate|magic)$/;
const GUARD_WORD = /^(?:session|login|logged|logout|signin|signed|unauthorized|unauthorised|unauthenticated|forbidden|auth|authentication|credentials|required)$/;
const RETURN_ADDRESS_KEY = /^(?:next|redirect|redirect_?to|redirect_?url|return|return_?to|return_?url|from|callback|callback_?url|continue|dest|destination|target)$/i;
const FORGOT_PASSWORD_SEGMENT = /^(?:forgot|forgot-password|forgot_password|forgotpassword|forgotten-password|password-forgot|forgot-your-password|recover|recover-password|password-recovery|account-recovery|reset-password|password-reset|request-password-reset)$/i;
function stateWords(text) {
  return String(text).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9]+/).filter((word) => word !== '');
}
function tokenHandled(landed, seen, address) {
  let here;
  try { here = new URL(landed, 'http://capture.invalid'); } catch { return false; }
  // A value that is an ADDRESS — a path, a URL, anything holding the made-up token — is an echo of where the visitor
  // came from (to=, redirect_uri=, r=, goto=, url=, back=, returnPath=…), never a word about the link, whatever its key.
  const madeUp = String(address || '').match(/[0-9a-f]{32}/g) || [];
  const echoes = (value) => /^\s*(?:\/|https?:)/i.test(value) || madeUp.some((hex) => value.includes(hex));
  const parts = [];
  const read = (search) => {
    try {
      for (const [key, value] of new URLSearchParams(search)) if (!RETURN_ADDRESS_KEY.test(key) && !echoes(value)) parts.push(key + ' ' + value);
    } catch { /* unreadable */ }
  };
  read(here.search);
  if (here.hash.startsWith('#/')) {
    const at = here.hash.indexOf('?');
    if (at >= 0) read(here.hash.slice(at));
  } else if (here.hash.length > 1) {
    let hash = here.hash.slice(1);
    try { hash = decodeURIComponent(hash); } catch { /* read as written */ }
    if (!echoes(hash)) parts.push(hash);
  }
  if (parts.some((part) => {
    const words = stateWords(part);
    return words.some((word) => LINK_SIGNAL_WORD.test(word)) && !words.some((word) => GUARD_WORD.test(word));
  })) return true;
  if (seen !== null && seen !== undefined && (seen.said.some((text) => INVALID_LINK.test(text)) || INVALID_LINK.test(seen.main))) return true;
  const path = here.pathname + (here.hash.startsWith('#/') ? here.hash.split('?')[0] : '');
  return path.split(/[/#]+/).some((segment) => FORGOT_PASSWORD_SEGMENT.test(segment));
}
// </token-landing>
// <token-sign-in>
// The app's sign-in screen standing at the token address: the capture's own sign-in form (signInForm), and a page
// that reads as a sign-in — its button or a heading says sign in or log in. A reset form with one password field
// ("New password", "Set password") is the page's own form, never this.
const SIGN_IN_LABEL = /\b(?:sign|log)[ -]?in\b/i;
async function signInScreenHere(page, said) {
  const form = await signInForm(page);
  if (form === null) return false;
  if (said.some((text) => SIGN_IN_LABEL.test(text))) return true;
  try {
    const submit = await submitControl(form.scope, form.password);
    return submit !== null && SIGN_IN_LABEL.test(submit.label);
  } catch {
    return false;
  }
}
// </token-sign-in>
// The failure, when a made-up token's visitor was sent on with no such sign. The same first words as
// tokenPageMessage: a ROUTE failure of the route's own lane, never a sign-in or session failure.
function tokenUnhandledMessage(route, landed) {
  return 'the app shows no page of its own at ' + route + ': opening ' + route + ' with an invalid token went to ' + landed +
    ' without saying the link is invalid. Mount the page at ' + route + " (public, no sign-in) and have it show the app's " +
    'invalid-or-expired-link message, or redirect with an error notice.';
}
// An ADDRESS that names a sign-in screen, wherever in the path the name stands (/admin/login, /en/login,
// /#/login) and whatever query follows it (/login?next=/orders). The address is only the second witness:
// it decides nothing while a sign-in form is on display, and speaks only for a screen that shows none.
function isAuthEntry(key) {
  const here = splitRoute(key);
  if (!here) return false;
  for (const declared of declaredAuthRoutes) {
    if (typeof declared !== 'string') continue;
    const there = splitRoute(declared);
    if (there !== null && there.path === here.path) return true;
  }
  if (AUTH_ENTRY.test(here.path)) return true;
  try { return namesSignIn(new URL(key, 'http://capture.invalid')); } catch { return false; }
}
// <sign-in> — also the suite's own sign-in step (SIGN_IN_SOURCE); a test pins what it needs from outside.
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
// </sign-in>
// A sign-in or sign-up screen that was ASKED FOR by name is the requested screen, not a gate before it.
const SIGN_UP_SEGMENT = /^(signup|sign-up|sign_up|register|registration|join)$/i;
function namesAccountEntry(url) {
  const segments = screenOf(url).split(/[/#]+/).filter((segment) => segment !== '');
  const last = segments.length > 0 ? segments[segments.length - 1] : '';
  return SIGN_IN_SEGMENT.test(last) || SIGN_UP_SEGMENT.test(last);
}
// What stands between the visitor and the requested screen — or null when nothing does.
//
// The sign-in screen is recognised by what is ON it: a visible sign-in form. Recognising it by how its
// address is spelled, and only at the start of the path, missed /admin/login, /en/login, a hash route
// and every form the app shows at the gated screen's OWN address — where the form was then graded as the
// screen. It also took a gated screen merely NAMED like an auth word (/sessions) for a sign-in page.
//   away — the app sent the visitor to another address (what the arrival rule calls 'elsewhere');
//   form — the sign-in form on display, or null when only the address says this is a sign-in screen.
async function signInScreen(page, route, target) {
  const here = new URL(page.url());
  const away = routeArrival(route, routeKey(here), routes) === 'elsewhere';
  const form = await signInForm(page);
  if (form !== null) return !away && namesAccountEntry(target) ? null : { away, form };
  return away && isAuthEntry(routeKey(here)) && !namesAccountEntry(target) ? { away, form: null } : null;
}
// Back to a signed-out visitor: the cookies and the browser's own stores a sign-in left behind.
async function forgetVisitor(page) {
  await page.context().clearCookies().catch(() => undefined);
  await page.evaluate(() => { globalThis.localStorage.clear(); globalThis.sessionStorage.clear(); }).catch(() => undefined);
}
// ONE sign-in serves every route. Each route runs in a fresh browser context, and the capture used to
// sign in again in every one of them: an app that limits sign-in attempts (five per fifteen minutes is
// the shape two stage apps shipped on 2026-10-01) answered 429 from the sixth gated route on, and a
// correct app failed its last routes for being careful. The session of the first sign-in the app
// honoured — its cookies and what it put in the browser's own stores — is kept here, in the worker's
// memory only (this exam never writes it to disk: it is a live credential), and carried into each later
// context.
//
// Playwright starts a new worker after a failed test, and this memory goes with the old one: a failing
// route costs the routes after it one more sign-in. Never one per route.
let session = null;
// E2 — the suite now signs in ONCE, in its own step before any spec (e2e/sign-in.engine.js), and saves
// that session for the specs that opt in. This exam opts in too, here: with the step in front of it, its
// own sign-in had become a SECOND attempt in the same run, and an app that limits sign-ins refused it.
// Read at most once per worker, and only when a protected route asks for a session. An absent, empty
// or unreadable file is no session, and a session the app no longer honours is found out below — in
// both cases the exam signs in for itself exactly as before. The exam still writes no session to disk.
let savedSessionRead = false;
function savedSession(origin) {
  if (savedSessionRead) return null;
  savedSessionRead = true;
  try {
    const state = JSON.parse(fs.readFileSync('.qa/auth/state.json', 'utf8'));
    const cookies = Array.isArray(state.cookies) ? state.cookies : [];
    const own = (Array.isArray(state.origins) ? state.origins : []).find((entry) => entry && entry.origin === origin);
    const local = own && Array.isArray(own.localStorage) ? own.localStorage.map((item) => [item.name, item.value]) : [];
    return cookies.length + local.length === 0 ? null : { origin, cookies, local, session: [] };
  } catch {
    return null;
  }
}
async function keepSession(page) {
  try {
    const stores = await page.evaluate(() => {
      const entries = (store) => Object.keys(store).map((key) => [key, store.getItem(key)]);
      return { local: entries(globalThis.localStorage), session: entries(globalThis.sessionStorage) };
    });
    session = { origin: new URL(page.url()).origin, cookies: await page.context().cookies(), local: stores.local, session: stores.session };
  } catch {
    session = null;
  }
}
// Gives this context the kept session. The page is on the app's own origin — it is showing the sign-in
// screen — so the browser's stores can be written directly. False when there is nothing to give.
async function restoreSession(page) {
  if (session === null) {
    try { session = savedSession(new URL(page.url()).origin); } catch { session = null; }
  }
  if (session === null || session.cookies.length + session.local.length + session.session.length === 0) return false;
  try {
    if (session.cookies.length > 0) await page.context().addCookies(session.cookies);
    if (new URL(page.url()).origin === session.origin) {
      await page.evaluate((kept) => {
        for (const [key, value] of kept.local) globalThis.localStorage.setItem(key, value);
        for (const [key, value] of kept.session) globalThis.sessionStorage.setItem(key, value);
      }, { local: session.local, session: session.session });
    }
    return true;
  } catch {
    return false;
  }
}
// A screen that asks the visitor to choose a new password: its address says so, or it shows a new
// password and its confirmation. An app that forces the seeded admin to change its password at first
// sign-in sends every gated route here. The capture does NOT complete the step — that would change the
// credential the platform minted, which the app's own specs and the delivered app still use — so the
// route fails as before, and this only lets the failure say what the app asked for.
async function asksForNewPassword(page) {
  try {
    if (/(change|reset|set|update|new)[-_]?password|password[-_]?(change|reset|update|expired)/i.test(screenOf(new URL(page.url())))) return true;
    if ((await page.locator('input[type="password"]:visible').count()) >= 2) return true;
    return (await page.locator('input[type="password"][autocomplete~="new-password" i]:visible').count()) > 0;
  } catch {
    return false;
  }
}
const NEW_PASSWORD_ASKED = 'the app accepted the sign-in and then asked for a new password before it would show ' +
  'this protected route: the seeded admin must change its password at first sign-in, and the capture never changes a credential';
const NO_CREDENTIAL = 'this protected route needs a session, and no seeded admin credential was supplied to the capture';
const NO_FORM = 'this protected route needs a session, and the capture could not complete the app sign-in form at any known entry';
// N6 — THE THIRD GATE: the screen asks for a sign-in WHERE IT STANDS.
//
// A client-rendered screen often neither sends a visitor to the sign-in screen nor shows a sign-in form.
// It stays at its address, asks its API for its data, is refused, and says so ("Your session has
// expired. Please sign in again."). MEASURED (Event Management, stage build of 2026-09-30): /events and
// /reports were captured showing that sentence and graded as the screens, and since the signed-out list
// shows no event, five /events/:eventId/... patterns had no record to open — on a correct app.
//
// The evidence is the app's own refusal, not the wording on the page: while the screen loaded, the app
// answered one of ITS OWN requests 401 or 403. A request that only asks who the visitor is (/api/auth/me,
// /api/session) is not that evidence — a public screen makes it too, and is refused too.
const SESSION_CHECK = /^(auth|session|sessions|me|whoami|account|profile|user|viewer|identity|current-user|csrf|refresh|token|oauth|login|signin|sign-in)$/i;
function watchRefusals(page, origin) {
  const refused = new Set();
  const onResponse = (response) => {
    try {
      const status = response.status();
      if (status !== 401 && status !== 403) return;
      const url = new URL(response.url());
      if (url.origin !== origin) return;
      if (url.pathname.split('/').some((segment) => SESSION_CHECK.test(segment))) return;
      refused.add(response.request().method() + ' ' + url.pathname);
    } catch {
      // a response that cannot be read says nothing
    }
  };
  page.on('response', onResponse);
  return { refused, stop: () => page.off('response', onResponse) };
}
// One refused sign-in is not repeated for every such screen: an app that counts attempts would lock.
let ownGateSignInFailed = false;
// The screen was refused its data as a visitor. It is a gated screen only if the SAME requests are
// answered once a session is brought, with the screen still standing at its own address — that is
// proved here, by opening it again signed in. Anything less (no session to bring, the app refuses the
// credential, the requests are refused to the signed-in admin as well, the app passes a signed-in
// visitor on to another address) and the screen is captured as a visitor sees it, exactly as before,
// with no failure of its own: this path never sets opened.problem.
async function openBehindItsOwnGate(page, baseURL, route, target, opened, visit, refusedAsVisitor) {
  const answeredNow = async () => {
    const refusals = watchRefusals(page, target.origin);
    try {
      await visit();
    } finally {
      refusals.stop();
    }
    const here = new URL(page.url());
    if (routeArrival(route, routeKey(here), routes) === 'elsewhere' || screenOf(here) !== screenOf(target)) return false;
    if ((await signInScreen(page, route, target)) !== null) return false;
    return Array.from(refusedAsVisitor).every((request) => !refusals.refused.has(request));
  };
  try {
    // The session already held (this worker's, or the one the suite's sign-in step saved) first.
    if (await restoreSession(page)) {
      if (await answeredNow()) { opened.signedIn = true; return; }
      // Not honoured here any more: as if none were held.
      session = null;
      await forgetVisitor(page);
    }
    if (haveCredential && !ownGateSignInFailed) {
      // From a blank page, so the sign-in is looked for on the app's sign-in pages and the seeded email is
      // never typed into a form of the screen that happens to be open.
      await page.goto('about:blank');
      const attempt = await signIn(page, baseURL, { away: true, form: null });
      if (attempt.outcome === 'accepted') {
        const open = await answeredNow();
        // The app accepted the sign-in: its session serves the routes after this one either way.
        await keepSession(page);
        if (open) { opened.signedIn = true; return; }
      } else {
        ownGateSignInFailed = true;
      }
    }
  } catch {
    // whatever went wrong while proving it, the screen is captured as a visitor sees it
  }
  await forgetVisitor(page);
  opened.signedIn = false;
  await visit();
}
// Opens a required address as a signed-out visitor FIRST, exactly as before — so a public screen, an app
// with no login and the sign-in page itself cost nothing and look the way a visitor sees them, even
// once a session is held. Only when the app answers with its sign-in screen — or refuses the screen its
// own data (N6, above) — does the capture bring a session: the one it already holds, or — when it holds
// none, or the app no longer honours it — a sign-in. Then it opens the address again.
//
// opened.problem stays null, or becomes the sentence saying why the requested screen was not reached.
async function openRoute(page, baseURL, route, target, opened) {
  const visit = async () => {
    // A hash-only change stays in the same document and answers nothing: the document's own answer stands.
    opened.response = (await page.goto(target.href, { waitUntil: 'load' })) || opened.response;
    await settle(page);
  };
  const refusals = watchRefusals(page, target.origin);
  try {
    await visit();
  } finally {
    refusals.stop();
  }
  if (!authGated) return;
  let gate = await signInScreen(page, route, target);
  if (gate === null) {
    if (refusals.refused.size > 0 && !namesAccountEntry(target)) await openBehindItsOwnGate(page, baseURL, route, target, opened, visit, refusals.refused);
    return;
  }
  if (!haveCredential) {
    // A form at the screen's own address may be the app's own sign-in page. Without a credential there
    // is no telling the two apart, so that capture is left to the oracle, as it always was.
    if (gate.away) opened.problem = NO_CREDENTIAL;
    return;
  }
  if (await restoreSession(page)) {
    opened.signedIn = true;
    await visit();
    const still = await signInScreen(page, route, target);
    // Open — or showing a form of the screen's own, different from the sign-in form that stood here.
    if (still === null || (!still.away && (gate.form === null || still.form.mark !== gate.form.mark))) return;
    // The app does not honour the kept session here (it ended, or this address is the app's own sign-in
    // page): sign in afresh, as if none were held.
    gate = still;
  }
  const attempt = await signIn(page, baseURL, gate);
  // The route is opened again whatever the app answered. An accepted sign-in must now show the screen; a
  // refused one must not leave the form the capture filled — with the credential in it — to be saved
  // as this route's evidence.
  await visit();
  if (attempt.outcome === 'no_form') {
    if (gate.away) opened.problem = NO_FORM;
    return;
  }
  if (attempt.outcome === 'rejected') {
    opened.problem = rejectedMessage(attempt);
    return;
  }
  opened.signedIn = true;
  const again = await signInScreen(page, route, target);
  const here = new URL(page.url());
  // The screen is open when the app shows it with no sign-in form on it — and also when the form on it is
  // the screen's OWN, a different form from the one the capture filled (a "create user" form holds a
  // password field too).
  const open = routeArrival(route, routeKey(here), routes) !== 'elsewhere' && (again === null || again.form.mark !== attempt.mark);
  if (!gate.away && !attempt.stayed) {
    // The form stood at the requested address and signing in led AWAY from it. The address is a gated
    // screen only if, signed in, it shows a screen of its own right there. If it shows the form again, or
    // only passes a signed-in visitor on to another address, it IS the app's sign-in page under a name
    // that says nothing (the root, most often), and it is captured as a signed-out visitor sees it — as
    // before. The sign-in itself was accepted, so its session is kept for the routes that need one.
    await keepSession(page);
    if (open && screenOf(here) === screenOf(target)) return;
    await forgetVisitor(page);
    opened.signedIn = false;
    await visit();
    return;
  }
  if (open) {
    await keepSession(page);
    return;
  }
  // Back at the sign-in: the form the capture filled, or an address that names a sign-in screen. A
  // DIFFERENT form on a screen that asks for a new password is not the sign-in coming back — the session
  // held, and the failure below says what the app asked for instead.
  const back = again !== null && (again.form === null || again.form.mark === attempt.mark);
  if (back || (again !== null && !(await asksForNewPassword(page)))) opened.problem = SESSION_NOT_KEPT;
}
// A route pattern (/properties/:id) is nobody's address: visiting it literally shows the app's correct
// "not found". The capture opens a real record instead, found as a link on one of the other required
// screens, and reuses the value for a sibling pattern (/properties/:id/enquire). Values are kept per
// pattern prefix, so /orders/:id and /customers/:id never share one.
const patternValues = new Map();
function patternKey(segments, index) { return '/' + segments.slice(0, index + 1).join('/'); }
function fillPattern(route) {
  const split = splitRoute(route);
  if (!split) return null;
  const segments = pathSegments(split.path);
  const out = [];
  for (let index = 0; index < segments.length; index++) {
    if (!PARAM_SEGMENT.test(segments[index])) { out.push(encodeURIComponent(segments[index])); continue; }
    const value = patternValues.get(patternKey(segments, index));
    if (value === undefined) return null;
    out.push(encodeURIComponent(value));
  }
  return '/' + out.join('/') + split.state;
}
// Q2.1 — WHAT THE SEARCH READ, as counts, under the failure's sentence.
//
// One sentence stands for every way a record can be missing from the screens — the list shows none, or
// shows them as something that is not a link — and whoever reads it cannot tell which. The lines added
// here say only what was READ: how many links, how many of them under the list's address, how many
// table rows and list items were on the list's page and how many of those hold a link. They name no
// cause. A count is true of a table, of a list drawn as cards, of an empty state and of a pager alike;
// a diagnosis read off those counts is not (a card list has no table row, an empty table has one).
//
// Nothing read for this decides whether a record is found — the links are read and matched exactly as
// before — and each reading is best-effort: one that fails is left out.
//
// The list is the address up to the pattern's first parameter (/orders for /orders/:id/edit), which is
// the address the engine files this failure on.
function listPathOf(segments) {
  const first = segments.findIndex((segment) => PARAM_SEGMENT.test(segment));
  return first <= 0 ? null : '/' + segments.slice(0, first).join('/');
}
// The table rows that hold a data cell and the list items on the page, outside its header, navigation
// and footer, and how many of them hold a link (or stand inside one). Counted as they are in the
// document: no row is left out for what it says. Null when the page could not be read.
async function readListCounts(page) {
  try {
    return await page.evaluate(() => {
      const chrome = 'nav, header, footer, [role="navigation"], [role="banner"], [role="contentinfo"]';
      const all = (selector) => Array.from(globalThis.document.querySelectorAll(selector)).filter((el) => el.closest(chrome) === null);
      const tableRows = all('tr, [role="row"]').filter((row) => row.querySelector('td, [role="cell"], [role="gridcell"]') !== null);
      const listItems = all('li, [role="listitem"]');
      const holdsLink = (el) => el.closest('a[href]') !== null || el.querySelector('a[href]') !== null;
      return { tableRows: tableRows.length, listItems: listItems.length,
        withLink: tableRows.filter(holdsLink).length + listItems.filter(holdsLink).length };
    });
  } catch {
    return null;
  }
}
// The lines under the no-record sentence. The first line of that failure is what the engine reads it by,
// and is the only line it stores; these follow it in the suite's own output.
function noRecordRead(seen) {
  const lines = [];
  const list = seen.listPath;
  if (list !== null && seen.list !== null) {
    if (!seen.list.opened) lines.push('The list at ' + list + ' did not open for the check.');
    else {
      lines.push('Read on the list at ' + list +
        (seen.list.counts === null ? ': ' : ', outside its header, navigation and footer: ' + seen.list.counts.tableRows +
          ' table row(s), ' + seen.list.counts.listItems + ' list item(s), ' + seen.list.counts.withLink + ' of them holding a link; ') +
        seen.list.links + ' link(s) on the whole screen, ' + seen.list.under + ' under ' + list + '/.');
    }
  } else if (list !== null && !seen.listRequired) {
    lines.push(list + ' is not one of the required screens, so it was not read.');
  }
  lines.push('Links read on ' + seen.screens + ' screen(s): ' + seen.links + (list !== null ? ', ' + seen.underList + ' under ' + list + '/.' : '.'));
  return lines.map((line) => '\n' + line).join('');
}
async function resolvePattern(page, baseURL, route, seen) {
  const known = fillPattern(route);
  if (known !== null) return known;
  const split = splitRoute(route);
  if (!split) return null;
  const segments = pathSegments(split.path);
  let lastParameter = -1;
  segments.forEach((segment, index) => { if (PARAM_SEGMENT.test(segment)) lastParameter = index; });
  const sources = routes.filter((candidate) => !isRoutePattern(candidate));
  if (!sources.includes('/')) sources.push('/');
  const staticPaths = new Set(sources.map((candidate) => { const s = splitRoute(candidate); return s ? s.path : candidate; }));
  const origin = new URL(baseURL).origin;
  const listPath = listPathOf(segments);
  const isList = (source) => { const s = splitRoute(source); return listPath !== null && s !== null && '/' + pathSegments(s.path).join('/') === listPath; };
  seen.listPath = listPath;
  seen.listRequired = sources.some(isList);
  for (const source of sources) {
    let hrefs = [];
    const opened = { response: null, problem: null, signedIn: false };
    try {
      // Signed in when the source screen is gated. Best-effort, as before: a source that does not
      // settle is still read for whatever links it shows.
      await openRoute(page, baseURL, source, new URL(source, baseURL), opened).catch(() => undefined);
      hrefs = await page.evaluate(() => Array.from(globalThis.document.querySelectorAll('a[href]')).map((a) => a.href));
    } catch { continue; }
    seen.screens += 1;
    seen.links += hrefs.length;
    let underHere = 0;
    for (const href of hrefs) {
      let url;
      try { url = new URL(href); } catch { continue; }
      if (url.origin !== origin) continue;
      const path = url.pathname.replace(/\/+$/, '') || '/';
      const linked = pathSegments(path);
      if (listPath !== null && ('/' + linked.join('/')).startsWith(listPath + '/')) { seen.underList += 1; underHere += 1; }
      if (staticPaths.has(path)) continue;
      // The whole pattern, or its prefix up to the last parameter: a link to the record resolves
      // /properties/:id/enquire as well.
      for (let length = segments.length; length > lastParameter; length--) {
        if (linked.length !== length) continue;
        if (!matchesRoutePattern('/' + segments.slice(0, length).join('/'), '/' + linked.join('/'))) continue;
        for (let index = 0; index < length; index++) {
          if (PARAM_SEGMENT.test(segments[index])) patternValues.set(patternKey(segments, index), linked[index]);
        }
        const filled = fillPattern(route);
        if (filled !== null) return filled;
      }
    }
    // No link on the list itself led to a record: its page is counted while it is still on display.
    if (seen.list === null && isList(source)) {
      try {
        const shown = opened.problem === null && routeArrival(source, routeKey(new URL(page.url())), routes) !== 'elsewhere';
        seen.list = shown
          ? { opened: true, links: hrefs.length, under: underHere, counts: await readListCounts(page) }
          : { opened: false, links: 0, under: 0, counts: null };
      } catch {
        // nothing is said about a list that could not be read
      }
    }
  }
  return null;
}
// <settle>
async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => undefined);
  await expect.poll(() => page.locator('[aria-busy="true"]:visible').count(), { timeout: 10000 }).toBe(0);
}
// </settle>
for (const route of routes) {
  test('capture required route ' + route, async ({ page, baseURL }) => {
    test.setTimeout(90000);
    let target = new URL(route, baseURL);
    let targetKey = routeKey(target);
    const directory = process.env.ENGINE_QA_CAPTURE_DIRECTORY;
    if (!directory) throw new Error('Engine capture directory was not supplied');
    const slug = 'engine-route-' + createHash('sha256').update(route).digest('hex');
    const file = (extension) => path.join(directory, slug + '.' + extension);
    fs.mkdirSync(directory, { recursive: true });
    for (const extension of ['html', 'png', 'styles.json', 'route.json']) {
      fs.rmSync(file(extension), { force: true });
    }
    // A page reached only from a link the app sends (isTokenRoute) that no required screen links to is opened with a
    // made-up token (tokenAddress). Null for every other route — and for a token route a link WAS found for, which is
    // opened exactly as any record is.
    let tokenTarget = null;
    if (isRoutePattern(route)) {
      const seen = { listPath: null, listRequired: false, list: null, screens: 0, links: 0, underList: 0 };
      const address = await resolvePattern(page, baseURL, route, seen);
      if (address === null && isTokenRoute(route)) tokenTarget = tokenAddress(route);
      if (address === null && tokenTarget === null) {
        throw new Error('no page matching ' + route + ' could be opened: none of the other required screens ' +
          'links to one (the app shows no record to open, or does not link to it)' + noRecordRead(seen));
      }
      target = new URL(address !== null ? address : tokenTarget, baseURL);
      targetKey = routeKey(target);
    }
    const opened = { response: null, problem: null, signedIn: false };
    // What a made-up token's address showed (readTokenPage), and whether it is no page of the app's own
    // (tokenPageProblem); null otherwise.
    let tokenSeen = null;
    let tokenProblem = null;
    // What the app answers at an address it has no page for, as deep as this route (readNoPage).
    let noPage = null;
    try {
      if (tokenTarget !== null) {
        noPage = await readNoPage(page, baseURL, pathSegments(splitRoute(route).path).length);
        await openTokenAddress(page, target, opened);
      } else await openRoute(page, baseURL, route, target, opened);
    } finally {
      // Evidence is best-effort per artifact: a read that loses a race with an in-flight redirect must
      // not replace the test's real failure with its own. One retry after the page settles, then skip.
      const attempt = async (read) => {
        try { return await read(); } catch {
          await page.waitForLoadState('load', { timeout: 5000 }).catch(() => undefined);
        }
        try { return await read(); } catch { return null; }
      };
      // A made-up token's page is no capture of the route, whatever it shows: nothing of it is written. No identity
      // record — the oracle grades the suite's own capture of the route, or leaves it unresolved, exactly as when no
      // page of a pattern could be opened — and no DOM or screenshot for the screen reviews to read either.
      const keep = tokenTarget === null;
      if (!keep) {
        tokenSeen = await attempt(() => readTokenPage(page));
        // A sign-in screen counts against the page only where the visitor stayed: one sent on to it is judged below.
        if (tokenSeen !== null && routeArrival(route, routeKey(new URL(page.url())), routes) !== 'elsewhere') {
          tokenSeen.signIn = await signInScreenHere(page, tokenSeen.said);
        }
        if (tokenSeen !== null) tokenProblem = tokenPageProblem(tokenSeen, opened.response ? opened.response.status() : null);
      }
      const html = keep ? await attempt(() => page.content()) : null;
      if (html !== null) fs.writeFileSync(file('html'), html);
      const shot = keep ? await attempt(() => page.screenshot({ fullPage: true, animations: 'disabled' })) : null;
      if (shot !== null) fs.writeFileSync(file('png'), shot);
      const styles = keep ? await attempt(() => page.evaluate(() => ({
        viewport: { width: globalThis.innerWidth, height: globalThis.innerHeight },
        elements: Array.from(globalThis.document.querySelectorAll('*')).filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = globalThis.getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        }).slice(0, 200).map((element) => {
          const rect = element.getBoundingClientRect();
          const style = globalThis.getComputedStyle(element);
          return { tag: element.tagName.toLowerCase(), x: rect.x, y: rect.y, w: rect.width, h: rect.height,
            color: style.color, backgroundColor: style.backgroundColor, fontFamily: style.fontFamily,
            fontSize: style.fontSize, fontWeight: style.fontWeight, borderRadius: style.borderRadius,
            borderColor: style.borderTopColor, borderWidth: style.borderTopWidth,
            outlineColor: style.outlineColor, boxShadow: style.boxShadow,
            fill: style.fill, stroke: style.stroke };
        }),
      }))) : null;
      if (styles !== null) fs.writeFileSync(file('styles.json'), JSON.stringify(styles));
      // The identity record lands only when the artifacts it describes exist, so an incomplete capture
      // stays incomplete to the collector rather than claiming evidence it does not have. And never for
      // a sign-in screen standing at an address the collector would accept as this route: that form
      // would be graded as the screen, and the screen's owner blamed for it.
      const observed = new URL(page.url());
      const arrival = routeArrival(route, routeKey(observed), routes);
      if (html !== null && shot !== null && styles !== null && (opened.problem === null || arrival === 'elsewhere')) {
        fs.writeFileSync(file('route.json'), JSON.stringify({ version: 1, requestedRoute: route,
          observedRoute: routeKey(observed), arrival,
          sameOrigin: observed.origin === target.origin, status: opened.response?.status() ?? null }));
      }
    }
    // Keep navigation/readiness errors intact; these assertions run only after navigation succeeded.
    expect(opened.response, 'required route did not respond').toBeTruthy();
    const observed = new URL(page.url());
    expect(observed.origin, 'capture redirected outside the application').toBe(target.origin);
    const observedKey = routeKey(observed);
    // The assertion is UNCHANGED. Only the message changes, and only when the app answered with its own
    // sign-in screen — so an operator is told which side owns the repair, and which repair it is.
    let message = opened.problem !== null ? opened.problem : 'capture redirected to a different route or state';
    // The requested screen is on display when the address is unchanged, when the app only added a
    // default query/hash of its own, when a section opened its own child page, or when the entry route
    // opened another required screen. Anything else is a misroute and fails exactly as it always has.
    // A made-up token's visitor sent on to another address is judged below instead: never a misroute of the capture's,
    // and never a session or sign-in failure.
    if (routeArrival(route, observedKey, routes) === 'elsewhere' && tokenTarget === null) {
      if (opened.problem === null && opened.signedIn && (await asksForNewPassword(page))) message = NEW_PASSWORD_ASKED;
      expect(observedKey, message).toBe(targetKey);
    }
    // A sign-in screen standing at the route's own address is not the requested screen either.
    if (opened.problem !== null) throw new Error(opened.problem);
    // Nor, for a made-up token, what the app answers at an address it has no page for (sameAsNoPage) — its home page,
    // its sign-in form, an empty shell, its catch-all's redirect: the route is not mounted.
    const stayed = routeArrival(route, observedKey, routes) !== 'elsewhere';
    const asNoPage = tokenTarget !== null ? sameAsNoPage(stayed, observedKey, tokenSeen, noPage, targetKey) : null;
    if (asNoPage !== null) throw new Error(tokenPageMessage(route, targetKey, asNoPage, observedKey));
    // Nor a page that stayed and could not be read at all: nothing showed it is the app's own.
    const unread = tokenTarget !== null ? tokenPageUnread(stayed, tokenSeen) : null;
    if (unread !== null) throw new Error(tokenPageMessage(route, targetKey, unread, observedKey));
    // Nor the app's not-found screen, an error screen, a server error, a refusal, its sign-in screen in the page's
    // place or a blank page — at its address or wherever the app sent the visitor on to.
    if (tokenProblem !== null) throw new Error(tokenPageMessage(route, targetKey, tokenProblem, observedKey));
    // Sent on to another address, the app must say it handled the token (tokenHandled); a bare redirect to the sign-in
    // screen, the home page or another screen is what a catch-all does for a page that was never mounted.
    if (tokenTarget !== null && !stayed && !tokenHandled(observedKey, tokenSeen, targetKey)) {
      throw new Error(tokenUnhandledMessage(route, observedKey));
    }
  });
}
