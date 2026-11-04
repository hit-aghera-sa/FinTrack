import { useCallback, useState } from 'react';
import { navigate } from '../../../router';
import { LOGIN_PATH, useSession } from '../../../session/index.js';
import { saveFullNameRequest } from './api.js';
import { NAME_SAVED_MESSAGE, describeProfileError } from './presenters.js';
import { normaliseFullName } from './validation.js';

/** Whether the app still has to find out who is signed in. */
export type ProfileStatus = 'loading' | 'authenticated' | 'anonymous';

/** Everything the profile screen needs about the signed-in traveller and the two things it can do. */
export interface ProfileIdentityState {
  /** The traveller's name — the saved one, or what the server last confirmed. */
  readonly fullName: string;
  /** The login ID. Read-only everywhere in the product. */
  readonly mobile: string;
  readonly status: ProfileStatus;
  readonly signedIn: boolean;
  readonly saving: boolean;
  readonly loggingOut: boolean;
  /** The one failure sentence for the whole screen, or null. */
  readonly error: string | null;
  /** The one success sentence, or null. */
  readonly notice: string | null;
  /** Persist a new name. */
  readonly save: (fullName: string) => void;
  /** End this session and leave for the sign-in page. */
  readonly logOut: () => void;
}

/**
 * THE BEHAVIOUR BEHIND /profile.
 *
 * The name is persisted through the app's own `/api` surface and the session is then refreshed from
 * the account the server returned, so the sidebar, the tickets and this screen can never disagree
 * about who is signed in. Logging out ends the session server-side first and only then navigates, so
 * a traveller is never shown a signed-out screen while the cookie is still live.
 */
export function useProfileIdentity(): ProfileIdentityState {
  const session = useSession();
  const [savedName, setSavedName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const save = useCallback(
    (value: string): void => {
      const fullName = normaliseFullName(value);
      setSaving(true);
      setError(null);
      setNotice(null);
      void (async (): Promise<void> => {
        try {
          const updated = await saveFullNameRequest(fullName);
          setSavedName(updated.fullName);
          session.setUser(updated);
          setNotice(NAME_SAVED_MESSAGE);
        } catch (failure: unknown) {
          setError(describeProfileError(failure));
        } finally {
          setSaving(false);
        }
      })();
    },
    [session],
  );

  const logOut = useCallback((): void => {
    setLoggingOut(true);
    setError(null);
    setNotice(null);
    void (async (): Promise<void> => {
      try {
        await session.logout();
        navigate(LOGIN_PATH);
      } catch (failure: unknown) {
        setError(describeProfileError(failure));
        setLoggingOut(false);
      }
    })();
  }, [session]);

  const user = session.user;

  return {
    fullName: savedName ?? user?.fullName ?? '',
    mobile: user?.mobile ?? '',
    status: session.status,
    signedIn: user !== null,
    saving,
    loggingOut,
    error,
    notice,
    save,
    logOut,
  };
}
