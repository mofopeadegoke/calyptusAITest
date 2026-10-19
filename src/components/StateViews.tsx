import { RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';

const SKELETON_ROWS = 8;

export function Loading() {
  return (
    <div className="loading" aria-busy="true">
      <p className="vh" role="status">
        Loading orders…
      </p>
      <div className="summary summary-skeleton" aria-hidden="true">
        <div className="summary-headline">
          <span className="skel skel-label" />
          <span className="skel skel-headline" />
          <span className="skel skel-note" />
        </div>
        <div className="board">
          {[0, 1, 2].map((i) => (
            <span key={i} className="skel skel-board-row" />
          ))}
        </div>
      </div>
      <div className="table-scroll" aria-hidden="true">
        <table className="orders">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th>Placed (your time)</th>
              <th className="num">Items</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: SKELETON_ROWS }, (_, row) => (
              <tr key={row}>
                {[5, 12, 6, 7, 10, 2].map((width, col) => (
                  <td key={col} className={col === 2 || col === 5 ? 'num' : undefined}>
                    <span className="skel" style={{ width: `${width}ch` }} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ErrorView({ message, onRetry }: { message: string; onRetry: () => void }) {
  const retryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    retryRef.current?.focus();
  }, []);
  return (
    <div className="state-view" role="alert">
      <h2>Orders could not be loaded</h2>
      <p>{message}</p>
      <button ref={retryRef} type="button" className="button" onClick={onRetry}>
        <RotateCcw size={16} strokeWidth={2.25} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}

export function EmptyView({ message, onClear }: { message: string; onClear?: () => void }) {
  return (
    <div className="state-view">
      <p>{message}</p>
      {onClear && (
        <button type="button" className="button" onClick={onClear}>
          Clear search and filter
        </button>
      )}
    </div>
  );
}
