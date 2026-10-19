import exportFile from '../../public/orders.json';
import { OrdersFormatError, parseOrders } from './parseOrders';
import type { Order } from './types';

const orders = parseOrders(exportFile);

function byId(id: string): Order {
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`fixture has no ${id}`);
  return order;
}

function messages(order: Order): string[] {
  return order.issues.map((issue) => issue.message);
}

describe('parseOrders on the real export', () => {
  test('reads all 24 orders', () => {
    expect(orders).toHaveLength(24);
  });

  test('a clean row has no issues and exact minor units', () => {
    const order = byId('ORD-1002');
    expect(order.amount).toEqual({ minor: 8990, currency: 'EUR' });
    expect(order.status).toEqual({ kind: 'known', key: 'paid' });
    expect(order.createdAt?.toISOString()).toBe('2026-10-01T21:40:00.000Z');
    expect(order.sourceOffset).toBe('+02:00');
    expect(order.items).toBe(1);
    expect(order.issues).toEqual([]);
  });

  test('Z timestamps record a +00:00 source offset', () => {
    expect(byId('ORD-1001').sourceOffset).toBe('+00:00');
  });

  test('ORD-1004 null customer becomes no customer record', () => {
    const order = byId('ORD-1004');
    expect(order.customer).toBeNull();
    expect(order.issues).toEqual([{ severity: 'defect', field: 'customer', message: 'No customer record' }]);
  });

  test('ORD-1005 very long name is kept whole with no issue', () => {
    const order = byId('ORD-1005');
    expect(order.customer?.name).toBe(
      'The Very Long Company Name Trading As Northern Hospitality Group Holdings Limited',
    );
    expect(order.issues).toEqual([]);
  });

  test('ORD-1006 text total is read as a number and flagged', () => {
    const order = byId('ORD-1006');
    expect(order.amount).toEqual({ minor: 14950, currency: 'EUR' });
    expect(messages(order)).toEqual(['Total was text in the export; read as 149.50']);
  });

  test('ORD-1007 null total becomes unavailable and flagged', () => {
    const order = byId('ORD-1007');
    expect(order.amount).toBeNull();
    expect(messages(order)).toEqual(['Total missing in export']);
  });

  test('ORD-1014 blank name becomes null and flagged, email kept', () => {
    const order = byId('ORD-1014');
    expect(order.customer).toEqual({ name: null, email: 'no-name@example.com' });
    expect(order.issues).toEqual([{ severity: 'defect', field: 'name', message: 'Name blank in export' }]);
  });

  test('ORD-1016 zero paid total stays a valid amount with an informational issue', () => {
    const order = byId('ORD-1016');
    expect(order.amount).toEqual({ minor: 0, currency: 'GBP' });
    expect(messages(order)).toEqual(['Paid order with a zero total']);
    expect(order.issues[0]?.severity).toBe('note');
  });

  test('only the known defect rows carry issues', () => {
    const flagged = orders.filter((o) => o.issues.length > 0).map((o) => o.id);
    expect(flagged).toEqual(['ORD-1004', 'ORD-1006', 'ORD-1007', 'ORD-1014', 'ORD-1016']);
  });
});

