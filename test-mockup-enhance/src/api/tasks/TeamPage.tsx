// src/api/tasks/TeamPage.tsx
//
// THE BEHAVIOUR OF /team. This file is YOURS to write.
//
// `TeamScreen` beside it is the look the client approved and is FIXED — a write to it is
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
import TeamScreen from './TeamScreen';

export default function TeamPage(): JSX.Element {
  return <TeamScreen />;
}
