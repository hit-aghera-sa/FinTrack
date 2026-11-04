// src/features/my-bookings/list/HomePage.tsx
//
// THE BEHAVIOUR OF /. This file is YOURS to write.
//
// `HomeScreen` beside it is the look the client approved and is FIXED — a write to it is
// discarded. Everything else belongs here:
//
//   • fetch the real data and pass it to the screen
//   • while it loads, render whatever this project uses for loading
//   • when there is nothing to show, render an empty state
//   • when it fails, render an error — and keep the normal view for when it does not
//
// Use the stylesheet's existing classes for those extra states. Never a colour of your own: the
// approved palette is the only one, and a literal colour here is refused.
//
// If this screen needs a layout the approved preview does not have, say so in your report rather than
// rearranging the screen — what the client signed off is not yours to change.
import { useCallback, useEffect, type MouseEvent } from 'react';
import { navigate } from '../../../router';
import { useSession } from '../../../session/index.js';
import { Spinner } from '../../../ui/index.js';
import { APP_PATHS } from '../../../shell/paths.js';
import HomeScreen from './HomeScreen';

/**
 * THE FRONT DOOR at `/` — the approved home screen itself, not a bounce to another page: a traveller
 * who opens the app's address sees the welcome and its "Search buses" button. While the session is
 * still being read there is the app's loading state, and someone signed out goes to Log in.
 *
 * The approved markup moves on with `data-goto="/search"` on its button, so the click is handled here
 * (the screen's own markup is not ours to change) and routed through the app's own navigation.
 */
export function HomePage(): JSX.Element {
  const { status } = useSession();

  useEffect(() => {
    if (status === 'anonymous') navigate(APP_PATHS.login, { replace: true });
  }, [status]);

  const handleClick = useCallback((event: MouseEvent<HTMLDivElement>): void => {
    const origin = event.target instanceof Element ? event.target.closest('[data-goto]') : null;
    const to = origin?.getAttribute('data-goto') ?? '';
    if (!to.startsWith('/')) return;
    event.preventDefault();
    navigate(to);
  }, []);

  if (status !== 'authenticated') return <Spinner label="Opening Bus Booking App" />;

  return (
    <div onClick={handleClick}>
      <HomeScreen />
    </div>
  );
}

export default HomePage;
