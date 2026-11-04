// src/features/search/results/SearchResultsScreen.tsx
//
// THE SEARCH RESULTS SCREEN of /search/results?from=&to=&date=, in the look the client approved:
// the same page header, tile grid, detail lists and badge/button classes as the signed-off preview,
// now drawn from the app's real catalogue instead of sample buses.
//
// The buses still to depart on that route and day are listed earliest first with bus name and type,
// departure and arrival in 12-hour India time, fare per seat in whole rupees and seats left. Opening
// one goes to its seat map; a full bus says Sold out and cannot be opened. While the search runs the
// shared Spinner is shown, a failed request shows the shared Alert with the catalogue's sentence, and
// an empty result shows the no-buses message. No colour of its own is introduced anywhere.
import type { ReactElement } from 'react';
import { navigate } from '../../../router';
import { Alert, EmptyState, Spinner } from '../../../ui/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { resultsCountLabel, routeLabel } from './results-order.js';
import { formatTravelDate } from './results-query.js';
import { TripResultCard } from './TripResultCard';
import { useSearchResults } from './useSearchResults.js';

const PAGE_TEST_ID = 'search-search-results-screens-search-results-listing-screen-page';
const SEARCH_FORM_PATH = '/search';

/** The seat map of one trip — the address the app's route table registers for seat selection. */
function seatSelectionPath(tripId: string): string {
  return `/trips/${encodeURIComponent(tripId)}/seats`;
}

export function SearchResultsScreen(): JSX.Element {
  const { status, query, trips, fromCityName, toCityName, errorMessage, reload } = useSearchResults();

  const eyebrow = routeLabel(fromCityName, toCityName);
  const travelDate = formatTravelDate(query.date);
  const description =
    status === 'ready'
      ? [travelDate, resultsCountLabel(trips.length)].filter((part) => part !== '').join(' · ')
      : travelDate;

  const openTrip = (tripId: string): void => {
    navigate(seatSelectionPath(tripId));
  };

  const editSearch = (): void => {
    navigate(SEARCH_FORM_PATH);
  };

  let body: ReactElement;
  if (status === 'loading') {
    body = <Spinner label="Looking for buses" />;
  } else if (status === 'error') {
    body = (
      <>
        <Alert kind="error">{errorMessage ?? MESSAGES.offline}</Alert>
        <div className="page-actions">
          <button type="button" className="button button-primary" onClick={reload}>
            Try again
          </button>
        </div>
      </>
    );
  } else if (status === 'incomplete') {
    body = (
      <EmptyState
        title="Choose a route and a travel date"
        message="Pick From, To and a date on the search screen and the buses running that day will be listed here."
        action={
          <button type="button" className="button button-primary" onClick={editSearch}>
            Search buses
          </button>
        }
      />
    );
  } else if (trips.length === 0) {
    body = (
      <EmptyState
        title={MESSAGES.noBuses}
        message="Try another travel date for this route."
        action={
          <button type="button" className="button button-primary" onClick={editSearch}>
            Edit search
          </button>
        }
      />
    );
  } else {
    body = (
      <ul className="tile-grid">
        {trips.map((trip) => (
          <TripResultCard key={trip.id} trip={trip} onOpen={openTrip} />
        ))}
      </ul>
    );
  }

  return (
    <div data-screen="/search/results" data-testid={PAGE_TEST_ID}>
      <div className="page-header">
        <div>
          {eyebrow !== '' ? <div className="page-eyebrow">{eyebrow}</div> : null}
          <h1 className="page-title">Search results</h1>
          {description !== '' ? <p className="page-description">{description}</p> : null}
        </div>
        <div className="page-actions">
          <button type="button" className="button button-secondary" onClick={editSearch}>
            Edit search
          </button>
        </div>
      </div>
      {body}
    </div>
  );
}

export default SearchResultsScreen;
