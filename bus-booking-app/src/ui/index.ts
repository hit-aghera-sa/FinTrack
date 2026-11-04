/**
 * THE SHARED UI KIT — one barrel for every screen in the Bus Booking App.
 *
 * Presentation only: no data fetching, no API calls, no domain rules. Colours, spacing and type come
 * from `theme`, which points at the project's approved CSS variables.
 *
 * `EmptyState` is the app's existing shared empty state, re-exported here so a screen can take the
 * whole kit from one place without a second copy of it existing anywhere.
 */
export { theme, seatStateToken, SEAT_STATES } from './tokens';
export type {
  Theme,
  ColourTokens,
  SpaceTokens,
  RadiusTokens,
  TypographyTokens,
  SeatState,
  SeatStateToken,
} from './tokens';

export { Button } from './Button';
export type { ButtonProps } from './Button';

export { TextField } from './TextField';
export type { TextFieldProps } from './TextField';

export { SelectField } from './SelectField';
export type { SelectFieldProps, SelectOption } from './SelectField';

export { Alert } from './Alert';
export type { AlertProps, AlertKind } from './Alert';

export { Tabs } from './Tabs';
export type { TabsProps, TabDescriptor } from './Tabs';

export { ConfirmDialog } from './ConfirmDialog';
export type { ConfirmDialogProps } from './ConfirmDialog';

export { Card } from './Card';
export type { CardProps } from './Card';

export { Spinner } from './Spinner';
export type { SpinnerProps } from './Spinner';

export { EmptyState } from '../components/EmptyState';
export type { EmptyStateProps } from '../components/EmptyState';
