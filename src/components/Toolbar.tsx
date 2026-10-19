import { Search } from 'lucide-react';
import { useMemo } from 'react';
import { STATUS, UNKNOWN_STATUS_COLOR_VAR, isStatusKey, statusFilterLabel, statusFilterOf, type StatusFilter } from '../domain/status';
import { STATUS_KEYS, type Order } from '../domain/types';
import { LineBar } from './StatusLabel';

type StatusOption = { value: StatusFilter; label: string; colorVar: string | null; count: number };

function statusOptions(orders: readonly Order[]): StatusOption[] {
  const counts = new Map<StatusFilter, number>();
  for (const order of orders) {
    const key = statusFilterOf(order.status);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const known = STATUS_KEYS.map((key) => ({
    value: key,
    label: STATUS[key].label,
    colorVar: STATUS[key].colorVar,
    count: counts.get(key) ?? 0,
  }));
  const unknown: StatusOption[] = [];
  for (const [value, count] of counts) {
    if (value === 'all' || isStatusKey(value)) continue;
    unknown.push({ value, label: statusFilterLabel(value), colorVar: UNKNOWN_STATUS_COLOR_VAR, count });
  }
  return [{ value: 'all', label: 'All', colorVar: null, count: orders.length }, ...known, ...unknown];
}

type ToolbarProps = {
  orders: readonly Order[];
  query: string;
  status: StatusFilter;
  shown: number;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: StatusFilter) => void;
};

export function Toolbar({ orders, query, status, shown, onQueryChange, onStatusChange }: ToolbarProps) {
  const options = useMemo(() => statusOptions(orders), [orders]);
  return (
    <div className="toolbar">
      <div className="search">
        <label htmlFor="order-search">Search by customer name or email</label>
        <div className="search-field">
          <Search size={18} strokeWidth={2.25} aria-hidden="true" />
          <input
            id="order-search"
            type="search"
            value={query}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => onQueryChange(event.target.value)}
          />
        </div>
      </div>
      <fieldset className="chips">
        <legend>Status</legend>
        <div className="chip-row">
          {options.map((option) => (
            <label key={option.value} className="chip">
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={status === option.value}
                onChange={() => onStatusChange(option.value)}
              />
              {option.colorVar && <LineBar colorVar={option.colorVar} />}
              <span className="chip-label">{option.label}</span>
              <span className="chip-count">
                {option.count}
                <span className="vh"> orders</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="result-count" aria-live="polite">
        Showing {shown} of {orders.length} orders
      </p>
    </div>
  );
}
