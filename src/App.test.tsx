import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureAxe } from 'vitest-axe';
import exportFile from '../public/orders.json';
import { App } from './App';

// jsdom has no layout or canvas, so axe cannot measure contrast here; contrast is checked against the tokens instead.
const axe = configureAxe({ rules: { 'color-contrast': { enabled: false } } });

function respondWith(body: unknown, init?: ResponseInit) {
  return () => Promise.resolve(new Response(JSON.stringify(body), init));
}

function mockFetch(...responses: Array<() => Promise<Response>>) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const response of responses) fetchMock.mockImplementationOnce(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderReady() {
  mockFetch(respondWith(exportFile));
  const user = userEvent.setup();
  const view = render(<App />);
  await screen.findByRole('table', { name: /orders, sorted by/i });
  return { user, ...view };
}

function bodyRowIds(): string[] {
  const table = screen.getByRole('table', { name: /orders, sorted by/i });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('rowheader').textContent?.match(/ORD-\d+/)?.[0] ?? '');
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loading', () => {
  test('shows a busy loading state, then the orders', async () => {
    const fetchMock = mockFetch(respondWith(exportFile));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading orders…');
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();

    await screen.findByRole('table', { name: 'Orders, sorted by date, newest first' });
    expect(fetchMock).toHaveBeenCalledWith('/orders.json', expect.anything());
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(bodyRowIds()).toHaveLength(24);
  });

  test('summary shows the approximate GBP headline and exact per-currency lines', async () => {
    await renderReady();
    const summary = screen.getByRole('region', { name: 'All paid orders' });
    expect(summary).toHaveTextContent('approximately £4,410.36');
    expect(summary).toHaveTextContent('15 paid orders · EUR and USD converted at fixed rates as of 19 Oct 2026');
    const lines = within(screen.getByRole('list', { name: 'Paid orders by currency' })).getAllByRole('listitem');
    expect(lines.map((li) => li.textContent)).toEqual([
      'GBP6 orders£1,542.00exact',
      'EUR6 orders€1,663.40≈ approximately £1,447.16 at 0.87',
      'USD3 ordersUS$1,798.99≈ approximately £1,421.20 at 0.79',
    ]);
  });

  test('rows state repairs and absences in place', async () => {
    await renderReady();
    const row = (id: string) => screen.getByRole('rowheader', { name: new RegExp(id) }).closest('tr')!;
    expect(row('ORD-1004')).toHaveTextContent('Unknown customer');
    expect(row('ORD-1014')).toHaveTextContent('(no name)');
    expect(row('ORD-1007')).toHaveTextContent('Total unavailable');

    const totalCell = within(row('ORD-1006')).getByText('€149.50').closest('td')!;
    expect(within(totalCell).getByText('Total was text in the export; read as 149.50')).toBeVisible();
  });

  test('times show the viewer zone and carry the customer time', async () => {
    await renderReady();
    const row = screen.getByRole('rowheader', { name: /ORD-1024/ }).closest('tr')!;
    const time = row.querySelector('time')!;
    expect(time).toHaveAttribute('dateTime', '2026-10-13T04:10:00.000Z');
    expect(time).toHaveTextContent('13 Oct 2026, 05:10 BST');
    expect(time.closest('td')).toHaveTextContent("Customer's time 12 Oct 2026, 21:10 (UTC−07:00)");
  });
});

