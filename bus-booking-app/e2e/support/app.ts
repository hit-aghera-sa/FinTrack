import { expect, type APIRequestContext, type APIResponse, type Locator, type Page } from '@playwright/test';
import { settle } from './capture';

/**
 * WHAT THE ACCEPTANCE SPECS KNOW ABOUT THE APP — fixture values, the approved sentences (copied, never
 * imported from src/), and thin drivers over the app's own HTTP API and its own forms.
 *
 * Nothing here imports application code: Playwright loads spec files with its own transform, so the
 * specs reach the app only through the browser and its `/api` surface.
 */

export const PASSWORD = 'Travel@123';
export const RESET_PASSWORD = 'Travel@456';
export const SECURITY_ANSWER = 'Mango';
export const HOUR_MS = 3_600_000;

/** The exact strings the app renders, copied from the approved message catalogue. */
export const MESSAGES = {
  duplicateMobile: 'An account with this mobile number already exists. Please log in.',
  loginIncorrect: 'Mobile number or password is incorrect.',
  accountLocked: 'Too many attempts. Please try again after 15 minutes.',
  wrongSecurityAnswer: 'That answer is not correct.',
  resetBlocked: 'Too many attempts. Password reset for this mobile number is blocked for 1 hour.',
  sameCity: 'From and To cannot be the same city.',
  noBuses: 'No buses found for this route on this date.',
  cancelConfirmTitle: 'Cancel this booking?',
  cancelConfirmYes: 'Yes, cancel',
} as const;

/** Whole rupees, Indian grouping: 1200 -> `₹1,200`. */
export function formatINR(amount: number): string {
  const digits = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(amount));
  return `₹${digits}`;
}

export function payOnBoardingSentence(totalFare: number): string {
  return `Pay ${formatINR(totalFare)} in cash or UPI to the bus staff when boarding.`;
}

export function cancelledSentence(bookingId: string): string {
  return `Your booking ${bookingId} has been cancelled.`;
}

