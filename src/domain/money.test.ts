import exportFile from '../../public/orders.json';
import { formatMoney, summarisePaid } from './money';
import { parseOrders } from './parseOrders';
import type { Order } from './types';

describe('formatMoney', () => {
  test.each([
    [{ minor: 154200, currency: 'GBP' }, '£1,542.00'],
    [{ minor: 166340, currency: 'EUR' }, '€1,663.40'],
    [{ minor: 179899, currency: 'USD' }, 'US$1,798.99'],
    [{ minor: 0, currency: 'GBP' }, '£0.00'],
  ])('%j formats as %s', (money, expected) => {
    expect(formatMoney(money)).toBe(expected);
  });
});

describe('summarisePaid on the real export', () => {
  const summary = summarisePaid(parseOrders(exportFile));

  test('exact per-currency subtotals, each converted once', () => {
    expect(summary.lines).toEqual([
      { currency: 'GBP', count: 6, minor: 154200, rate: 1, gbpMinor: 154200 },
      { currency: 'EUR', count: 6, minor: 166340, rate: 0.87, gbpMinor: 144716 },
      { currency: 'USD', count: 3, minor: 179899, rate: 0.79, gbpMinor: 142120 },
    ]);
  });

  test('headline is the sum of the converted subtotals', () => {
    expect(summary.gbpApproxMinor).toBe(441036);
    expect(formatMoney({ minor: summary.gbpApproxMinor, currency: 'GBP' })).toBe('£4,410.36');
    expect(summary.isApprox).toBe(true);
    expect(summary.paidCount).toBe(15);
    expect(summary.unconverted).toEqual([]);
    expect(summary.missingTotals).toBe(0);
  });
});

describe('summarisePaid edge cases', () => {
  let next = 0;
  const order = (overrides: Partial<Order>): Order => ({
    id: `X-${++next}`,
    key: `X-${next}`,
    customer: null,
    amount: { minor: 1000, currency: 'GBP' },
    status: { kind: 'known', key: 'paid' },
    createdAt: null,
    sourceOffset: null,
    items: 1,
    issues: [],
    ...overrides,
  });

  test('a currency with no rate is left unconverted and out of the headline', () => {
    const summary = summarisePaid([
      order({ amount: { minor: 1000, currency: 'GBP' } }),
      order({ amount: { minor: 5000, currency: 'JPY' } }),
    ]);
    expect(summary.gbpApproxMinor).toBe(1000);
    expect(summary.unconverted).toEqual(['JPY']);
    expect(summary.lines.find((l) => l.currency === 'JPY')).toMatchObject({ gbpMinor: null, minor: 5000 });
  });

  test('paid orders without a total are counted apart, not summed', () => {
    const summary = summarisePaid([order({}), order({ amount: null })]);
    expect(summary.missingTotals).toBe(1);
    expect(summary.paidCount).toBe(2);
    expect(summary.gbpApproxMinor).toBe(1000);
  });

  test('paid orders with a negative total are counted apart, not summed', () => {
    const summary = summarisePaid([order({}), order({ amount: { minor: -12900, currency: 'GBP' } })]);
    expect(summary.negativeTotals).toBe(1);
    expect(summary.gbpApproxMinor).toBe(1000);
  });

  test('a repeated order ID is summed once', () => {
    const first = order({});
    const summary = summarisePaid([first, { ...first, key: `${first.key}#2` }]);
    expect(summary.repeatedIds).toBe(1);
    expect(summary.paidCount).toBe(1);
    expect(summary.gbpApproxMinor).toBe(1000);
  });

  test('non-paid orders are ignored and GBP alone is exact', () => {
    const summary = summarisePaid([order({}), order({ status: { kind: 'known', key: 'refunded' } })]);
    expect(summary.paidCount).toBe(1);
    expect(summary.isApprox).toBe(false);
  });
});
