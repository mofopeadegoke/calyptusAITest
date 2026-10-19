import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatMoney } from '../domain/money';
import type { Sort, SortDir, SortKey } from '../domain/selectOrders';
import { formatAtSource, formatLocal } from '../domain/time';
import type { Order } from '../domain/types';
import { CellIssues } from './CellIssues';
import { StatusLabel } from './StatusLabel';

const SORT_CAPTION: Record<SortKey, { label: string } & Record<SortDir, string>> = {
  date: { label: 'date', desc: 'newest first', asc: 'oldest first' },
  total: { label: 'total', desc: 'highest first', asc: 'lowest first' },
};

export function sortCaption(sort: Sort): string {
  const caption = SORT_CAPTION[sort.key];
  return `Orders, sorted by ${caption.label}, ${caption[sort.dir]}`;
}

function Absent({ children }: { children: ReactNode }) {
  return <span className="absent">{children}</span>;
}

function SortHeader({
  sortKey,
  sort,
  onSort,
  className,
  children,
}: {
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
  children: ReactNode;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.dir === 'desc' ? ArrowDown : ArrowUp;
  return (
    <th scope="col" className={className} aria-sort={active ? (sort.dir === 'desc' ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="sort-button" data-active={active} onClick={() => onSort(sortKey)}>
        {children}
        <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </th>
  );
}

function CustomerCell({ customer }: { customer: Order['customer'] }) {
  if (customer === null) return <Absent>Unknown customer</Absent>;
  return (
    <>
      <span className="customer-name">{customer.name ?? <Absent>(no name)</Absent>}</span>{' '}
      <span className="customer-email">{customer.email ?? <Absent>(no email)</Absent>}</span>
    </>
  );
}

function PlacedCell({ order }: { order: Order }) {
  if (order.createdAt === null) return <Absent>Time unavailable</Absent>;
  const atSource = order.sourceOffset ? formatAtSource(order.createdAt, order.sourceOffset) : null;
  return (
    <>
      <time dateTime={order.createdAt.toISOString()}>{formatLocal(order.createdAt)}</time>{' '}
      {atSource && <span className="source-time">Customer's time {atSource}</span>}
    </>
  );
}

type OrdersTableProps = {
  orders: readonly Order[];
  sort: Sort;
  onSort: (key: SortKey) => void;
};

export function OrdersTable({ orders, sort, onSort }: OrdersTableProps) {
  return (
    <div className="table-scroll" role="region" aria-label="Orders table" tabIndex={0}>
      <table className="orders">
        <caption className="vh">{sortCaption(sort)}</caption>
        <thead>
          <tr>
            <th scope="col">Order</th>
            <th scope="col">Customer</th>
            <SortHeader sortKey="total" sort={sort} onSort={onSort} className="num">
              Total
            </SortHeader>
            <th scope="col">Status</th>
            <SortHeader sortKey="date" sort={sort} onSort={onSort}>
              Placed (your time)
            </SortHeader>
            <th scope="col" className="num">
              Items
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.key}>
              <th scope="row" className="order-id">
                {order.id}
                <CellIssues issues={order.issues} fields={['id']} />
              </th>
              <td className="customer">
                <CustomerCell customer={order.customer} />
                <CellIssues issues={order.issues} fields={['customer', 'name']} />
              </td>
              <td className="num">
                {order.amount ? formatMoney(order.amount) : <Absent>Total unavailable</Absent>}
                <CellIssues issues={order.issues} fields={['total', 'currency']} />
              </td>
              <td>
                <StatusLabel status={order.status} />
                <CellIssues issues={order.issues} fields={['status']} />
              </td>
              <td className="placed">
                <PlacedCell order={order} />
                <CellIssues issues={order.issues} fields={['created_at']} />
              </td>
              <td className="num">
                {order.items ?? <Absent>Unknown</Absent>}
                <CellIssues issues={order.issues} fields={['items']} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
