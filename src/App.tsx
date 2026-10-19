import { useMemo, useState } from 'react';
import { EmptyView, ErrorView, Loading } from './components/StateViews';
import { OrdersTable } from './components/OrdersTable';
import { SummaryPanel } from './components/SummaryPanel';
import { Toolbar } from './components/Toolbar';
import { useOrders } from './data/useOrders';
import { statusFilterLabel, type StatusFilter } from './domain/status';
import { DEFAULT_SORT, selectOrders, type Sort, type SortKey } from './domain/selectOrders';
import type { LoadState, Order } from './domain/types';

function emptyMessage(query: string, status: StatusFilter): string {
  const trimmed = query.trim();
  const base = status === 'all' ? 'No orders' : `No ${statusFilterLabel(status)} orders`;
  return trimmed === '' ? `${base}.` : `${base} match “${trimmed}”.`;
}

function Dashboard({ orders }: { orders: Order[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sort, setSort] = useState<Sort>(DEFAULT_SORT);
  const shown = useMemo(() => selectOrders(orders, { query, status, sort }), [orders, query, status, sort]);

  if (orders.length === 0) return <EmptyView message="The export contains no orders." />;

  const toggleSort = (key: SortKey) =>
    setSort((current) => (current.key === key ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));
  const clear = () => {
    setQuery('');
    setStatus('all');
  };

  return (
    <>
      <SummaryPanel orders={orders} />
      <Toolbar
        orders={orders}
        query={query}
        status={status}
        shown={shown.length}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
      />
      {shown.length === 0 ? (
        <EmptyView message={emptyMessage(query, status)} onClear={clear} />
      ) : (
        <OrdersTable orders={shown} sort={sort} onSort={toggleSort} />
      )}
    </>
  );
}

function Body({ state, retry }: { state: LoadState; retry: () => void }) {
  switch (state.phase) {
    case 'loading':
      return <Loading />;
    case 'error':
      return <ErrorView message={state.message} onRetry={retry} />;
    case 'ready':
      return <Dashboard orders={state.orders} />;
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
}

function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <span style={{ '--bar': 'var(--line-paid)' }} />
      <span style={{ '--bar': 'var(--line-pending)' }} />
      <span style={{ '--bar': 'var(--line-refunded)' }} />
    </span>
  );
}

export function App() {
  const { state, retry } = useOrders();
  return (
    <>
      <header className="masthead">
        <Mark />
        <h1>Orders</h1>
      </header>
      <main className="page">
        <Body state={state} retry={retry} />
      </main>
    </>
  );
}
