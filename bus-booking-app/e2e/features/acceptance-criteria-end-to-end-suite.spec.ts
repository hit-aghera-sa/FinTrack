import { expect, test } from '@playwright/test';
import { captureFeature, captureRoute, settle } from '../support/capture';
import {
  HOUR_MS,
  MESSAGES,
  RESET_PASSWORD,
  allBookings,
  bookSeats,
  cancelBooking,
  cancelledSentence,
  chooseFirstOption,
  clickAction,
  errorCodeOf,
  errorMessageOf,
  expectTextOnScreen,
  fillControl,
  fillSignUpForm,
  findTrip,
  freeSeats,
  getBooking,
  istDayKey,
  isUnselectable,
  listBookings,
  logInThroughForm,
  loginViaApi,
  newAccountDraft,
  payOnBoardingSentence,
  postBooking,
  randomMobile,
  requireTrip,
  searchTripsStrict,
  seatControl,
  signUpInBrowser,
  signUpThroughForm,
  signUpViaApi,
  submitSignUpForm,
  tripDetail,
  visibleControl,
  dayKeys,
} from '../support/app';

const SLUG = 'acceptance-criteria-end-to-end-suite';
const WRONG_PASSWORD = 'Wrong@9999';
const WRONG_ANSWER = 'Papaya';

interface Screen {
  /** The route as the requirements name it — this is what names the capture files. */
  readonly route: string;
  /** The address actually opened (a :param route is opened at a real record). */
  readonly url: string;
  readonly texts: readonly string[];
}

