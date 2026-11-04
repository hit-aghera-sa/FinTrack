/**
 * PHYSICAL NAMES OF THE CATALOGUE TABLES.
 *
 * The Prisma schema and its migrations belong to the schema lane, which may map a model or a field to
 * a different physical name (`BoardingPoint` → `boarding_points`, `departureAt` → `departure_at`).
 * Rather than hard-coding one spelling, the catalogue source reads the live column list once and
 * resolves the names it needs through the helpers here.
 *
 * Pure functions over rows of `information_schema.columns` — no SQL, no client, no I/O.
 */
/** `departure_at`, `departureAt` and `DepartureAt` all normalise to `departureat`. */
export function normaliseIdentifier(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
/** The names a table may be looked up under: itself plus its singular forms (`cities` → `city`). */
export function identifierAliases(name) {
    const base = normaliseIdentifier(name);
    const aliases = new Set([base]);
    if (base.endsWith('ies'))
        aliases.add(`${base.slice(0, -3)}y`);
    if (base.endsWith('es'))
        aliases.add(base.slice(0, -2));
    if (base.endsWith('s'))
        aliases.add(base.slice(0, -1));
    return [...aliases];
}
export function buildSchemaMap(rows) {
    const columnsByTable = new Map();
    const order = [];
    for (const row of rows) {
        let columns = columnsByTable.get(row.table);
        if (columns === undefined) {
            columns = new Map();
            columnsByTable.set(row.table, columns);
            order.push(row.table);
        }
        columns.set(normaliseIdentifier(row.column), row.column);
    }
    const map = new Map();
    const tables = order.map((name) => ({
        name,
        columns: columnsByTable.get(name) ?? new Map(),
    }));
    // Exact names first, so an alias never shadows a table that really carries that name.
    for (const table of tables) {
        const key = normaliseIdentifier(table.name);
        if (!map.has(key))
            map.set(key, table);
    }
    for (const table of tables) {
        for (const alias of identifierAliases(table.name)) {
            if (!map.has(alias))
                map.set(alias, table);
        }
    }
    return map;
}
export function findTable(map, candidates) {
    for (const candidate of candidates) {
        const table = map.get(normaliseIdentifier(candidate));
        if (table !== undefined)
            return table;
    }
    return null;
}
export function requireTable(map, candidates, context) {
    const table = findTable(map, candidates);
    if (table === null) {
        throw new Error(`Bus Booking App catalogue: no table found for ${context} (looked for ${candidates.join(', ')}).`);
    }
    return table;
}
export function findColumn(table, candidates) {
    for (const candidate of candidates) {
        const column = table.columns.get(normaliseIdentifier(candidate));
        if (column !== undefined)
            return column;
    }
    return null;
}
export function requireColumn(table, candidates, context) {
    const column = findColumn(table, candidates);
    if (column === null) {
        throw new Error(`Bus Booking App catalogue: table "${table.name}" has no column for ${context} ` +
            `(looked for ${candidates.join(', ')}).`);
    }
    return column;
}
/** A safely quoted SQL identifier, so a reserved word such as `row` or `column` is still usable. */
export function quoteIdentifier(name) {
    return `"${name.replace(/"/g, '""')}"`;
}
