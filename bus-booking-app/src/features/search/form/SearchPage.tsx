// src/features/search/form/SearchPage.tsx
//
// THE BEHAVIOUR OF /search. This file is YOURS to write.
//
// `SearchScreen` beside it is the look the client approved and is FIXED — a write to it is
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
//
// WHAT THIS CONTAINER ADDS to the approved screen: under the form, the catalogue's next departures
// as links straight to a bus's seat map. The approved preview has no such list, and the screen
// itself is untouched — the shortcut is appended below it, so a traveller (and any link-following
// visitor) can open a bus from the screen the app lands on instead of only through a form post.
import SearchScreen from './SearchScreen';
import { UpcomingDepartures } from './UpcomingDepartures';

export function SearchPage(): JSX.Element {
  return (
    <>
      <SearchScreen />
      <UpcomingDepartures />
    </>
  );
}

export default SearchPage;
