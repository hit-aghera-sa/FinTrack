import { useCallback, useEffect, useState } from 'react';
import { apiFetch, isAbortError, isApiError, isOfflineError } from '../../../api/index.js';
import { MESSAGES } from '../../../messages/index.js';
import type { BookingRecord } from '../../../models/bookings/index.js';
import { MY_BOOKINGS_API_PATH, normaliseMyBookings } from './my-bookings-list.js';

/**
 * THE MY BOOKINGS LIST'S DATA.
 *
 * One authenticated read of `GET /api/bookings`, split into the two tabs against the moment of the
 * read. A superseded request is aborted, so leaving the screen never writes into an unmounted one.
 */

/** What a traveller is told when the list could not be loaded for an unrecognised reason. */
export const LOAD_FAILED_MESSAGE = 'Your bookings could not be loaded. Please try again.';

/** The sentence to show for a failed load. */
export function describeListError(error: unknown): string {
  if (isOfflineError(error)) return MESSAGES.offline;
  if (isApiError(error)) return error.message;
  return LOAD_FAILED_MESSAGE;
}

export type MyBookingsStatus = 'loading' | 'ready' | 'error';

interface LoadState {
  readonly status: MyBookingsStatus;
  readonly upcoming: BookingRecord[];
  readonly past: BookingRecord[];
  readonly error: string | null;
}

export interface MyBookingsState extends LoadState {
  /** Read the list again — used by the error state's Try again button. */
  readonly reload: () => void;
}

const LOADING: LoadState = { status: 'loading', upcoming: [], past: [], error: null };

export function useMyBookings(): MyBookingsState {
  const [state, setState] = useState<LoadState>(LOADING);
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState(LOADING);

    apiFetch<unknown>(MY_BOOKINGS_API_PATH, { signal: controller.signal })
      .then((payload: unknown) => {
        if (!active) return;
        const split = normaliseMyBookings(payload, Date.now());
        setState({ status: 'ready', upcoming: split.upcoming, past: split.past, error: null });
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setState({ status: 'error', upcoming: [], past: [], error: describeListError(error) });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt]);

  const reload = useCallback((): void => {
    setAttempt((value: number) => value + 1);
  }, []);

  return { ...state, reload };
}
