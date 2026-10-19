import { statusFilterOf, type StatusFilter } from './status';
import type { Order } from './types';

export type SortKey = 'date' | 'total';
export type SortDir = 'asc' | 'desc';
export type Sort = { key: SortKey; dir: SortDir };
export type Selection = { query: string; status: StatusFilter; sort: Sort };

export const DEFAULT_SORT: Sort = { key: 'date', dir: 'desc' };

const SORT_VALUE: Record<SortKey, (order: Order) => number | null> = {
  date: (order) => order.createdAt?.getTime() ?? null,
  total: (order) => order.amount?.minor ?? null,
};

export function foldText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function matchesQuery(order: Order, needle: string): boolean {
  if (needle === '') return true;
  const haystack = [order.customer?.name, order.customer?.email].filter((s) => s != null);
  return haystack.some((text) => foldText(text).includes(needle));
}

export function selectOrders(orders: readonly Order[], { query, status, sort }: Selection): Order[] {
  const needle = foldText(query.trim());
  const value = SORT_VALUE[sort.key];
  const direction = sort.dir === 'asc' ? 1 : -1;
  return orders
    .filter((order) => status === 'all' || statusFilterOf(order.status) === status)
    .filter((order) => matchesQuery(order, needle))
    .map((order) => ({ order, value: value(order) }))
    .sort((a, b) => {
      if (a.value !== b.value) {
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return (a.value - b.value) * direction;
      }
      return a.order.id.localeCompare(b.order.id);
    })
    .map(({ order }) => order);
}
