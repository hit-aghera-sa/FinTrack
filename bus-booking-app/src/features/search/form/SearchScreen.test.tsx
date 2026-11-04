// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { MESSAGES } from '../../../messages/index.js';
import type { City } from '../../../models/catalogue/index.js';
import { searchDateBounds } from './date-window.js';
import { FROM_REQUIRED_MESSAGE } from './search-form.js';
import { SearchScreen } from './SearchScreen';

const TEST_ID = 'search-search-results-screens-bus-search-form-screen';

const CITIES: City[] = [
  { id: 'city-pune', name: 'Pune' },
  { id: 'city-mumbai', name: 'Mumbai' },
];

/** Only the three members `apiFetch` reads off a response. */
interface FakeResponse {
  readonly ok: boolean;
  readonly status: number;
  text(): Promise<string>;
}

function citiesResponse(): FakeResponse {
  const raw = JSON.stringify(CITIES);
  return { ok: true, status: 200, text: (): Promise<string> => Promise.resolve(raw) };
}

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let container: HTMLDivElement;
let root: Root;

function hook(id: string): string {
  return `[data-testid="${TEST_ID}-${id}"]`;
}

function requireSelect(id: string): HTMLSelectElement {
  const found = container.querySelector<HTMLSelectElement>(hook(id));
  if (found === null) throw new Error(`the ${id} select is not rendered`);
  return found;
}

function requireInput(id: string): HTMLInputElement {
  const found = container.querySelector<HTMLInputElement>(hook(id));
  if (found === null) throw new Error(`the ${id} input is not rendered`);
  return found;
}

/**
 * Types a value the way the browser does: through the prototype's setter, so React's value tracker
 * sees a change and the screen's onChange runs.
 */
function setValue(element: HTMLSelectElement | HTMLInputElement, value: string): void {
  const prototype: object = Object.getPrototypeOf(element);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  if (descriptor === undefined || descriptor.set === undefined) {
    throw new Error('the element has no value setter');
  }
  const setter = descriptor.set;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function submitForm(): void {
  const form = container.querySelector<HTMLFormElement>('form');
  if (form === null) throw new Error('the search form is not rendered');
  act(() => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

async function renderScreen(): Promise<void> {
  await act(async () => {
    root.render(<SearchScreen />);
  });
  // Lets the city list resolve before anything is asserted.
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}`;
}

beforeEach(() => {
  window.history.replaceState({}, '', '/search');
  vi.stubGlobal(
    'fetch',
    vi.fn((): Promise<FakeResponse> => Promise.resolve(citiesResponse())),
  );
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.unstubAllGlobals();
});

describe('SearchScreen', () => {
  it('offers the cities from the API and bounds the travel date to the next 30 days', async () => {
    await renderScreen();

    const page = container.querySelector<HTMLElement>(hook('page'));
    expect(page).not.toBeNull();

    const from = requireSelect('from');
    expect(from.textContent).toContain('Pune');
    expect(from.textContent).toContain('Mumbai');
    expect(from.disabled).toBe(false);

    const bounds = searchDateBounds(new Date());
    const date = requireInput('date');
    expect(date.min).toBe(bounds.min);
    expect(date.max).toBe(bounds.max);
    expect(date.value).toBe(bounds.min);
  });

  it('states the same-city guard and stays on the search screen', async () => {
    await renderScreen();

    setValue(requireSelect('from'), 'city-pune');
    setValue(requireSelect('to'), 'city-pune');

    const notice = container.querySelector<HTMLElement>(hook('same-city'));
    expect(notice).not.toBeNull();
    expect(notice?.textContent).toContain(MESSAGES.sameCity);

    submitForm();
    expect(currentUrl()).toBe('/search');
  });

  it('asks for the missing choices instead of searching', async () => {
    await renderScreen();

    submitForm();

    expect(container.textContent).toContain(FROM_REQUIRED_MESSAGE);
    expect(currentUrl()).toBe('/search');
  });

  it('hands the chosen route and date to the results screen', async () => {
    await renderScreen();

    const bounds = searchDateBounds(new Date());
    setValue(requireSelect('from'), 'city-pune');
    setValue(requireSelect('to'), 'city-mumbai');
    setValue(requireInput('date'), bounds.min);

    expect(container.querySelector(hook('same-city'))).toBeNull();

    submitForm();

    expect(currentUrl().startsWith('/search/results')).toBe(true);
  });
});
