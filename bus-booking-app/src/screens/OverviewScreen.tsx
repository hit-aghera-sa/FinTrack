import { useMemo, useState, type ReactElement } from 'react';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { MetricCard } from '../components/MetricCard';
import { METRICS, RECENT_ORDERS, type Metric, type Order } from '../data/dashboardData';

const STATUS_LABEL: Record<Order['status'], string> = {
  paid: 'Paid',
  pending: 'Pending',
  refunded: 'Refunded',
};

/** The columns of the orders table. A screen describes its columns; `DataTable` draws them. */
const ORDER_COLUMNS: readonly DataTableColumn<Order>[] = [
  { key: 'reference', header: 'Reference', cell: (order) => order.reference },
  { key: 'customer', header: 'Customer', cell: (order) => order.customer },
  {
    key: 'status',
    header: 'Status',
    cell: (order) => <span className={'status status-' + order.status}>{STATUS_LABEL[order.status]}</span>,
  },
  { key: 'total', header: 'Total', align: 'right', cell: (order) => '$' + order.total.toFixed(2) },
];

function formatMetric(metric: Metric): string {
  const figure = new Intl.NumberFormat('en', {
    notation: metric.value >= 10000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(metric.value);
  return (metric.unit === 'currency' ? '$' : '') + figure;
}

/**
 * THE STARTER'S SAMPLE PAGE — it shows how a page is put together, and is not part of a real app.
 *
 * The pattern every page follows: the page owns its data and its filter state, and builds its layout
 * from the shared pieces — `MetricCard` for figures, `DataTable` for lists, `.screen-toolbar` for
 * controls. The heading comes from the page list, so a page does not draw its own.
 */
export function OverviewScreen(): ReactElement {
  const [query, setQuery] = useState('');

  const visibleOrders = useMemo<Order[]>(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '') return RECENT_ORDERS;
    return RECENT_ORDERS.filter(
      (order) =>
        order.customer.toLowerCase().includes(needle) || order.reference.toLowerCase().includes(needle),
    );
  }, [query]);

  return (
    <>
      <section className="metric-grid" aria-label="Key metrics">
        {METRICS.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={formatMetric(metric)}
            hint={(metric.delta >= 0 ? '▲ ' : '▼ ') + Math.abs(metric.delta) + '% vs last period'}
            trend={metric.delta >= 0 ? 'up' : 'down'}
          />
        ))}
      </section>

      <div className="screen-toolbar">
        <input
          className="app-search"
          type="search"
          value={query}
          placeholder="Search orders"
          aria-label="Search orders"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <DataTable
        caption="Recent orders"
        columns={ORDER_COLUMNS}
        rows={visibleOrders}
        rowKey={(order) => order.reference}
        emptyMessage="No orders match that search."
      />
    </>
  );
}
