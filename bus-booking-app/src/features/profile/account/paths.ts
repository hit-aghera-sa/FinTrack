/**
 * THE IN-APP ADDRESSES THE PROFILE SCREEN LINKS TO.
 *
 * Every one of these is a page the client router registers, so a button here can never land a
 * traveller on the page-not-found screen. The sign-in address is NOT listed: that one comes from
 * `LOGIN_PATH` in `src/session`, which is the single place the app states where a signed-out
 * traveller goes.
 */
export const PROFILE_SCREEN_PATHS = {
  /** This screen. */
  profile: '/profile',
  /** The change-password page, which shows the same form on its own. */
  changePassword: '/profile/change-password',
  /** Active devices and sign out everywhere. */
  activeDevices: '/profile/sessions',
  /** The account-deletion confirmation page. */
  deleteAccount: '/profile/delete-account/preview',
} as const;