describe('errors', () => {
  test('a failed fetch shows an alert; Try again takes focus and recovers', async () => {
    mockFetch(respondWith({}, { status: 404 }), respondWith(exportFile));
    const user = userEvent.setup();
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('HTTP 404');
    const retry = within(alert).getByRole('button', { name: 'Try again' });
    expect(retry).toHaveFocus();

    await user.keyboard('{Enter}');
    await screen.findByRole('table', { name: /orders, sorted by/i });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test.each([
    ['network failure', () => Promise.reject(new TypeError('Failed to fetch')), /couldn't reach the server/i],
    ['invalid JSON', () => Promise.resolve(new Response('{not json')), /not valid JSON/],
    ['wrong shape', respondWith({ data: [] }), /not in the expected format/],
  ])('%s gets a message naming the problem', async (_name, response, expected) => {
    mockFetch(response);
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(expected);
  });

  test('?error=1 requests a file that does not exist', async () => {
    window.history.pushState({}, '', '/?error=1');
    const fetchMock = mockFetch(respondWith({}, { status: 404 }));
    render(<App />);
    await screen.findByRole('alert');
    expect(fetchMock).toHaveBeenCalledWith('/orders.does-not-exist.json', expect.anything());
    window.history.pushState({}, '', '/');
  });
});

describe('filtering and sorting', () => {
  test('search narrows the table and announces the count', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText('Search by customer name or email'), 'zoe');
    expect(bodyRowIds()).toEqual(['ORD-1013']);
    expect(screen.getByText('Showing 1 of 24 orders')).toHaveAttribute('aria-live', 'polite');
  });

  test('status radios filter and show counts', async () => {
    const { user } = await renderReady();
    const group = screen.getByRole('group', { name: 'Status' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.closest('label')?.textContent)).toEqual([
      'All24 orders',
      'Paid15 orders',
      'Pending3 orders',
      'Refunded3 orders',
      'Failed2 orders',
      'Chargeback1 orders',
    ]);
    await user.click(within(group).getByRole('radio', { name: /Chargeback/ }));
    expect(bodyRowIds()).toEqual(['ORD-1009']);

    await user.keyboard('{ArrowLeft}');
    expect(within(group).getByRole('radio', { name: /Failed/ })).toBeChecked();
    expect(bodyRowIds().sort()).toEqual(['ORD-1008', 'ORD-1018']);
  });

  test('no matches shows an empty state that clears search and filter', async () => {
    const { user } = await renderReady();
    await user.type(screen.getByLabelText('Search by customer name or email'), 'xyz');
    expect(screen.getByText('No orders match “xyz”.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /orders, sorted by/i })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Clear search and filter' }));
    expect(bodyRowIds()).toHaveLength(24);
    expect(screen.getByLabelText('Search by customer name or email')).toHaveValue('');
  });

  test('keyboard: Tab to the Total header, Enter sorts and updates aria-sort', async () => {
    const { user } = await renderReady();
    const totalButton = screen.getByRole('button', { name: 'Total' });
    const totalHeader = totalButton.closest('th')!;
    const placedHeader = screen.getByRole('button', { name: 'Placed (your time)' }).closest('th')!;
    expect(totalHeader).toHaveAttribute('aria-sort', 'none');
    expect(placedHeader).toHaveAttribute('aria-sort', 'descending');

    while (document.activeElement !== totalButton) await user.tab();
    await user.keyboard('{Enter}');
    expect(totalHeader).toHaveAttribute('aria-sort', 'descending');
    expect(placedHeader).toHaveAttribute('aria-sort', 'none');
    expect(screen.getByRole('table', { name: 'Orders, sorted by total, highest first' })).toBeInTheDocument();
    expect(bodyRowIds()[0]).toBe('ORD-1021');

    await user.keyboard('{Enter}');
    expect(totalHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(bodyRowIds()[0]).toBe('ORD-1016');
    expect(bodyRowIds().at(-1)).toBe('ORD-1007');
  });
});

describe('unknown statuses', () => {
  test('pass through as their own filter chip and label', async () => {
    const extra = { ...exportFile.orders[0], id: 'ORD-2000', status: 'disputed' };
    mockFetch(respondWith({ orders: [...exportFile.orders, extra] }));
    const user = userEvent.setup();
    render(<App />);
    const chip = await screen.findByRole('radio', { name: 'disputed 1 orders' });
    await user.click(chip);
    expect(bodyRowIds()).toEqual(['ORD-2000']);
    expect(screen.getByRole('rowheader', { name: /ORD-2000/ }).closest('tr')).toHaveTextContent('disputed');
  });
});

describe('empty export', () => {
  test('says the export has no orders', async () => {
    mockFetch(respondWith({ orders: [] }));
    render(<App />);
    expect(await screen.findByText('The export contains no orders.')).toBeInTheDocument();
  });
});

describe('accessibility', () => {
  test('ready state has no axe violations', async () => {
    const { container } = await renderReady();
    expect(await axe(container)).toHaveNoViolations();
  });

  test('error state has no axe violations', async () => {
    mockFetch(respondWith({}, { status: 500 }));
    const { container } = render(<App />);
    await screen.findByRole('alert');
    expect(await axe(container)).toHaveNoViolations();
  });

  test('empty-filter state has no axe violations', async () => {
    const { user, container } = await renderReady();
    await user.type(screen.getByLabelText('Search by customer name or email'), 'xyz');
    await waitFor(() => expect(screen.getByText('No orders match “xyz”.')).toBeInTheDocument());
    expect(await axe(container)).toHaveNoViolations();
  });

  test('loading state has no axe violations', async () => {
    mockFetch(() => new Promise<Response>(() => {}));
    const { container } = render(<App />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
