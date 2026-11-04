/**
 * THE APP'S FORMATTING STYLE GUIDE, as functions.
 *
 * Every screen renders fares, dates and times through this module so the whole product reads the same
 * way: whole rupees with the ₹ symbol (`₹1,250`), dates as DD/MM/YYYY, times 12-hour with AM/PM
 * (`9:30 PM`), and all business times in India time.
 *
 * Pure functions and constants only — no React, no fetching, no state.
 */
export { formatINR, RUPEE_SIGN } from './currency.js';
export { formatDate, formatDateTime, formatTime, istPartsOf, IST_OFFSET_MINUTES, IST_TIME_ZONE, } from './datetime.js';
