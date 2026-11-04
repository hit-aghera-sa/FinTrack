import { useEffect, type ReactElement } from 'react';
import { navigate } from '../router';
import { useSession } from '../session/index.js';
import { Spinner } from '../ui/index.js';
import { APP_PATHS } from './paths.js';

/**
 * THE FRONT DOOR at `/`.
 *
 * A traveller who is signed in belongs on Search; anyone else belongs on Log in. While the session is
 * still being worked out nothing is decided and nothing bounces — the app simply says it is loading.
 */
export function HomeRedirect(): ReactElement {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'authenticated') {
      navigate(APP_PATHS.search);
      return;
    }
    if (status === 'anonymous') navigate(APP_PATHS.login);
  }, [status]);

  return <Spinner label="Opening Bus Booking App" />;
}