describe('parseOrders on synthetic defects', () => {
  const base = {
    id: 'X-1',
    customer: { name: 'A', email: 'a@example.com' },
    total: 10,
    currency: 'GBP',
    status: 'paid',
    created_at: '2026-10-01T09:15:00Z',
    items: 1,
  };
  const one = (overrides: Record<string, unknown>): Order => {
    const [order] = parseOrders({ orders: [{ ...base, ...overrides }] });
    if (!order) throw new Error('expected one order');
    return order;
  };

  test('unknown status passes through with its raw text', () => {
    const order = one({ status: 'disputed' });
    expect(order.status).toEqual({ kind: 'unknown', raw: 'disputed' });
    expect(order.issues.map((i) => i.field)).toEqual(['status']);
  });

  test('unparseable timestamp becomes null', () => {
    const order = one({ created_at: 'yesterday' });
    expect(order.createdAt).toBeNull();
    expect(order.sourceOffset).toBeNull();
    expect(order.issues.map((i) => i.field)).toEqual(['created_at']);
  });

  test('timestamp without a UTC offset is not guessed', () => {
    expect(one({ created_at: '2026-10-01T09:15:00' }).createdAt).toBeNull();
  });

  test.each([2.5, -1, '3', null])('item count %j becomes null', (items) => {
    const order = one({ items });
    expect(order.items).toBeNull();
    expect(order.issues.map((i) => i.field)).toEqual(['items']);
  });

  test('non-numeric text total is unavailable', () => {
    const order = one({ total: 'abc' });
    expect(order.amount).toBeNull();
    expect(order.issues.map((i) => i.field)).toEqual(['total']);
  });

  test('missing currency makes the amount unavailable', () => {
    const order = one({ currency: undefined });
    expect(order.amount).toBeNull();
    expect(order.issues.map((i) => i.field)).toEqual(['currency']);
  });

  test('money rounds to integer minor units', () => {
    expect(one({ total: 0.1 + 0.2 }).amount?.minor).toBe(30);
  });

  test.each([
    [1.005, 101],
    ['0.285', 29],
    [-1.005, -101],
  ])('total %j rounds half up to %i minor units', (total, minor) => {
    expect(one({ total }).amount?.minor).toBe(minor);
  });

  test('more than 2 decimals is flagged', () => {
    expect(messages(one({ total: 10.999 }))).toEqual(['Total had more than 2 decimal places; rounded to 11.00']);
  });

  test('trailing zeros past 2 decimals are not flagged', () => {
    expect(one({ total: '10.500' }).issues.map((i) => i.message)).toEqual(['Total was text in the export; read as 10.50']);
  });

  test.each([-129, '-129.00'])('negative total %j is kept and flagged', (total) => {
    const order = one({ total });
    expect(order.amount?.minor).toBe(-12900);
    expect(messages(order)).toContain('Negative total in export');
  });

  test.each(['2026-02-31T10:00:00Z', '2026-13-01T10:00:00Z', '2026-10-01T24:00:00Z', '2026-10-01T10:60:00Z'])(
    'impossible timestamp %s becomes null',
    (created_at) => {
      const order = one({ created_at });
      expect(order.createdAt).toBeNull();
      expect(order.issues.map((i) => i.field)).toEqual(['created_at']);
    },
  );

  test('29 February in a leap year is accepted', () => {
    expect(one({ created_at: '2028-02-29T10:00:00Z' }).createdAt?.toISOString()).toBe('2028-02-29T10:00:00.000Z');
  });

  test('missing status does not collide with a literal "missing" status', () => {
    expect(one({ status: null }).status).toEqual({ kind: 'unknown', raw: '' });
    expect(messages(one({ status: null }))).toEqual(['Status missing in export']);
    expect(one({ status: 'missing' }).status).toEqual({ kind: 'unknown', raw: 'missing' });
  });

  test('unknown statuses group case-insensitively', () => {
    expect(one({ status: 'Shipped' }).status).toEqual(one({ status: 'shipped' }).status);
    expect(messages(one({ status: 'Shipped' }))).toEqual(['Status “Shipped” is not one the dashboard knows']);
  });

  test('a numeric order ID is read as text and flagged', () => {
    const order = one({ id: 1025 });
    expect(order.id).toBe('1025');
    expect(order.issues).toEqual([{ severity: 'defect', field: 'id', message: 'Order ID was a number in the export' }]);
  });

  test('repeated order IDs are flagged and get unique keys', () => {
    const repeated = parseOrders({ orders: [base, base, { ...base, id: 'X-2' }] });
    expect(repeated.map((o) => o.key)).toEqual(['X-1', 'X-1#2', 'X-2']);
    expect(repeated.map((o) => messages(o))).toEqual([
      ['Order ID appears 2 times in the export'],
      ['Order ID appears 2 times in the export'],
      [],
    ]);
  });
});

describe('parseOrders rejects a malformed export', () => {
  test.each([null, [], 'orders', { orders: 'none' }, { data: [] }])('%j throws', (raw) => {
    expect(() => parseOrders(raw)).toThrow(OrdersFormatError);
  });

  test('a row without an id throws', () => {
    expect(() => parseOrders({ orders: [{ total: 1 }] })).toThrow('Order 1 in the export has no order ID.');
  });

  test('a row with an unreadable id says so', () => {
    expect(() => parseOrders({ orders: [{ id: { n: 1 } }] })).toThrow('Order 1 in the export has an unreadable order ID.');
  });

  test('a row that is not an object says so', () => {
    expect(() => parseOrders({ orders: ['ORD-1'] })).toThrow('Order 1 in the export is not an order record.');
  });
});
