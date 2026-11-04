/**
 * THE FOUR BUS TYPES, and the one approved way to read and write them.
 *
 * The datastore and the internal admin tool may spell a type as `AC Sleeper`, `AC_SLEEPER` or
 * `ac-sleeper`; the app works with the enum and shows the label. Parsing happens here so no lane
 * invents its own mapping.
 */
export const BUS_TYPES = ['AC_SEATER', 'AC_SLEEPER', 'NON_AC_SEATER', 'NON_AC_SLEEPER'];
/** What a traveller reads on screen for each type. */
export const BUS_TYPE_LABELS = {
    AC_SEATER: 'AC Seater',
    AC_SLEEPER: 'AC Sleeper',
    NON_AC_SEATER: 'Non-AC Seater',
    NON_AC_SLEEPER: 'Non-AC Sleeper',
};
/**
 * The type used when a stored value cannot be recognised at all. The plainest bus, so a mis-spelled
 * record is never advertised as something more comfortable than it is.
 */
export const DEFAULT_BUS_TYPE = 'NON_AC_SEATER';
/** Every recognised spelling, reduced to letters only. */
const COMPACT_BUS_TYPES = {
    ACSEATER: 'AC_SEATER',
    ACSLEEPER: 'AC_SLEEPER',
    NONACSEATER: 'NON_AC_SEATER',
    NONACSLEEPER: 'NON_AC_SLEEPER',
};
export function isBusType(value) {
    return typeof value === 'string' && BUS_TYPES.includes(value);
}
/**
 * The enum for any reasonable spelling of a bus type (`AC Sleeper`, `ac_sleeper`, `Non-AC Seater`),
 * or null when the text names none of the four.
 */
export function parseBusType(value) {
    if (typeof value !== 'string')
        return null;
    const compact = value.toUpperCase().replace(/[^A-Z]/g, '');
    return COMPACT_BUS_TYPES[compact] ?? null;
}
/** The label a traveller reads for a bus type. */
export function busTypeLabel(type) {
    return BUS_TYPE_LABELS[type];
}
