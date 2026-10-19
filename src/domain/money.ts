import type { Currency, Money, Order } from './types';

export const RATES_TO_GBP: { asOf: string; rates: Partial<Record<Currency, number>> } = {
  asOf: '2026-10-19',
  rates: { GBP: 1, EUR: 0.87, USD: 0.79 },
};

const formatters = new Map<Currency, Intl.NumberFormat>();

export function formatMoney(money: Money): string {
  let formatter = formatters.get(money.currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-GB', { style: 'currency', currency: money.currency });
    formatters.set(money.currency, formatter);
  }
  return formatter.format(money.minor / 100);
}

export type PaidLine = {
  currency: Currency;
  count: number;
  minor: number;
  gbpMinor: number | null;
  rate: number | null;
};

export type PaidSummary = {
  paidCount: number;
  gbpApproxMinor: number;
  isApprox: boolean;
  lines: PaidLine[];
  unconverted: Currency[];
  missingTotals: number;
};

function lineOrder(a: PaidLine, b: PaidLine): number {
  if (a.currency === 'GBP') return -1;
  if (b.currency === 'GBP') return 1;
  return a.currency.localeCompare(b.currency);
}

export function summarisePaid(
  orders: readonly Order[],
  rates: Partial<Record<Currency, number>> = RATES_TO_GBP.rates,
): PaidSummary {
  const paid = orders.filter((o) => o.status.kind === 'known' && o.status.key === 'paid');
  const subtotals = new Map<Currency, { count: number; minor: number }>();
  let missingTotals = 0;
  for (const order of paid) {
    if (order.amount === null) {
      missingTotals += 1;
      continue;
    }
    const entry = subtotals.get(order.amount.currency) ?? { count: 0, minor: 0 };
    entry.count += 1;
    entry.minor += order.amount.minor;
    subtotals.set(order.amount.currency, entry);
  }

  const lines: PaidLine[] = [...subtotals].map(([currency, { count, minor }]) => {
    const rate = rates[currency] ?? null;
    return { currency, count, minor, rate, gbpMinor: rate === null ? null : Math.round(minor * rate) };
  });
  lines.sort(lineOrder);

  return {
    paidCount: paid.length,
    gbpApproxMinor: lines.reduce((sum, line) => sum + (line.gbpMinor ?? 0), 0),
    isApprox: lines.some((line) => line.currency !== 'GBP' && line.gbpMinor !== null),
    lines,
    unconverted: lines.filter((line) => line.gbpMinor === null).map((line) => line.currency),
    missingTotals,
  };
}
