import type { ReactElement, ReactNode } from 'react';

/** One column of a table: its heading and how to draw its cell for a row. */
export interface DataTableColumn<Row> {
  /** Unique within the table; used as the React key. */
  key: string;
  /** The column heading. */
  header: string;
  /** Draws the cell: text, a `<Link>`, a `<Badge>`, row action buttons. */
  cell: (row: Row) => ReactNode;
  /** "right" for figures, so they line up. Defaults to left. */
  align?: 'left' | 'right';
}

export interface DataTableProps<Row> {
  /** Names the table; shown above it and read out by assistive technology. */
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  /** A stable, unique key for a row - usually its id. */
  rowKey: (row: Row) => string;
  /** Shown instead of rows when there are none. */
  emptyMessage?: string;
}

/**
 * Lists ANY kind of record. The page describes its columns; this draws them, with a caption, column
 * headers a screen reader can follow, and a message when there is nothing to list.
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  emptyMessage = 'Nothing to show yet.',
}: DataTableProps<Row>): ReactElement {
  return (
    <div className="table-card">
      <table className="data-table">
        <caption>{caption}</caption>
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
          {rows.length === 0 ? (
            <tr>
              <td className="table-empty" colSpan={columns.length}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.key} className={column.align === 'right' ? 'is-numeric' : undefined}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
