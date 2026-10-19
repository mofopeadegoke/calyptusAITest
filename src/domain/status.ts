import type { Status, StatusKey } from './types';

export const STATUS: Record<StatusKey, { label: string; colorVar: string }> = {
  paid: { label: 'Paid', colorVar: '--line-paid' },
  pending: { label: 'Pending', colorVar: '--line-pending' },
  refunded: { label: 'Refunded', colorVar: '--line-refunded' },
  failed: { label: 'Failed', colorVar: '--line-failed' },
  chargeback: { label: 'Chargeback', colorVar: '--line-chargeback' },
};

export const UNKNOWN_STATUS_COLOR_VAR = '--line-unknown';

export function statusLabel(status: Status): string {
  return status.kind === 'known' ? STATUS[status.key].label : status.raw;
}

export function statusColorVar(status: Status): string {
  return status.kind === 'known' ? STATUS[status.key].colorVar : UNKNOWN_STATUS_COLOR_VAR;
}