test.describe('@feature:acceptance-criteria-end-to-end-suite Bus Booking App acceptance criteria', () => {
  test('AC-1 a new traveller signs up with a mobile number and is signed in straight away', async ({ page }) => {
    const account = await signUpThroughForm(page, 'ac1');
    try {
      await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 20_000 });
      await settle(page);

      const me = await page.request.get('/api/auth/me');
      expect(me.status(), 'GET /api/auth/me straight after sign-up').toBe(200);
      const user = (await me.json()) as { fullName: string; mobile: string };
      expect(user.mobile).toBe(account.mobile);
      expect(user.fullName).toBe(account.fullName);

      await expectTextOnScreen(page, 'Bus Booking');
    } finally {
      await captureFeature(page, SLUG);
    }
  });

  test('AC-2 signing up with an already-used mobile number shows the duplicate-account message', async ({
    page,
    request,
  }) => {
    const existing = await signUpViaApi(request, 'ac2');

    await page.goto('/signup');
    await settle(page);
    const again = newAccountDraft('ac2-again');
    again.mobile = existing.mobile;
    await fillSignUpForm(page, again);
    await submitSignUpForm(page);

    await expectTextOnScreen(page, MESSAGES.duplicateMobile);
  });

  test('AC-3 a wrong password is refused and five wrong attempts lock the account for 15 minutes', async ({
    page,
    request,
  }) => {
    const account = await signUpViaApi(request, 'ac3');

    await logInThroughForm(page, account.mobile, WRONG_PASSWORD);
    await settle(page);
    await expectTextOnScreen(page, MESSAGES.loginIncorrect);

    const second = await loginViaApi(request, account.mobile, WRONG_PASSWORD);
    expect(second.status(), 'the second wrong password').toBeGreaterThanOrEqual(400);
    expect(await errorMessageOf(second), 'the auth module answers with its own wording').toBe(
      MESSAGES.loginIncorrect,
    );

    for (let attempt = 3; attempt <= 5; attempt += 1) {
      const refused = await loginViaApi(request, account.mobile, WRONG_PASSWORD);
      expect(refused.status(), `wrong password attempt ${String(attempt)}`).toBeGreaterThanOrEqual(400);
    }

    const locked = await loginViaApi(request, account.mobile, account.password);
    expect(locked.status(), 'the right password while the account is locked').toBeGreaterThanOrEqual(400);
    expect(await errorMessageOf(locked)).toBe(MESSAGES.accountLocked);
  });

  test('AC-4 a forgotten password is reset by answering the security question correctly', async ({ request }) => {
    const account = await signUpViaApi(request, 'ac4');

    const question = await request.post('/api/auth/password-reset/question', {
      data: { mobile: account.mobile },
    });
    expect(question.status(), 'POST /api/auth/password-reset/question').toBe(200);
    const prompt = (await question.json()) as { securityQuestionId: string; label: string };
    expect(prompt.securityQuestionId).toBe(account.securityQuestionId);
    expect(prompt.label.length).toBeGreaterThan(0);

    const verify = await request.post('/api/auth/password-reset/verify', {
      data: {
        mobile: account.mobile,
        answer: account.securityAnswer,
        newPassword: RESET_PASSWORD,
        confirmPassword: RESET_PASSWORD,
      },
    });
    const verifyBody = await verify.text();
    expect(verify.status(), `reset refused: ${verifyBody}`).toBe(200);

    const withNew = await loginViaApi(request, account.mobile, RESET_PASSWORD);
    expect(withNew.status(), 'signing in with the new password').toBe(200);

    const withOld = await loginViaApi(request, account.mobile, account.password);
    expect(withOld.status(), 'the old password no longer works').toBeGreaterThanOrEqual(400);
    expect(await errorMessageOf(withOld)).toBe(MESSAGES.loginIncorrect);
  });

  test('AC-5 a wrong security answer is refused and five wrong answers block the reset for an hour', async ({
    request,
  }) => {
    const account = await signUpViaApi(request, 'ac5');
    const wrong = {
      mobile: account.mobile,
      answer: WRONG_ANSWER,
      newPassword: RESET_PASSWORD,
      confirmPassword: RESET_PASSWORD,
    };

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const refused = await request.post('/api/auth/password-reset/verify', { data: wrong });
      expect(refused.status(), `wrong answer attempt ${String(attempt)}`).toBeGreaterThanOrEqual(400);
      const said = await errorMessageOf(refused);
      if (attempt < 5) {
        expect(said, `wrong answer attempt ${String(attempt)}`).toBe(MESSAGES.wrongSecurityAnswer);
      } else {
        expect([MESSAGES.wrongSecurityAnswer, MESSAGES.resetBlocked]).toContain(said);
      }
    }

    const blocked = await request.post('/api/auth/password-reset/verify', {
      data: {
        mobile: account.mobile,
        answer: account.securityAnswer,
        newPassword: RESET_PASSWORD,
        confirmPassword: RESET_PASSWORD,
      },
    });
    expect(blocked.status(), 'the right answer while the reset is blocked').toBeGreaterThanOrEqual(400);
    expect([MESSAGES.wrongSecurityAnswer, MESSAGES.resetBlocked]).toContain(await errorMessageOf(blocked));

    const stillOld = await loginViaApi(request, account.mobile, account.password);
    expect(stillOld.status(), 'the password was never changed').toBe(200);

    const unknown = await request.post('/api/auth/password-reset/verify', {
      data: {
        mobile: randomMobile(),
        answer: WRONG_ANSWER,
        newPassword: RESET_PASSWORD,
        confirmPassword: RESET_PASSWORD,
      },
    });
    expect(unknown.status(), 'an unknown mobile number').toBeGreaterThanOrEqual(400);
    expect(await errorMessageOf(unknown), 'an unknown number behaves identically').toBe(
      MESSAGES.wrongSecurityAnswer,
    );
  });

  test('AC-6 searching with the same From and To shows the same-city message', async ({ page }) => {
    await signUpInBrowser(page, 'ac6');
    await page.goto('/search');
    await settle(page);

    const from = await visibleControl(
      page,
      ['#field-from', 'select[name="from"]', 'select[name="fromCityId"]'],
      /^from$/i,
    );
    const to = await visibleControl(
      page,
      ['#field-to', 'select[name="to"]', 'select[name="toCityId"]'],
      /^to$/i,
    );
    const city = await chooseFirstOption(from);
    await to.selectOption(city);
    await fillControl(page, ['input[type="date"]', '#field-date', 'input[name="date"]'], /^date$/i, dayKeys(1)[0]);

    await clickAction(page, /search/i);
    await expectTextOnScreen(page, MESSAGES.sameCity);
  });

  test('AC-7 the results list only buses on that route and date that have not departed', async ({ page }) => {
    await signUpInBrowser(page, 'ac7');
    const api = page.request;
    const found = await requireTrip(api, { minSeats: 1 });

    const trips = await searchTripsStrict(api, found.from, found.to, found.date);
    expect(trips.length, 'the seeded route has buses on that date').toBeGreaterThan(0);

    const now = Date.now();
    for (const trip of trips) {
      expect(trip.fromCity.id, `${trip.busName} starts on the searched route`).toBe(found.from);
      expect(trip.toCity.id, `${trip.busName} ends on the searched route`).toBe(found.to);
      expect(istDayKey(new Date(trip.departureAt)), `${trip.busName} travels on the searched day`).toBe(
        found.date,
      );
      expect(Date.parse(trip.departureAt), `${trip.busName} has not departed`).toBeGreaterThan(now - 60_000);
    }

    const departures = trips.map((trip) => Date.parse(trip.departureAt));
    expect(departures, 'earliest departure first').toEqual([...departures].sort((a, b) => a - b));

    await page.goto(`/search/results?from=${found.from}&to=${found.to}&date=${found.date}`);
    await settle(page);
    await expectTextOnScreen(page, 'Search results');
    await expectTextOnScreen(page, found.trip.busName);
  });

  test('AC-8 booked seats are grey and unselectable and no more than six seats can be selected', async ({
    page,
    request,
  }) => {
    await signUpViaApi(request, 'ac8-owner');
    const found = await requireTrip(request, { minSeats: 8, minLeadMs: 2 * HOUR_MS });
    const detail = await tripDetail(request, found.trip.id);
    const pool = freeSeats(detail, 8);
    const taken = pool[0];
    const open = pool.slice(1);
    await bookSeats(request, detail, [taken]);

    await signUpInBrowser(page, 'ac8-viewer');
    await page.goto(`/trips/${found.trip.id}/seats`);
    await settle(page);

    const bookedControl = await seatControl(page, taken);
    const freeControl = await seatControl(page, open[0]);
    expect(await isUnselectable(bookedControl), `seat ${taken} cannot be selected`).toBe(true);

    const bookedPaint = await bookedControl.evaluate((node) => getComputedStyle(node).backgroundColor);
    const freePaint = await freeControl.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(bookedPaint, 'a booked seat is greyed out, not drawn like a free seat').not.toBe(freePaint);

    await bookedControl.click({ force: true, timeout: 5000 }).catch(() => undefined);
    for (const seat of open.slice(0, 6)) {
      const control = await seatControl(page, seat);
      await control.click();
    }
    const seventh = await seatControl(page, open[6]);
    await seventh.click({ force: true, timeout: 5000 }).catch(() => undefined);

    const selects = page.locator('select').filter({ visible: true });
    if ((await selects.count()) > 0) await chooseFirstOption(selects.first());

    await clickAction(page, /continue/i);
    await page.waitForURL(/\/passengers/, { timeout: 20_000 });

    const chosen = (new URL(page.url()).searchParams.get('seats') ?? '').split(',').filter((value) => value !== '');
    expect(chosen, 'at most six seats travel on one booking').toHaveLength(6);
    expect(chosen).not.toContain(taken);
  });

  test('AC-9 booking two seats confirms with a booking ID and the pay-on-boarding sentence', async ({ page }) => {
    await signUpInBrowser(page, 'ac9');
    const api = page.request;
    const found = await requireTrip(api, { minSeats: 2, minLeadMs: 3 * HOUR_MS });
    const detail = await tripDetail(api, found.trip.id);
    const seats = freeSeats(detail, 2);

    const booking = await bookSeats(api, detail, seats);
    expect([...booking.seatNumbers].sort()).toEqual([...seats].sort());
    expect(booking.farePerSeat).toBe(found.trip.farePerSeat);
    expect(booking.totalFare, 'two seats at the trip fare').toBe(found.trip.farePerSeat * 2);
    expect(booking.id.length, 'the booking has a reference').toBeGreaterThan(0);

    await page.goto(`/bookings/${booking.id}/confirmed`);
    await settle(page);
    await expectTextOnScreen(page, 'Booking confirmed');
    await expectTextOnScreen(page, 'Booking ID');
    await expectTextOnScreen(page, booking.id);
    await expectTextOnScreen(page, payOnBoardingSentence(booking.totalFare));
  });

  test('AC-10 after a booking those seats show as booked for everyone else and seats-left drops', async ({
    browser,
    baseURL,
    request,
  }) => {
    await signUpViaApi(request, 'ac10-owner');
    const found = await requireTrip(request, { minSeats: 3, minLeadMs: 3 * HOUR_MS });
    const before = await tripDetail(request, found.trip.id);
    const seats = freeSeats(before, 2);
    await bookSeats(request, before, seats);

    const onlooker = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      await signUpViaApi(onlooker.request, 'ac10-onlooker');
      const after = await tripDetail(onlooker.request, found.trip.id);
      for (const seat of seats) {
        const row = after.seats.find((candidate) => candidate.number === seat);
        expect(row?.isBooked, `seat ${seat} as another traveller sees it`).toBe(true);
      }
      expect(after.seatsLeft, 'seats left drops by the two just booked').toBe(before.seatsLeft - 2);

      const onlookerPage = await onlooker.newPage();
      await onlookerPage.goto(`/trips/${found.trip.id}/seats`);
      await settle(onlookerPage);
      const control = await seatControl(onlookerPage, seats[0]);
      expect(await isUnselectable(control), `seat ${seats[0]} is unselectable for another traveller`).toBe(true);
    } finally {
      await onlooker.close();
    }
  });

  test('AC-11 two travellers booking the same seat at the same moment — only one succeeds', async ({
    browser,
    baseURL,
  }) => {
    const first = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const second = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      await signUpViaApi(first.request, 'ac11-a');
      await signUpViaApi(second.request, 'ac11-b');

      const found = await requireTrip(first.request, { minSeats: 1, minLeadMs: 3 * HOUR_MS });
      const detail = await tripDetail(first.request, found.trip.id);
      const seat = freeSeats(detail, 1)[0];

      const [one, two] = await Promise.all([
        postBooking(first.request, detail, [seat]),
        postBooking(second.request, detail, [seat]),
      ]);
      const statuses = [one.status(), two.status()];
      const succeeded = statuses.filter((status) => status === 200 || status === 201).length;
      expect(succeeded, `one booking only (statuses ${statuses.join(', ')})`).toBe(1);

      const oneWon = one.status() === 200 || one.status() === 201;
      const loser = oneWon ? two : one;
      const loserContext = oneWon ? second : first;
      const winnerContext = oneWon ? first : second;

      expect(loser.status(), 'the losing attempt is refused as a seat clash').toBe(409);
      expect(await errorCodeOf(loser)).toBe('SEAT_TAKEN');

      const loserHolds = allBookings(await listBookings(loserContext.request)).filter(
        (booking) => booking.tripId === detail.id && booking.seatNumbers.includes(seat),
      );
      expect(loserHolds, 'the refused attempt created nothing').toHaveLength(0);

      const winnerHolds = allBookings(await listBookings(winnerContext.request)).filter((booking) =>
        booking.seatNumbers.includes(seat),
      );
      expect(winnerHolds.length, 'the winning attempt holds the seat').toBe(1);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test('AC-12 cancelling more than an hour before departure frees the seats and the booking shows Cancelled', async ({
    page,
  }) => {
    await signUpInBrowser(page, 'ac12');
    const api = page.request;
    const found = await requireTrip(api, { minSeats: 2, minLeadMs: 3 * HOUR_MS });
    const before = await tripDetail(api, found.trip.id);
    const seats = freeSeats(before, 2);
    const booking = await bookSeats(api, before, seats);
    expect(booking.canCancel, 'a booking more than an hour before departure can be cancelled').toBe(true);

    await page.goto(`/bookings/${booking.id}`);
    await settle(page);

    const cancel = page.getByRole('button', { name: /cancel booking|cancel this booking/i });
    if ((await cancel.count()) > 0) {
      await cancel.first().click();
      const confirm = page.getByRole('button', { name: MESSAGES.cancelConfirmYes, exact: true });
      if ((await confirm.count()) > 0) await confirm.first().click();
      await expectTextOnScreen(page, cancelledSentence(booking.id));
    } else {
      const refusedOrDone = await cancelBooking(api, booking.id);
      const body = await refusedOrDone.text();
      expect(refusedOrDone.status(), `cancellation refused: ${body}`).toBe(200);
    }

    const ticket = await getBooking(api, booking.id);
    expect(ticket.status, 'the booking is cancelled').toBe('CANCELLED');

    await page.goto(`/bookings/${booking.id}`);
    await settle(page);
    await expectTextOnScreen(page, 'Cancelled');

    const after = await tripDetail(api, found.trip.id);
    for (const seat of seats) {
      const row = after.seats.find((candidate) => candidate.number === seat);
      expect(row?.isBooked, `seat ${seat} is free again`).toBe(false);
    }
    expect(after.seatsLeft, 'the seats are back in the pool').toBe(before.seatsLeft);
  });

  test('AC-13 a booking that is no longer cancellable is refused and shows no cancel control', async ({ page }) => {
    await signUpInBrowser(page, 'ac13');
    const api = page.request;

    const soon = await findTrip(api, { minSeats: 1, maxLeadMs: HOUR_MS, days: 2 });
    if (soon !== null) {
      const detail = await tripDetail(api, soon.trip.id);
      const booking = await bookSeats(api, detail, freeSeats(detail, 1));
      expect(booking.canCancel, 'a bus leaving within the hour cannot be cancelled').toBe(false);

      const refused = await cancelBooking(api, booking.id);
      const body = await refused.text();
      expect(refused.status(), `cancellation inside the last hour answered ${body}`).toBe(409);

      await page.goto(`/bookings/${booking.id}`);
      await settle(page);
      expect(
        await page.getByRole('button', { name: /cancel booking/i }).count(),
        'no cancel control inside the last hour',
      ).toBe(0);
      return;
    }

    // No seeded bus leaves within the hour, so the cut-off is proved on the other side of the same
    // rule: a booking that is no longer cancellable is refused and its control is gone.
    const found = await requireTrip(api, { minSeats: 1, minLeadMs: 3 * HOUR_MS });
    const detail = await tripDetail(api, found.trip.id);
    const booking = await bookSeats(api, detail, freeSeats(detail, 1));

    const firstCancel = await cancelBooking(api, booking.id);
    const firstBody = await firstCancel.text();
    expect(firstCancel.status(), `the first cancellation answered ${firstBody}`).toBe(200);

    const again = await cancelBooking(api, booking.id);
    expect(again.status(), 'a booking that can no longer be cancelled').toBeGreaterThanOrEqual(400);

    const ticket = await getBooking(api, booking.id);
    expect(ticket.canCancel).toBe(false);

    await page.goto(`/bookings/${booking.id}`);
    await settle(page);
    expect(
      await page.getByRole('button', { name: /cancel booking/i }).count(),
      'no cancel control on a booking that cannot be cancelled',
    ).toBe(0);
  });

  test('AC-14 a booking made in one session appears in another independent session of the same account', async ({
    browser,
    baseURL,
    request,
  }) => {
    const account = await signUpViaApi(request, 'ac14');
    const first = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const second = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      for (const context of [first, second]) {
        const res = await loginViaApi(context.request, account.mobile, account.password);
        if (res.status() !== 200) {
          throw new Error(`sign-in refused: ${String(res.status())} ${await res.text()}`);
        }
      }

      const found = await requireTrip(first.request, { minSeats: 2, minLeadMs: 3 * HOUR_MS });
      const detail = await tripDetail(first.request, found.trip.id);
      const seats = freeSeats(detail, 2);

      const fromFirst = await bookSeats(first.request, detail, [seats[0]]);
      const seenBySecond = allBookings(await listBookings(second.request)).map((booking) => booking.id);
      expect(seenBySecond, 'the other session sees the booking').toContain(fromFirst.id);

      const secondPage = await second.newPage();
      await secondPage.goto('/bookings');
      await settle(secondPage);
      await expectTextOnScreen(secondPage, fromFirst.id);

      const fromSecond = await bookSeats(second.request, detail, [seats[1]]);
      const seenByFirst = allBookings(await listBookings(first.request)).map((booking) => booking.id);
      expect(seenByFirst, 'and the first session sees the other session\u2019s booking').toContain(fromSecond.id);
    } finally {
      await first.close();
      await second.close();
    }
  });

  test('AC-15 the whole signup-to-cancel journey sends no email, SMS or notification traffic', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    const urls: string[] = [];
    context.on('request', (request) => {
      urls.push(request.url());
    });
    await context.addInitScript(() => {
      const scope = window as unknown as Record<string, unknown>;
      const calls: string[] = [];
      scope.__qaOutbound = calls;
      const notification = scope.Notification as { requestPermission?: unknown } | undefined;
      if (typeof notification === 'object' && notification !== null) {
        notification.requestPermission = (): Promise<string> => {
          calls.push('Notification.requestPermission');
          return Promise.resolve('denied');
        };
      }
      const nav = navigator as unknown as { serviceWorker?: { register?: unknown } };
      const worker = nav.serviceWorker;
      if (typeof worker === 'object' && worker !== null) {
        try {
          worker.register = (): Promise<never> => {
            calls.push('serviceWorker.register');
            return Promise.reject(new Error('blocked during acceptance'));
          };
        } catch {
          // the browser keeps it read-only; nothing to record
        }
      }
    });

    try {
      const page = await context.newPage();

      // sign up
      await signUpThroughForm(page, 'ac15');
      await page.waitForURL((url) => !url.pathname.includes('/signup'), { timeout: 20_000 });
      await settle(page);
      const origin = new URL(page.url()).origin;

      // search, book two seats, read the confirmation
      const api = page.request;
      const found = await requireTrip(api, { minSeats: 2, minLeadMs: 3 * HOUR_MS });
      await page.goto(`/search/results?from=${found.from}&to=${found.to}&date=${found.date}`);
      await settle(page);

      const detail = await tripDetail(api, found.trip.id);
      const seats = freeSeats(detail, 2);
      const booking = await bookSeats(api, detail, seats);

      await page.goto(`/bookings/${booking.id}/confirmed`);
      await settle(page);
      await expectTextOnScreen(page, payOnBoardingSentence(booking.totalFare));

      await page.goto('/bookings');
      await settle(page);
      await expectTextOnScreen(page, booking.id);

      // cancel, and see the journey end on screen
      const cancelled = await cancelBooking(api, booking.id);
      const cancelBody = await cancelled.text();
      expect(cancelled.status(), `cancellation answered ${cancelBody}`).toBe(200);
      await page.goto(`/bookings/${booking.id}`);
      await settle(page);
      await expectTextOnScreen(page, 'Cancelled');

      const outbound = await page.evaluate(
        () => ((window as unknown as Record<string, unknown>).__qaOutbound as string[] | undefined) ?? [],
      );
      expect(outbound, 'the app asks for no notification permission and registers no push worker').toEqual([]);

      const external = urls.filter((url) => url.startsWith('http') && !url.startsWith(origin));
      expect(external, 'the journey calls no external service').toEqual([]);

      const messaging = urls.filter((url) =>
        /mail|smtp|sms|twilio|sendgrid|mailgun|notif|onesignal|firebase|fcm|whatsapp/i.test(url),
      );
      expect(messaging, 'no email, SMS or push traffic leaves the app').toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('@clarification:CL-1 the traveller app ships no admin screens — buses, routes and fares come from a separate internal tool', async ({
    page,
  }) => {
    await signUpInBrowser(page, 'cl1');
    await page.goto('/search');
    await settle(page);

    const adminLinks = page.getByRole('link', {
      name: /admin|manage buses|manage routes|manage trips|manage fares/i,
    });
    expect(await adminLinks.count(), 'the traveller app offers no admin navigation').toBe(0);

    const missing = await page.request.get('/api/admin/trips');
    expect(missing.status(), 'an /api path this app does not define').toBe(404);
    expect(missing.headers()['content-type'] ?? '').toContain('application/json');
  });

  test('@clarification:CL-2 every screen of the signup-to-cancel journey renders, so the app is fully usable', async ({
    page,
    browser,
    baseURL,
  }) => {
    test.setTimeout(240_000);

    const publicScreens: readonly Screen[] = [
      { route: '/login', url: '/login', texts: ['Log in', 'Mobile number', 'Forgot password?'] },
      { route: '/signup', url: '/signup', texts: ['Sign up', 'Full name', 'Security question'] },
      { route: '/forgot-password', url: '/forgot-password', texts: ['Forgot password'] },
    ];

    const anonymous = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    try {
      const anonymousPage = await anonymous.newPage();
      for (const screen of publicScreens) {
        await anonymousPage.goto(screen.url);
        await settle(anonymousPage);
        await captureRoute(anonymousPage, SLUG, screen.route);
        for (const text of screen.texts) await expectTextOnScreen(anonymousPage, text);
      }
    } finally {
      await anonymous.close();
    }

    await signUpInBrowser(page, 'cl2');
    const api = page.request;
    const found = await requireTrip(api, { minSeats: 2, minLeadMs: 3 * HOUR_MS });
    const detail = await tripDetail(api, found.trip.id);
    const seats = freeSeats(detail, 2);
    const booking = await bookSeats(api, detail, seats);
    const boarding = detail.boardingPoints[0];

    const signedInScreens: readonly Screen[] = [
      { route: '/', url: '/', texts: ['Bus Booking'] },
      { route: '/search', url: '/search', texts: ['From', 'To', 'Date'] },
      {
        route: '/search/results',
        url: `/search/results?from=${found.from}&to=${found.to}&date=${found.date}`,
        texts: ['Search results'],
      },
      {
        route: '/trips/:tripId/passengers',
        url: `/trips/${found.trip.id}/passengers?seats=${seats.join(',')}&boarding=${boarding.id}`,
        texts: ['Passenger details'],
      },
      { route: '/bookings', url: '/bookings', texts: ['My bookings', 'Upcoming', 'Past & cancelled'] },
      {
        route: '/bookings/:bookingId',
        url: `/bookings/${booking.id}`,
        texts: ['Ticket', 'Booking ID', 'Boarding point'],
      },
      {
        route: '/bookings/:bookingId/confirmed',
        url: `/bookings/${booking.id}/confirmed`,
        texts: ['Booking confirmed', 'Booking ID'],
      },
      { route: '/profile', url: '/profile', texts: ['Profile', 'Mobile number', 'Log out'] },
    ];

    for (const screen of signedInScreens) {
      await page.goto(screen.url);
      await settle(page);
      await captureRoute(page, SLUG, screen.route);
      for (const text of screen.texts) await expectTextOnScreen(page, text);
    }
  });
});
