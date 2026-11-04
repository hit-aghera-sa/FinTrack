/**
 * Mock data for the starter. Replace with a real client — the exported TYPES are the contract the
 * components depend on, so a service swap should keep these shapes.
 */
export interface Metric {
  label: string;
  value: number;
  delta: number;
  unit: 'count' | 'currency';
}

export interface Order {
  reference: string;
  customer: string;
  status: 'paid' | 'pending' | 'refunded';
  total: number;
}

export const METRICS: Metric[] = [
  { label: 'Revenue', value: 48250, delta: 12.4, unit: 'currency' },
  { label: 'Orders', value: 1284, delta: 4.1, unit: 'count' },
  { label: 'Customers', value: 892, delta: -1.8, unit: 'count' },
];

export const RECENT_ORDERS: Order[] = [
  { reference: 'AC-1043', customer: 'Rivera Logistics', status: 'paid', total: 1240.5 },
  { reference: 'AC-1042', customer: 'Northwind Retail', status: 'pending', total: 480.0 },
  { reference: 'AC-1041', customer: 'Bluepeak Studio', status: 'paid', total: 2310.75 },
  { reference: 'AC-1040', customer: 'Harbor Foods', status: 'refunded', total: 96.2 },
  { reference: 'AC-1039', customer: 'Sterling Group', status: 'paid', total: 755.0 },
];
