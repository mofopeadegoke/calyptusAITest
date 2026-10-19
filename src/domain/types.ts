export type Currency = string;

export type Money = { minor: number; currency: Currency };

export const STATUS_KEYS = ['paid', 'pending', 'refunded', 'failed', 'chargeback'] as const;
export type StatusKey = (typeof STATUS_KEYS)[number];

export type Status = { kind: 'known'; key: StatusKey } | { kind: 'unknown'; raw: string };

export type Customer = { name: string | null; email: string | null } | null;

export type IssueField = 'id' | 'customer' | 'name' | 'total' | 'created_at' | 'items' | 'status' | 'currency';

export type DataIssue = {
  severity: 'defect' | 'note';
  field: IssueField;
  message: string;
};

export type Order = {
  id: string;
  /** Unique per row even when the export repeats an ID. */
  key: string;
  customer: Customer;
  amount: Money | null;
  status: Status;
  createdAt: Date | null;
  sourceOffset: string | null;
  items: number | null;
  issues: DataIssue[];
};

export type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; orders: Order[] };
