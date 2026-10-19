import { STATUS_KEYS, type Status, type StatusKey } from './types';

export const STATUS: Record<StatusKey, { label: string; colorVar: string }> = {
  paid: { label: 'Paid', colorVar: '--line-paid' },
  pending: { label: 'Pending', colorVar: '--line-pending' },
  refunded: { label: 'Refunded', colorVar: '--line-refunded' },
  failed: { label: 'Failed', colorVar: '--line-failed' },
  chargeback: { label: 'Chargeback', colorVar: '--line-chargeback' },
};

export const UNKNOWN_STATUS_COLOR_VAR = '--line-unknown';

function unknownLabel(raw: string): string {
  return raw === '' ? 'No status' : raw;
}

export function statusLabel(status: Status): string {
  return status.kind === 'known' ? STATUS[status.key].label : unknownLabel(status.raw);
}

export function statusColorVar(status: Status): string {
  return status.kind === 'known' ? STATUS[status.key].colorVar : UNKNOWN_STATUS_COLOR_VAR;
}

export type StatusFilter = 'all' | StatusKey | `unknown:${string}`;

export function statusFilterOf(status: Status): Exclude<StatusFilter, 'all'> {
  return status.kind === 'known' ? status.key : `unknown:${status.raw}`;
}

export function isStatusKey(value: string): value is StatusKey {
  return (STATUS_KEYS as readonly string[]).includes(value);
}

export function statusFilterLabel(filter: Exclude<StatusFilter, 'all'>): string {
  return isStatusKey(filter) ? STATUS[filter].label : unknownLabel(filter.slice('unknown:'.length));
}
