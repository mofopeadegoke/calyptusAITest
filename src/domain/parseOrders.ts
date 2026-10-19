import { isStatusKey } from './status';
import type { Customer, DataIssue, Money, Order, Status } from './types';

export class OrdersFormatError extends Error {
  override name = 'OrdersFormatError';
}

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const DECIMAL = /^(-?)(\d+)(?:\.(\d+))?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const ISO_WITH_OFFSET = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// Assumes 2-decimal currencies (GBP, EUR, USD); see README limitations.
// Works on the decimal text so 1.005 rounds to 101, not to 100 as 1.005 * 100 does.
function toMinor(raw: number | string, issues: DataIssue[]): number {
  const match = DECIMAL.exec(typeof raw === 'number' ? String(raw) : raw);
  // String(number) only falls outside DECIMAL for exponent forms like 1e21.
  if (!match) return Math.round(Number(raw) * 100);
  const [, sign, whole = '0', fraction = ''] = match;
  const roundUp = fraction.charAt(2) >= '5';
  const magnitude = Number(whole) * 100 + Number(fraction.slice(0, 2).padEnd(2, '0')) + (roundUp ? 1 : 0);
  const minor = sign && magnitude !== 0 ? -magnitude : magnitude;
  if (!/^0*$/.test(fraction.slice(2))) {
    issues.push({
      severity: 'defect',
      field: 'total',
      message: `Total had more than 2 decimal places; rounded to ${(minor / 100).toFixed(2)}`,
    });
  }
  return minor;
}

function parseTotal(raw: unknown, issues: DataIssue[]): number | null {
  let minor: number | null = null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    minor = toMinor(raw, issues);
  } else if (typeof raw === 'string' && DECIMAL.test(raw.trim())) {
    minor = toMinor(raw.trim(), issues);
    issues.push({
      severity: 'defect',
      field: 'total',
      message: `Total was text in the export; read as ${(minor / 100).toFixed(2)}`,
    });
  }
  if (minor !== null) {
    if (minor < 0) issues.push({ severity: 'defect', field: 'total', message: 'Negative total in export' });
    return minor;
  }
  if (raw === null || raw === undefined) {
    issues.push({ severity: 'defect', field: 'total', message: 'Total missing in export' });
  } else {
    issues.push({ severity: 'defect', field: 'total', message: `Total “${String(raw)}” in export is not a number` });
  }
  return null;
}

function parseCurrency(raw: unknown, issues: DataIssue[]): string | null {
  if (typeof raw === 'string' && CURRENCY_CODE.test(raw)) return raw;
  issues.push({ severity: 'defect', field: 'currency', message: 'Currency missing or unreadable in export' });
  return null;
}

function parseAmount(row: RawRecord, issues: DataIssue[]): Money | null {
  const minor = parseTotal(row.total, issues);
  const currency = parseCurrency(row.currency, issues);
  if (minor === null || currency === null) return null;
  return { minor, currency };
}

function parseText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

function parseCustomer(raw: unknown, issues: DataIssue[]): Customer {
  if (!isRecord(raw)) {
    issues.push({ severity: 'defect', field: 'customer', message: 'No customer record' });
    return null;
  }
  const name = parseText(raw.name);
  if (name === null) issues.push({ severity: 'defect', field: 'name', message: 'Name blank in export' });
  const email = parseText(raw.email);
  if (email === null) issues.push({ severity: 'defect', field: 'customer', message: 'Email blank in export' });
  return { name, email };
}

function parseStatus(raw: unknown, issues: DataIssue[]): Status {
  const shown = typeof raw === 'string' ? raw.trim() : '';
  const text = shown.toLowerCase();
  if (isStatusKey(text)) return { kind: 'known', key: text };
  issues.push({
    severity: 'defect',
    field: 'status',
    message: text === '' ? 'Status missing in export' : `Status “${shown}” is not one the dashboard knows`,
  });
  // Lower-cased so "Shipped" and "shipped" group together, as known statuses do.
  return { kind: 'unknown', raw: text };
}

// new Date() rolls impossible dates over (2026-02-31 becomes 3 March), so check the fields first.
function isRealDateTime(match: RegExpExecArray): boolean {
  const field = (group: number) => Number(match[group] ?? 0);
  const month = field(2);
  const day = field(3);
  const daysInMonth = new Date(Date.UTC(field(1), month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && field(4) <= 23 && field(5) <= 59 && field(6) <= 59;
}

function parseCreatedAt(
  raw: unknown,
  issues: DataIssue[],
): { createdAt: Date | null; sourceOffset: string | null } {
  if (typeof raw === 'string') {
    const match = ISO_WITH_OFFSET.exec(raw.trim());
    const date = new Date(raw.trim());
    if (match && isRealDateTime(match) && !Number.isNaN(date.getTime())) {
      const offset = match[7] ?? 'Z';
      return { createdAt: date, sourceOffset: offset === 'Z' ? '+00:00' : offset };
    }
  }
  issues.push({ severity: 'defect', field: 'created_at', message: 'Order time missing or unreadable in export' });
  return { createdAt: null, sourceOffset: null };
}

function parseItems(raw: unknown, issues: DataIssue[]): number | null {
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return raw;
  issues.push({ severity: 'defect', field: 'items', message: 'Item count missing or invalid in export' });
  return null;
}

function parseId(raw: unknown, index: number, issues: DataIssue[]): string {
  if (typeof raw === 'string' && raw.trim() !== '') return raw.trim();
  if (typeof raw === 'number' && Number.isSafeInteger(raw)) {
    issues.push({ severity: 'defect', field: 'id', message: 'Order ID was a number in the export' });
    return String(raw);
  }
  const problem = raw === undefined || raw === null || typeof raw === 'string' ? 'has no order ID' : 'has an unreadable order ID';
  throw new OrdersFormatError(`Order ${index + 1} in the export ${problem}.`);
}

function parseOrder(row: unknown, index: number): Order {
  if (!isRecord(row)) throw new OrdersFormatError(`Order ${index + 1} in the export is not an order record.`);
  const issues: DataIssue[] = [];
  const id = parseId(row.id, index, issues);
  const customer = parseCustomer(row.customer, issues);
  const amount = parseAmount(row, issues);
  const status = parseStatus(row.status, issues);
  if (amount?.minor === 0 && status.kind === 'known' && status.key === 'paid') {
    issues.push({ severity: 'note', field: 'total', message: 'Paid order with a zero total' });
  }
  const { createdAt, sourceOffset } = parseCreatedAt(row.created_at, issues);
  const items = parseItems(row.items, issues);
  return { id, key: id, customer, amount, status, createdAt, sourceOffset, items, issues };
}

// Repeats stay visible and flagged; each gets a unique key for React rows and sorting.
function flagRepeatedIds(orders: Order[]): void {
  const groups = new Map<string, Order[]>();
  for (const order of orders) {
    const group = groups.get(order.id);
    if (group) group.push(order);
    else groups.set(order.id, [order]);
  }
  for (const group of groups.values()) {
    if (group.length === 1) continue;
    group.forEach((order, i) => {
      if (i > 0) order.key = `${order.id}#${i + 1}`;
      order.issues.push({ severity: 'defect', field: 'id', message: `Order ID appears ${group.length} times in the export` });
    });
  }
}

export function parseOrders(raw: unknown): Order[] {
  if (!isRecord(raw) || !Array.isArray(raw.orders)) {
    throw new OrdersFormatError('The export is not in the expected format (an "orders" list).');
  }
  const orders = raw.orders.map(parseOrder);
  flagRepeatedIds(orders);
  return orders;
}
