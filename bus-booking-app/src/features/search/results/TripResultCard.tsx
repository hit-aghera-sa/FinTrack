import type { ReactElement } from 'react';
import { formatINR, formatTime } from '../../../format/index.js';
import { MESSAGES } from '../../../messages/index.js';
import { busTypeLabel, type TripSummary } from '../../../models/catalogue/index.js';
import {
  arrivalLabel,
  farePerSeatLabel,
  isSoldOut,
  seatsBadgeClass,
  seatsLeftLabel,
} from './results-order.js';

/**
 * ONE BUS IN THE RESULTS LIST — the approved tile: bus name and type, departure and arrival in
 * 12-hour India time, the fare per seat in whole rupees and the seats left.
 *
 * A bus with seats opens its seat map; a full bus says Sold out on a disabled action, so the state is
 * carried by words as well as by the badge.
 */

const CARD_TEST_ID = 'search-search-results-screens-search-results-listing-screen-trip';
const OPEN_TEST_ID = 'search-search-results-screens-search-results-listing-screen-open';
const SOLD_OUT_TEST_ID = 'search-search-results-screens-search-results-listing-screen-soldout';

export interface TripResultCardProps {
  readonly trip: TripSummary;
  /** Called with the trip's id when the traveller opens it. */
  readonly onOpen: (tripId: string) => void;
}

export function TripResultCard({ trip, onOpen }: TripResultCardProps): ReactElement {
  const soldOut = isSoldOut(trip);

  return (
    <li className="tile" data-testid={CARD_TEST_ID} data-trip-id={trip.id}>
      <div className="tile-head">
        <div className="tile-text">
          <div className="tile-title">{trip.busName}</div>
          <div className="tile-sub">{busTypeLabel(trip.busType)}</div>
        </div>
        <span className={seatsBadgeClass(trip.seatsLeft)}>{seatsLeftLabel(trip.seatsLeft)}</span>
      </div>
      <div className="detail-list">
        <div>
          <dt>Departs</dt>
          <dd>{formatTime(trip.departureAt)}</dd>
        </div>
        <div>
          <dt>Arrives</dt>
          <dd>{arrivalLabel(trip)}</dd>
        </div>
        <div>
          <dt>Fare</dt>
          <dd>{farePerSeatLabel(trip.farePerSeat)}</dd>
        </div>
      </div>
      <div className="tile-foot">
        <span className="text-strong">{formatINR(trip.farePerSeat)}</span>
        {soldOut ? (
          <button
            type="button"
            className="button button-secondary button-small"
            disabled
            aria-disabled="true"
            data-testid={SOLD_OUT_TEST_ID}
          >
            {MESSAGES.soldOut}
          </button>
        ) : (
          <button
            type="button"
            className="button button-primary button-small"
            data-testid={OPEN_TEST_ID}
            aria-label={`View seats on ${trip.busName}`}
            onClick={() => onOpen(trip.id)}
          >
            View seats
          </button>
        )}
      </div>
    </li>
  );
}

export default TripResultCard;
