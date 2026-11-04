/**
 * THE CATALOGUE'S READ SEAM.
 *
 * `createTripRepository` holds the product rules (which trips are still on offer today, how seats-left
 * is derived, in what order a seat map is drawn) and reads rows through this interface. The Prisma /
 * PostgreSQL implementation is `createPrismaCatalogueSource`; the repository's own specs implement it
 * with fixtures, so the rules are verified without a database.
 *
 * Rows are deliberately close to what a datastore returns: real `Date` instants and the bus type
 * spelled however it is stored. Turning those into the shared domain types is the repository's job.
 */
export {};
