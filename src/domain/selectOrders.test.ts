import exportFile from '../../public/orders.json';
import { parseOrders } from './parseOrders';
import { DEFAULT_SORT, selectOrders, type Selection } from './selectOrders';
import type { Order } from './types';

const orders = parseOrders(exportFile);
const select = (overrides: Partial<Selection>) =>
  selectOrders(orders, { query: '', status: 'all', sort: DEFAULT_SORT, ...overrides }).map((o) => o.id);

describe('search', () => {
  test('"zoe" finds Zoë Müller, ignoring accents', () => {
    expect(select({ query: 'zoe' })).toEqual(['ORD-1013']);
  });

  test('"müller" with an accent also finds her', () => {
    expect(select({ query: 'MÜLLER' })).toEqual(['ORD-1013']);
  });

  test('"EXAMPLE.DE" matches emails case-insensitively', () => {
    expect(select({ query: 'EXAMPLE.DE' }).sort()).toEqual(['ORD-1002', 'ORD-1013']);
  });

  test('query is trimmed', () => {
    expect(select({ query: '  priya  ' }).sort()).toEqual(['ORD-1001', 'ORD-1012']);
  });

  test('orders with no customer record never match a non-empty query', () => {
    expect(select({ query: 'a' })).not.toContain('ORD-1004');
    expect(select({ query: '' })).toContain('ORD-1004');
  });
});

describe('status filter', () => {
  test('paid keeps only paid orders', () => {
    expect(select({ status: 'paid' })).toHaveLength(15);
  });

  test('combines with search', () => {
    expect(select({ status: 'refunded', query: 'priya' })).toEqual(['ORD-1012']);
  });

  test('unknown:<raw> selects unknown statuses by their raw text', () => {
    const extra = parseOrders({
      orders: [{ id: 'X-1', customer: null, total: 1, currency: 'GBP', status: 'disputed', created_at: 'bad', items: 1 }],
    });
    const result = selectOrders([...orders, ...extra], { query: '', status: 'unknown:disputed', sort: DEFAULT_SORT });
    expect(result.map((o) => o.id)).toEqual(['X-1']);
  });
});

describe('sorting', () => {
  test('default is date newest first, by timestamp not by id', () => {
    const ids = select({});
    expect(ids[0]).toBe('ORD-1024');
    expect(ids.indexOf('ORD-1019')).toBeLessThan(ids.indexOf('ORD-1020'));
    expect(ids.at(-1)).toBe('ORD-1001');
  });

  test('date ascending reverses chronological order', () => {
    const ids = select({ sort: { key: 'date', dir: 'asc' } });
    expect(ids.indexOf('ORD-1020')).toBeLessThan(ids.indexOf('ORD-1019'));
  });

  test('null total sorts last in both directions', () => {
    expect(select({ sort: { key: 'total', dir: 'desc' } }).at(-1)).toBe('ORD-1007');
    expect(select({ sort: { key: 'total', dir: 'asc' } }).at(-1)).toBe('ORD-1007');
  });

  test('total sorts by plain number across currencies', () => {
    expect(select({ sort: { key: 'total', dir: 'desc' } }).slice(0, 3)).toEqual(['ORD-1021', 'ORD-1005', 'ORD-1017']);
    expect(select({ sort: { key: 'total', dir: 'asc' } })[0]).toBe('ORD-1016');
  });

  test('null dates sort last in both directions and ties break by id', () => {
    const undated = (id: string): Order => ({ ...orders[0]!, id, createdAt: null });
    const list = [undated('Z-2'), undated('Z-1'), ...orders];
    for (const dir of ['asc', 'desc'] as const) {
      const ids = selectOrders(list, { query: '', status: 'all', sort: { key: 'date', dir } }).map((o) => o.id);
      expect(ids.slice(-2)).toEqual(['Z-1', 'Z-2']);
    }
  });

  test('does not mutate its input', () => {
    const before = orders.map((o) => o.id);
    select({ sort: { key: 'total', dir: 'asc' } });
    expect(orders.map((o) => o.id)).toEqual(before);
  });
});
