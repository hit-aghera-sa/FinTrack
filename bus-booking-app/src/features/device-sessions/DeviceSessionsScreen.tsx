import { useCallback, useEffect, useState } from 'react';
import { isAbortError } from '../../api/index.js';
import { formatDateTime } from '../../format/index.js';
import { navigate } from '../../router';
import { clearSessionUser, LOGIN_PATH } from '../../session/index.js';
import { Alert, EmptyState, Spinner } from '../../ui/index.js';
import { fetchDeviceSessions, revokeAllDeviceSessions, type DeviceSession } from './api.js';
import { deviceLabel, errorMessage, sessionCountLabel } from './presenters.js';

/**
 * ACTIVE DEVICES — the Profile sub-screen at /profile/sessions.
 *
 * Lists the browsers and devices currently signed in to the account, each with its device description
 * and when the session started, with the current one marked in words as well as by its badge, and
 * offers "Sign out everywhere": one `/api` call that revokes every session row, after which the
 * traveller is returned to Log in.
 *
 * The markup, classes and wording are the approved look of this screen; the loading, empty and error
 * states are drawn with the shared UI kit, so no colour or class of this lane's own is introduced.
 */

type LoadState = 'loading' | 'ready' | 'failed';

/** Where "Back to Profile" goes — the Profile page the app registers. */
const PROFILE_PATH = '/profile';

function footLabel(state: LoadState, count: number): string {
  if (state === 'ready') return sessionCountLabel(count);
  if (state === 'loading') return 'Checking your signed-in devices…';
  return 'Device list unavailable';
}

export function DeviceSessionsScreen(): JSX.Element {
  const [sessions, setSessions] = useState<readonly DeviceSession[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let live = true;
    setState('loading');
    setLoadError(null);

    fetchDeviceSessions(controller.signal)
      .then((rows: DeviceSession[]) => {
        if (!live) return;
        setSessions(rows);
        setState('ready');
      })
      .catch((caught: unknown) => {
        if (!live || isAbortError(caught)) return;
        setSessions([]);
        setLoadError(errorMessage(caught));
        setState('failed');
      });

    return () => {
      live = false;
      controller.abort();
    };
  }, [attempt]);

  const retry = useCallback((): void => {
    setAttempt((previous: number) => previous + 1);
  }, []);

  const signOutEverywhere = useCallback((): void => {
    setRevoking(true);
    setRevokeError(null);
    revokeAllDeviceSessions()
      .then(() => {
        clearSessionUser();
        navigate(LOGIN_PATH);
      })
      .catch((caught: unknown) => {
        setRevoking(false);
        setRevokeError(errorMessage(caught));
      });
  }, []);

  const goToProfile = useCallback((): void => {
    navigate(PROFILE_PATH);
  }, []);

  return (
    <div data-screen="/profile/sessions" data-testid="active-devices-sign-out-everywhere-page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Account</div>
          <h1 className="page-title">Active devices</h1>
          <p className="page-description">These browsers and devices are currently signed in.</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="button button-danger"
            onClick={signOutEverywhere}
            disabled={revoking}
            aria-busy={revoking}
            data-testid="active-devices-sign-out-everywhere-revoke"
          >
            Sign out everywhere
          </button>
        </div>
      </div>

      {revoking ? (
        <Alert kind="info">Signing you out of every device…</Alert>
      ) : null}

      {revokeError !== null ? (
        <div data-testid="active-devices-sign-out-everywhere-revoke-error">
          <Alert kind="error">{revokeError}</Alert>
        </div>
      ) : null}

      <div className="table-card has-head">
        <div className="table-head">
          <div className="card-title">Signed-in sessions</div>
        </div>

        {state === 'loading' ? <Spinner label="Loading your active devices…" /> : null}

        {state === 'failed' ? (
          <EmptyState
            title="We could not load your active devices"
            message={loadError ?? undefined}
            action={
              <button type="button" className="button button-secondary" onClick={retry}>
                Try again
              </button>
            }
          />
        ) : null}

        {state === 'ready' && sessions.length === 0 ? (
          <EmptyState
            title="No active devices"
            message="Browsers and devices signed in to this account will be listed here."
          />
        ) : null}

        {state === 'ready' && sessions.length > 0 ? (
          <div className="table-scroll">
            <table className="data-table is-striped" data-testid="active-devices-sign-out-everywhere-table">
              <caption>Active devices</caption>
              <thead>
                <tr>
                  <th scope="col">Device</th>
                  <th scope="col">Started</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: DeviceSession) => (
                  <tr key={session.id}>
                    <td>{deviceLabel(session.userAgent)}</td>
                    <td>{formatDateTime(session.createdAt)}</td>
                    <td>
                      {session.current ? (
                        <span className="badge badge-success">
                          <span className="badge-dot" aria-hidden="true" />
                          This device
                        </span>
                      ) : (
                        <span className="badge badge-info">Signed in</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        <div className="table-foot">
          <span>{footLabel(state, sessions.length)}</span>
          <button type="button" className="button button-ghost" onClick={goToProfile}>
            Back to Profile
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeviceSessionsScreen;
