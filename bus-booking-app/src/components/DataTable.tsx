import type { ReactElement, ReactNode } from 'react';

/** One column: its header text and how to draw a row's cell. */
export interface DataTableColumn<Row> {
  /** Stable key for React; also handy as a test hook. */
  key: string;
  /** Visible column header. */
  header: string;
  /** What to show for this column in one row. */
  cell: (row: Row) => ReactNode;
  /** Numbers read best right-aligned. Default `left`. */
  align?: 'left' | 'right';
}

export interface DataTableProps<Row> {
  /** What the table lists — read to screen-reader users, not drawn. */
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** A unique, stable id for a row. */
  rowKey: (row: Row) => string;
  /** Shown INSTEAD of the table when there are no rows. */
  emptyMessage?: string;
}

/**
 * The app's one table, for ANY list of records — people, orders, offices.
 *
 * Generic on purpose. It used to accept only `orders`, with its four column headers written into the
 * markup, so a screen listing anything else could not use it and every app grew a second table beside
 * it. Describe the columns, hand over the rows, and this draws them in the template's style.
 *
 * With no rows it renders the empty message rather than an empty table body.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing to show.',
}: DataTableProps<Row>): ReactElement {
  if (rows.length === 0) {
    return (
      <section className="table-card">
        <p className="table-empty">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="table-card">
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.align === 'right' ? 'is-numeric' : undefined}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.key} className={column.align === 'right' ? 'is-numeric' : undefined}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
