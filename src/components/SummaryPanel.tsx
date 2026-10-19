import { useMemo } from 'react';
import { formatMoney, RATES_TO_GBP, summarisePaid, type PaidLine } from '../domain/money';
import type { Order } from '../domain/types';

const asOfDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${RATES_TO_GBP.asOf}T00:00:00Z`));

function joinWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function Uncounted({ count, reason }: { count: number; reason: string }) {
  if (count === 0) return null;
  return (
    <p className="summary-note">
      {plural(count, 'paid order has', 'paid orders have')} {reason} and {count === 1 ? 'is' : 'are'} not counted.
    </p>
  );
}

function Approx() {
  return (
    <>
      <span aria-hidden="true">≈ </span>
      <span className="vh">approximately </span>
    </>
  );
}

function Conversion({ line }: { line: PaidLine }) {
  if (line.currency === 'GBP') return <>exact</>;
  if (line.gbpMinor === null) return <>no rate, not in total</>;
  return (
    <>
      <Approx />
      {formatMoney({ minor: line.gbpMinor, currency: 'GBP' })} at {line.rate}
    </>
  );
}

export function SummaryPanel({ orders }: { orders: readonly Order[] }) {
  const summary = useMemo(() => summarisePaid(orders), [orders]);
  const converted = summary.lines.filter((l) => l.currency !== 'GBP' && l.gbpMinor !== null).map((l) => l.currency);
  const notes = [plural(summary.paidCount, 'paid order', 'paid orders')];
  if (converted.length > 0) {
    notes.push(`${joinWords(converted)} converted at fixed rates as of ${asOfDate}`);
  }

  return (
    <section className="summary" aria-labelledby="summary-heading">
      <div className="summary-headline">
        <h2 id="summary-heading">All paid orders</h2>
        <p className="headline-value">
          {summary.isApprox && <Approx />}
          {formatMoney({ minor: summary.gbpApproxMinor, currency: 'GBP' })}
        </p>
        <p className="summary-note">{notes.join(' · ')}</p>
        {summary.unconverted.length > 0 && (
          <p className="summary-note">
            {joinWords(summary.unconverted)} not included in the total: no fixed rate.
          </p>
        )}
        <Uncounted count={summary.missingTotals} reason="no total in the export" />
        <Uncounted count={summary.negativeTotals} reason="a negative total in the export" />
        <Uncounted count={summary.repeatedIds} reason="an order ID that was already counted" />
      </div>
      <ul className="board" aria-label="Paid orders by currency">
        {summary.lines.map((line) => (
          // The spaces keep screen readers from running the cells together; the grid ignores them.
          <li key={line.currency}>
            <span className="board-code">{line.currency}</span>{' '}
            <span className="board-count">{plural(line.count, 'order', 'orders')}</span>{' '}
            <span className="board-exact">{formatMoney({ minor: line.minor, currency: line.currency })}</span>{' '}
            <span className="board-gbp">
              <Conversion line={line} />
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