/** The India-time calendar day of an instant, as `YYYY-MM-DD`. */
export function istDayKey(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

/** Today and the next `count - 1` India-time days. */
export function dayKeys(count: number): string[] {
  const keys: string[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    keys.push(istDayKey(new Date(Date.now() + offset * 86_400_000)));
  }
  return keys;
}

/** A mobile number no other account is using. */
export function randomMobile(): string {
  let digits = '9';
  for (let index = 0; index < 9; index += 1) digits += String(Math.floor(Math.random() * 10));
  return digits;
}

/** A readable, letter-prefixed run marker for fixture names — never a bare number. */
export function runTag(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`;
}

export function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── accounts ─────────────────────────────────────────────────────────────────────────────────────

export interface TestAccount {
  fullName: string;
  mobile: string;
  password: string;
  securityQuestionId: string;
  securityAnswer: string;
}

export function newAccountDraft(tag: string): TestAccount {
  return {
    fullName: `Asha QA ${runTag(tag)}`,
    mobile: randomMobile(),
    password: PASSWORD,
    securityQuestionId: '',
    securityAnswer: SECURITY_ANSWER,
  };
}

async function bodyOf(res: APIResponse): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function errorField(body: unknown, field: 'message' | 'code'): string {
  if (typeof body === 'object' && body !== null) {
    const error = (body as { error?: unknown }).error;
    if (typeof error === 'object' && error !== null) {
      const value = (error as Record<string, unknown>)[field];
      if (typeof value === 'string') return value;
    }
  }
  return '';
}

/** The `error.message` of the shared API error body, or '' when the body carries none. */
export async function errorMessageOf(res: APIResponse): Promise<string> {
  return errorField(await bodyOf(res), 'message');
}

/** The `error.code` of the shared API error body, or '' when the body carries none. */
export async function errorCodeOf(res: APIResponse): Promise<string> {
  return errorField(await bodyOf(res), 'code');
}

export async function firstSecurityQuestionId(api: APIRequestContext): Promise<string> {
  const res = await api.get('/api/auth/security-questions');
  expect(res.status(), 'GET /api/auth/security-questions').toBe(200);
  const questions = (await res.json()) as Array<{ id: string; label: string }>;
  expect(questions.length, 'the app offers at least one security question').toBeGreaterThan(0);
  return questions[0].id;
}

/** Creates a brand-new account through the app's OWN public sign-up endpoint. */
export async function signUpViaApi(api: APIRequestContext, tag: string): Promise<TestAccount> {
  const account = newAccountDraft(tag);
  account.securityQuestionId = await firstSecurityQuestionId(api);
  const res = await api.post('/api/auth/signup', {
    data: {
      fullName: account.fullName,
      mobile: account.mobile,
      password: account.password,
      confirmPassword: account.password,
      securityQuestionId: account.securityQuestionId,
      securityAnswer: account.securityAnswer,
    },
  });
  if (res.status() !== 200 && res.status() !== 201) {
    throw new Error(`sign-up refused: ${String(res.status())} ${await res.text()}`);
  }
  return account;
}

export function loginViaApi(api: APIRequestContext, mobile: string, password: string): Promise<APIResponse> {
  return api.post('/api/auth/login', { data: { mobile, password } });
}

/**
 * A signed-in browser: a fresh account created through the app's own endpoints with the page's own
 * request context, so the session cookie lands in the browser the specs drive.
 */
export async function signUpInBrowser(page: Page, tag: string): Promise<TestAccount> {
  const account = await signUpViaApi(page.request, tag);
  const res = await loginViaApi(page.request, account.mobile, account.password);
  if (res.status() !== 200) {
    throw new Error(`sign-in refused: ${String(res.status())} ${await res.text()}`);
  }
  return account;
}

// ── catalogue and bookings ───────────────────────────────────────────────────────────────────────

export interface CityDto {
  id: string;
  name: string;
}

export interface TripDto {
  id: string;
  busName: string;
  busType: string;
  fromCity: CityDto;
  toCity: CityDto;
  departureAt: string;
  arrivalAt: string;
  farePerSeat: number;
  seatsLeft: number;
  totalSeats: number;
}

export interface SeatDto {
  number: string;
  row: number;
  column: number;
  isBooked: boolean;
}

export interface BoardingPointDto {
  id: string;
  name: string;
  pickupAt: string;
}

export interface TripDetailDto extends TripDto {
  seats: SeatDto[];
  boardingPoints: BoardingPointDto[];
}

export interface BookingDto {
  id: string;
  tripId: string;
  busName: string;
  boardingPointName: string;
  seatNumbers: string[];
  farePerSeat: number;
  totalFare: number;
  status: string;
  canCancel: boolean;
  departureAt: string;
}

export interface FoundTrip {
  from: string;
  to: string;
  date: string;
  trip: TripDto;
}

export interface FindTripOptions {
  minSeats: number;
  minLeadMs?: number;
  maxLeadMs?: number;
  days?: number;
  maxRequests?: number;
}

export async function listCities(api: APIRequestContext): Promise<CityDto[]> {
  const res = await api.get('/api/cities');
  expect(res.status(), 'GET /api/cities').toBe(200);
  return (await res.json()) as CityDto[];
}

function tripsPath(from: string, to: string, date: string): string {
  return `/api/trips?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`;
}

/** The search, asserting the app answered it. */
export async function searchTripsStrict(
  api: APIRequestContext,
  from: string,
  to: string,
  date: string,
): Promise<TripDto[]> {
  const res = await api.get(tripsPath(from, to, date));
  if (res.status() !== 200) {
    throw new Error(`GET ${tripsPath(from, to, date)}: ${String(res.status())} ${await res.text()}`);
  }
  return (await res.json()) as TripDto[];
}

/** The same search while hunting for seeded data: a route the seed does not carry is simply empty. */
async function searchTripsQuiet(
  api: APIRequestContext,
  from: string,
  to: string,
  date: string,
): Promise<TripDto[]> {
  const res = await api.get(tripsPath(from, to, date));
  if (res.status() !== 200) return [];
  return (await res.json()) as TripDto[];
}

/** Walks the seeded catalogue for a bus that matches what the test needs. */
export async function findTrip(api: APIRequestContext, options: FindTripOptions): Promise<FoundTrip | null> {
  const cities = (await listCities(api)).slice(0, 8);
  const dates = dayKeys(options.days ?? 4);
  const budget = options.maxRequests ?? 96;
  let spent = 0;
  const now = Date.now();

  for (const date of dates) {
    for (const from of cities) {
      for (const to of cities) {
        if (from.id === to.id) continue;
        if (spent >= budget) return null;
        spent += 1;
        const trips = await searchTripsQuiet(api, from.id, to.id, date);
        for (const trip of trips) {
          if (trip.seatsLeft < options.minSeats) continue;
          const lead = Date.parse(trip.departureAt) - now;
          if (options.minLeadMs !== undefined && lead < options.minLeadMs) continue;
          if (options.maxLeadMs !== undefined && lead > options.maxLeadMs) continue;
          return { from: from.id, to: to.id, date, trip };
        }
      }
    }
  }
  return null;
}

export async function requireTrip(api: APIRequestContext, options: FindTripOptions): Promise<FoundTrip> {
  const found = await findTrip(api, options);
  if (found === null) {
    throw new Error(
      `the seeded catalogue has no bus with ${String(options.minSeats)} free seats in the search window`,
    );
  }
  return found;
}

export async function tripDetail(api: APIRequestContext, tripId: string): Promise<TripDetailDto> {
  const res = await api.get(`/api/trips/${encodeURIComponent(tripId)}`);
  if (res.status() !== 200) {
    throw new Error(`GET /api/trips/${tripId}: ${String(res.status())} ${await res.text()}`);
  }
  return (await res.json()) as TripDetailDto;
}

/** `count` seats nobody holds, taken from a random position so parallel specs do not collide. */
export function freeSeats(detail: TripDetailDto, count: number): string[] {
  const free = detail.seats.filter((seat) => !seat.isBooked).map((seat) => seat.number);
  if (free.length < count) {
    throw new Error(`trip ${detail.id} has ${String(free.length)} free seats, the test needs ${String(count)}`);
  }
  const room = free.length - count;
  const start = room > 0 ? Math.floor(Math.random() * (room + 1)) : 0;
  return free.slice(start, start + count);
}

const PASSENGER_NAMES = ['Asha QA', 'Priya QA', 'Meera QA', 'Nisha QA', 'Kavya QA', 'Diya QA'] as const;

export interface PassengerPayload {
  seatNumber: string;
  name: string;
  age: number;
  gender: string;
}

export function passengersFor(seats: readonly string[]): PassengerPayload[] {
  return seats.map((seatNumber, index) => ({
    seatNumber,
    name: PASSENGER_NAMES[index % PASSENGER_NAMES.length],
    age: 29,
    gender: 'FEMALE',
  }));
}

export function postBooking(
  api: APIRequestContext,
  detail: TripDetailDto,
  seats: readonly string[],
): Promise<APIResponse> {
  const boarding = detail.boardingPoints[0];
  if (boarding === undefined) throw new Error(`trip ${detail.id} has no boarding point`);
  return api.post('/api/bookings', {
    data: { tripId: detail.id, boardingPointId: boarding.id, passengers: passengersFor(seats) },
  });
}

export async function bookSeats(
  api: APIRequestContext,
  detail: TripDetailDto,
  seats: readonly string[],
): Promise<BookingDto> {
  const res = await postBooking(api, detail, seats);
  if (res.status() !== 200 && res.status() !== 201) {
    throw new Error(`booking refused: ${String(res.status())} ${await res.text()}`);
  }
  return (await res.json()) as BookingDto;
}

export interface BookingSplit {
  upcoming: BookingDto[];
  past: BookingDto[];
}

export async function listBookings(api: APIRequestContext): Promise<BookingSplit> {
  const res = await api.get('/api/bookings');
  if (res.status() !== 200) {
    throw new Error(`GET /api/bookings: ${String(res.status())} ${await res.text()}`);
  }
  return (await res.json()) as BookingSplit;
}

export function allBookings(split: BookingSplit): BookingDto[] {
  return [...split.upcoming, ...split.past];
}

export async function getBooking(api: APIRequestContext, bookingId: string): Promise<BookingDto> {
  const res = await api.get(`/api/bookings/${encodeURIComponent(bookingId)}`);
  if (res.status() !== 200) {
    throw new Error(`GET /api/bookings/${bookingId}: ${String(res.status())} ${await res.text()}`);
  }
  return (await res.json()) as BookingDto;
}

export function cancelBooking(api: APIRequestContext, bookingId: string): Promise<APIResponse> {
  return api.post(`/api/bookings/${encodeURIComponent(bookingId)}/cancel`, { data: {} });
}

// ── driving the app's own screens ────────────────────────────────────────────────────────────────

/** The first VISIBLE control one of `selectors` (or the label) finds. */
export async function visibleControl(
  page: Page,
  selectors: readonly string[],
  label?: RegExp,
): Promise<Locator> {
  for (const selector of selectors) {
    const found = page.locator(selector).filter({ visible: true });
    if ((await found.count()) > 0) return found.first();
  }
  if (label !== undefined) {
    const byLabel = page.getByLabel(label).filter({ visible: true });
    if ((await byLabel.count()) > 0) return byLabel.first();
  }
  throw new Error(`no visible control for ${selectors.join(', ')}`);
}

export async function fillControl(
  page: Page,
  selectors: readonly string[],
  label: RegExp,
  value: string,
): Promise<void> {
  const control = await visibleControl(page, selectors, label);
  await control.fill(value);
}

/** Picks the first real option of a select and returns its value. */
export async function chooseFirstOption(select: Locator): Promise<string> {
  const values = await select
    .locator('option')
    .evaluateAll((nodes) => nodes.map((node) => (node as HTMLOptionElement).value));
  const chosen = values.find((value) => value !== '');
  if (chosen === undefined) throw new Error('the select offers no selectable option');
  await select.selectOption(chosen);
  return chosen;
}

/** Presses the app's own control with that name, whether it is a button or a link. */
export async function clickAction(page: Page, name: RegExp): Promise<void> {
  const button = page.getByRole('button', { name });
  if ((await button.count()) > 0) {
    await button.first().click();
    return;
  }
  const link = page.getByRole('link', { name });
  if ((await link.count()) > 0) {
    await link.first().click();
    return;
  }
  throw new Error(`no button or link named ${String(name)}`);
}

/** A visible occurrence of that text on the screen — the whole label first, a phrase within it next. */
export async function expectTextOnScreen(page: Page, text: string): Promise<void> {
  const whole = page
    .getByText(new RegExp(`^\\s*${escapeRegExp(text)}\\s*$`, 'i'))
    .filter({ visible: true });
  if ((await whole.count()) > 0) {
    await expect(whole.first()).toBeVisible();
    return;
  }
  const within = page.getByText(text, { exact: false }).filter({ visible: true });
  await expect(within.first(), `"${text}" is on the screen`).toBeVisible();
}

/** One seat of the seat map, however the approved design draws it. */
export async function seatControl(page: Page, seat: string): Promise<Locator> {
  const exact = page.getByRole('button', { name: seat, exact: true });
  if ((await exact.count()) > 0) return exact.first();
  const named = page.getByRole('button', {
    name: new RegExp(`(^|[^0-9A-Za-z])${escapeRegExp(seat)}([^0-9A-Za-z]|$)`, 'i'),
  });
  if ((await named.count()) > 0) return named.first();
  const tagged = page.locator(`[data-seat="${seat}"]`).filter({ visible: true });
  if ((await tagged.count()) > 0) return tagged.first();
  throw new Error(`no seat control for seat ${seat}`);
}

export async function isUnselectable(control: Locator): Promise<boolean> {
  if (await control.isDisabled()) return true;
  return (await control.getAttribute('aria-disabled')) === 'true';
}

/** Types an account into the app's OWN sign-up form (the form is not submitted). */
export async function fillSignUpForm(page: Page, account: TestAccount): Promise<string> {
  await fillControl(page, ['#field-fullName', 'input[name="fullName"]'], /full name/i, account.fullName);
  await fillControl(page, ['#field-mobile', 'input[name="mobile"]'], /mobile/i, account.mobile);

  const passwords = page.locator('input[type="password"]').filter({ visible: true });
  const passwordCount = await passwords.count();
  expect(passwordCount, 'the sign-up form asks for a password').toBeGreaterThan(0);
  await passwords.nth(0).fill(account.password);
  if (passwordCount > 1) await passwords.nth(1).fill(account.password);

  const question = await visibleControl(
    page,
    ['#field-securityQuestionId', 'select[name="securityQuestionId"]', 'select'],
    /security question/i,
  );
  const questionId = await chooseFirstOption(question);

  await fillControl(
    page,
    ['#field-securityAnswer', 'input[name="securityAnswer"]'],
    /security answer|answer/i,
    account.securityAnswer,
  );
  return questionId;
}

export async function submitSignUpForm(page: Page): Promise<void> {
  await clickAction(page, /sign up|create account/i);
}

/** The whole sign-up, as a traveller does it: the app's own form at its own address. */
export async function signUpThroughForm(page: Page, tag: string): Promise<TestAccount> {
  await page.goto('/signup');
  await settle(page);
  const account = newAccountDraft(tag);
  account.securityQuestionId = await fillSignUpForm(page, account);
  await submitSignUpForm(page);
  return account;
}

/** The whole sign-in, as a traveller does it. */
export async function logInThroughForm(page: Page, mobile: string, password: string): Promise<void> {
  await page.goto('/login');
  await settle(page);
  await fillControl(page, ['#field-mobile', 'input[name="mobile"]'], /mobile/i, mobile);
  const passwords = page.locator('input[type="password"]').filter({ visible: true });
  await passwords.first().fill(password);
  await clickAction(page, /log in|sign in/i);
}
