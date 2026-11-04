// src/features/search/form/SearchScreen.tsx
//
// THE SEARCH SCREEN AT /search — the look the client approved, now live.
//
// Every class, word and element of the approved preview is kept; what has been added is the behaviour
// the screen was drawn for: the real city list from this app's own API, the travel date bounded to
// today..today+30 in India time, the "From and To cannot be the same city." guard, and the hand-over
// to the results screen with the chosen values encoded. The rules themselves live in `search-form.ts`
// and `useSearchForm.ts` beside this file, so they can be read and tested without rendering.
import type { ChangeEvent, FormEvent } from 'react';
import { Alert, Button, EmptyState, Spinner } from '../../../ui/index';
import { MESSAGES } from '../../../messages/index.js';
import { useSearchForm } from './useSearchForm';
import './SearchScreen.css';

/** The acceptance suite waits for this id on the screen's root element. */
const TEST_ID = 'search-search-results-screens-bus-search-form-screen';

export function SearchScreen(): JSX.Element {
  const form = useSearchForm();
  const { values, bounds } = form;
  const errors = form.visibleErrors;
  const citiesReady = form.status === 'ready';

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    form.submit();
  };

  const handleFrom = (event: ChangeEvent<HTMLSelectElement>): void => {
    form.setFromCity(event.target.value);
  };

  const handleTo = (event: ChangeEvent<HTMLSelectElement>): void => {
    form.setToCity(event.target.value);
  };

  const handleDate = (event: ChangeEvent<HTMLInputElement>): void => {
    form.setDate(event.target.value);
  };

  return (
    <div className="search-form-screen" data-screen="/search" data-testid={`${TEST_ID}-page`}>
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Bus Booking</div>
          <h1 className="page-title">Search buses</h1>
          <p className="page-description">Find buses for your route and travel date.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form className="form" aria-label="Bus search" noValidate onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="field">
                <label className="field-label" htmlFor="search-from">
                  From
                </label>
                <select
                  className="input"
                  id="search-from"
                  name="from"
                  value={values.fromCityId}
                  disabled={!citiesReady}
                  aria-invalid={errors.from !== null ? 'true' : 'false'}
                  aria-describedby={errors.from !== null ? 'search-from-error' : undefined}
                  data-testid={`${TEST_ID}-from`}
                  onChange={handleFrom}
                >
                  <option value="">Select a city</option>
                  {form.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {errors.from !== null ? (
                  <p className="search-form-error" id="search-from-error">
                    {errors.from}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="search-to">
                  To
                </label>
                <select
                  className="input"
                  id="search-to"
                  name="to"
                  value={values.toCityId}
                  disabled={!citiesReady}
                  aria-invalid={errors.to !== null ? 'true' : 'false'}
                  aria-describedby={errors.to !== null ? 'search-to-error' : undefined}
                  data-testid={`${TEST_ID}-to`}
                  onChange={handleTo}
                >
                  <option value="">Select a city</option>
                  {form.cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name}
                    </option>
                  ))}
                </select>
                {errors.to !== null ? (
                  <p className="search-form-error" id="search-to-error">
                    {errors.to}
                  </p>
                ) : null}
              </div>

              <div className="field">
                <label className="field-label" htmlFor="search-date">
                  Date
                </label>
                <input
                  className="input"
                  id="search-date"
                  name="date"
                  type="date"
                  value={values.date}
                  min={bounds.min}
                  max={bounds.max}
                  aria-invalid={errors.date !== null ? 'true' : 'false'}
                  aria-describedby={errors.date !== null ? 'search-date-error' : 'search-date-hint'}
                  data-testid={`${TEST_ID}-date`}
                  onChange={handleDate}
                />
                <span className="field-hint" id="search-date-hint">
                  Choose any date up to 30 days ahead.
                </span>
                {errors.date !== null ? (
                  <p className="search-form-error" id="search-date-error">
                    {errors.date}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="button button-primary button-large"
                disabled={!citiesReady}
                data-testid={`${TEST_ID}-submit`}
              >
                Search buses
              </button>
            </div>
          </form>
        </div>
      </div>

      {form.status === 'loading' ? (
        <div className="search-form-state" data-testid={`${TEST_ID}-loading`}>
          <Spinner label="Loading cities" />
        </div>
      ) : null}

      {form.status === 'failed' ? (
        <div className="search-form-state" data-testid={`${TEST_ID}-load-error`}>
          <Alert kind="error">{form.loadError ?? MESSAGES.offline}</Alert>
          <div className="form-actions">
            <Button variant="secondary" onClick={form.reload}>
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {form.status === 'empty' ? (
        <div className="search-form-state" data-testid={`${TEST_ID}-empty`}>
          <EmptyState
            title="No cities are available yet"
            message="Routes appear here as soon as bus services are published."
          />
        </div>
      ) : null}

      {errors.sameCity ? (
        <div className="notice notice-info" role="alert" data-testid={`${TEST_ID}-same-city`}>
          <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"></circle>
            <path d="M12 8v4m0 4h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
          </svg>
          {MESSAGES.sameCity}
        </div>
      ) : null}
    </div>
  );
}

export default SearchScreen;
