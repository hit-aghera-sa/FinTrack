/**
 * THE PASSENGER GENDER VALUE, declared once.
 *
 * The app stores and sends the three upper-case values; `parseGender` accepts the spellings a
 * datastore or a seed may hold (`Male`, `male`, `M`) so a read never fails on a case difference.
 */
export const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
/** How each value is shown to a traveller. */
export const GENDER_LABELS = {
    MALE: 'Male',
    FEMALE: 'Female',
    OTHER: 'Other',
};
export function isGender(value) {
    return typeof value === 'string' && GENDERS.includes(value);
}
/** `Male`, `male`, `M`, `MALE` → `MALE`. Anything unrecognised is null. */
export function parseGender(value) {
    if (typeof value !== 'string')
        return null;
    const text = value.trim().toUpperCase();
    if (text === 'M' || text === 'MALE')
        return 'MALE';
    if (text === 'F' || text === 'FEMALE')
        return 'FEMALE';
    if (text === 'O' || text === 'OTHER')
        return 'OTHER';
    return null;
}
export function genderLabel(gender) {
    return GENDER_LABELS[gender];
}
