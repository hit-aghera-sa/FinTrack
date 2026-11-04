// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MESSAGES } from '../../../messages/index.js';
import { DEFAULT_BUS_TYPE, type City, type TripSummary } from '../../../models/catalogue/index.js';
import { SearchResultsScreen } from './SearchResultsScreen';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CITIES: City[] = [
  { id: 'city-mumbai', name: 'Mumbai' },
  { id: 'city-pune', name: 'Pune' },
];

function tripFixture(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'trip-shree',
    busName: 'Shree Travels',
    busType: DEFAULT_BUS_TYPE,
    fromCity: CITIES[0],
    toCity: CITIES[1],
    departureAt: '2099-01-02T16:00:00.000Z',
    arrivalAt: '2099-01-02T23:30:00.000Z',
    farePerSeat: 850,
    seatsLeft: 18,
    totalSeats: 36,
    ...overrides,
  };
}

/** A minimal stand-in for the two GETs this screen makes: the trips of a route, and the city list. */
function installApiStub(trips: readonly TripSummary[]): void {
  const stub = (input: unknown): Promise<unknown> => {
    const url = String(input);
    const payload: unknown = url.includes('/api/trips') ? trips : CITIES;
    const body = JSON.stringify(payload);
    return Promise.resolve({
      ok: true,
      status: 200,
      text: (): Promise<string> => Promise.resolve(body),
    });
  };
  Object.assign(globalThis, { fetch: stub });
}

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

async function renderScreen(): Promise<{ container: HTMLDivElement; root: Root }> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<SearchResultsScreen />);
  });
  await flush();
  await flush();
  return { container, root };
}

async function teardown(root: Root): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  document.body.innerHTML = '';
}

beforeEach(() => {
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/search/results?from=city-mumbai&to=city-pune&date=2099-01-02');
});

describe('SearchResultsScreen', () => {
  it('lists the buses still to depart, earliest first, under its own heading', async () => {
    installApiStub([
      tripFixture({ id: 'trip-shree', busName: 'Shree Travels', departureAt: '2099-01-02T10:00:00.000Z' }),
      tripFixture({
        id: 'trip-gone',
        busName: 'Old Departed',
        departureAt: '2000-01-02T10:00:00.000Z',
        arrivalAt: '2000-01-02T14:00:00.000Z',
      }),
      tripFixture({ id: 'trip-neeta', busName: 'Neeta Travels', departureAt: '2099-01-02T06:00:00.000Z' }),
      tripFixture({ id: 'trip-purple', busName: 'Purple Express', departureAt: '2099-01-02T02:00:00.000Z' }),
    ]);
    const { container, root } = await renderScreen();

    const titles = Array.from(container.querySelectorAll('.tile-title'), (node) => node.textContent);
    expect(titles).toEqual(['Purple Express', 'Neeta Travels', 'Shree Travels']);

    const text = container.textContent ?? '';
    expect(text).toContain('Search results');
    expect(text).toContain('Mumbai → Pune');
    expect(text).not.toContain('Old Departed');
    expect(
      container.querySelector('[data-testid="search-search-results-screens-search-results-listing-screen-page"]'),
    ).not.toBeNull();
    await teardown(root);
  });

  it('marks a full bus Sold out with a disabled action', async () => {
    installApiStub([
      tripFixture({ id: 'trip-neeta', busName: 'Neeta Travels', seatsLeft: 0 }),
      tripFixture({ id: 'trip-purple', busName: 'Purple Express', departureAt: '2099-01-02T02:00:00.000Z' }),
    ]);
    const { container, root } = await renderScreen();

    const soldOutCard = container.querySelector('[data-trip-id="trip-neeta"]');
    expect(soldOutCard).not.toBeNull();
    expect(soldOutCard?.textContent ?? '').toContain(MESSAGES.soldOut);
    const action = soldOutCard?.querySelector<HTMLButtonElement>('button');
    expect(action?.disabled).toBe(true);
    await teardown(root);
  });

  it('shows the no-buses message when the route has nothing on that date', async () => {
    installApiStub([]);
    const { container, root } = await renderScreen();

    expect(container.textContent ?? '').toContain(MESSAGES.noBuses);
    expect(container.querySelectorAll('.tile')).toHaveLength(0);
    await teardown(root);
  });

  it('asks for a route and a date when the address names none', async () => {
    window.history.replaceState(null, '', '/search/results');
    installApiStub([tripFixture()]);
    const { container, root } = await renderScreen();

    expect(container.textContent ?? '').toContain('Choose a route and a travel date');
    expect(container.querySelectorAll('.tile')).toHaveLength(0);
    await teardown(root);
  });
});
