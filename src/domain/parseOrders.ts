import { STATUS_KEYS } from './types';
import type { Customer, DataIssue, Money, Order, Status, StatusKey } from './types';

export class OrdersFormatError extends Error {
  override name = 'OrdersFormatError';
}

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStatusKey(value: string): value is StatusKey {
  return (STATUS_KEYS as readonly string[]).includes(value);
}

const NUMERIC_TEXT = /^-?\d+(\.\d+)?$/;
const CURRENCY_CODE = /^[A-Z]{3}$/;
const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function parseTotal(raw: unknown, issues: DataIssue[]): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && NUMERIC_TEXT.test(raw.trim())) {
    const value = Number(raw.trim());
    issues.push({ severity: 'defect', field: 'total', message: `Total was text in the export; read as ${value.toFixed(2)}` });
    return value;
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
  const total = parseTotal(row.total, issues);
  const currency = parseCurrency(row.currency, issues);
  if (total === null || currency === null) return null;
  // Assumes 2-decimal currencies (GBP, EUR, USD); see README limitations.
  return { minor: Math.round(total * 100), currency };
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
  const text = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (isStatusKey(text)) return { kind: 'known', key: text };
  const shown = typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : 'missing';
  issues.push({ severity: 'defect', field: 'status', message: `Status “${shown}” is not one the dashboard knows` });
  return { kind: 'unknown', raw: shown };
}

function parseCreatedAt(
  raw: unknown,
  issues: DataIssue[],
): { createdAt: Date | null; sourceOffset: string | null } {
  if (typeof raw === 'string') {
    const match = ISO_WITH_OFFSET.exec(raw.trim());
    const date = new Date(raw.trim());
    if (match && !Number.isNaN(date.getTime())) {
      const offset = match[3] ?? 'Z';
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

function parseOrder(row: unknown, index: number): Order {
  if (!isRecord(row) || typeof row.id !== 'string' || row.id.trim() === '') {
    throw new OrdersFormatError(`Order ${index + 1} in the export has no order ID.`);
  }
  const issues: DataIssue[] = [];
  const customer = parseCustomer(row.customer, issues);
  const amount = parseAmount(row, issues);
  const status = parseStatus(row.status, issues);
  if (amount?.minor === 0 && status.kind === 'known' && status.key === 'paid') {
    issues.push({ severity: 'note', field: 'total', message: 'Paid order with a zero total' });
  }
  const { createdAt, sourceOffset } = parseCreatedAt(row.created_at, issues);
  const items = parseItems(row.items, issues);
  return { id: row.id.trim(), customer, amount, status, createdAt, sourceOffset, items, issues };
}

export function parseOrders(raw: unknown): Order[] {
  if (!isRecord(raw) || !Array.isArray(raw.orders)) {
    throw new OrdersFormatError('The export is not in the expected format (an "orders" list).');
  }
  return raw.orders.map(parseOrder);
}
