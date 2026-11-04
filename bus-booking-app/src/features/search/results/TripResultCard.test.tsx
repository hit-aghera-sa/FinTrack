// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MESSAGES } from '../../../messages/index.js';
import { DEFAULT_BUS_TYPE, type TripSummary } from '../../../models/catalogue/index.js';
import { TripResultCard } from './TripResultCard';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function tripFixture(overrides: Partial<TripSummary> = {}): TripSummary {
  return {
    id: 'trip-shree',
    busName: 'Shree Travels',
    busType: DEFAULT_BUS_TYPE,
    fromCity: { id: 'city-mumbai', name: 'Mumbai' },
    toCity: { id: 'city-pune', name: 'Pune' },
    departureAt: '2099-01-02T16:00:00.000Z',
    arrivalAt: '2099-01-02T23:30:00.000Z',
    farePerSeat: 850,
    seatsLeft: 18,
    totalSeats: 36,
    ...overrides,
  };
}

async function renderCard(
  trip: TripSummary,
  onOpen: (tripId: string) => void,
): Promise<{ container: HTMLUListElement; root: Root }> {
  const container = document.createElement('ul');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<TripResultCard trip={trip} onOpen={onOpen} />);
  });
  return { container, root };
}

async function teardown(root: Root): Promise<void> {
  await act(async () => {
    root.unmount();
  });
  document.body.innerHTML = '';
}

describe('TripResultCard', () => {
  it('shows the bus, its type, both times, the fare and the seats left', async () => {
    const { container, root } = await renderCard(tripFixture(), () => undefined);
    const text = container.textContent ?? '';
    expect(text).toContain('Shree Travels');
    expect(text).toContain('Departs');
    expect(text).toContain('9:30');
    expect(text).toContain('Arrives');
    expect(text).toContain('+1 day');
    expect(text).toContain('850');
    expect(text).toContain('18 seats left');
    await teardown(root);
  });

  it('opens the trip when the traveller asks for its seats', async () => {
    const opened: string[] = [];
    const { container, root } = await renderCard(tripFixture(), (tripId) => {
      opened.push(tripId);
    });
    const action = container.querySelector<HTMLButtonElement>('button');
    expect(action).not.toBeNull();
    await act(async () => {
      action?.click();
    });
    expect(opened).toEqual(['trip-shree']);
    await teardown(root);
  });

  it('marks a full bus Sold out and refuses to open it', async () => {
    const opened: string[] = [];
    const { container, root } = await renderCard(tripFixture({ seatsLeft: 0 }), (tripId) => {
      opened.push(tripId);
    });
    expect(container.textContent ?? '').toContain(MESSAGES.soldOut);
    const action = container.querySelector<HTMLButtonElement>('button');
    expect(action?.disabled).toBe(true);
    await act(async () => {
      action?.click();
    });
    expect(opened).toEqual([]);
    await teardown(root);
  });
});
