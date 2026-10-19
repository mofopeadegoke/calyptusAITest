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

export type StatusFilter = 'all' | StatusKey | `unknown:${string}`;

export function statusFilterOf(status: Status): Exclude<StatusFilter, 'all'> {
  return status.kind === 'known' ? status.key : `unknown:${status.raw}`;
}

function isStatusKeyFilter(filter: Exclude<StatusFilter, 'all'>): filter is StatusKey {
  return Object.hasOwn(STATUS, filter);
}

export function statusFilterLabel(filter: Exclude<StatusFilter, 'all'>): string {
  return isStatusKeyFilter(filter) ? STATUS[filter].label : filter.slice('unknown:'.length);
}
