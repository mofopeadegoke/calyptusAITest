import { formatAtSource, formatLocal } from './time';

describe('formatLocal in Europe/London', () => {
  test('ORD-1013 placed just after midnight in +05:30 is the previous evening in BST', () => {
    expect(formatLocal(new Date('2026-10-07T00:30:00+05:30'))).toBe('6 Oct 2026, 20:00 BST');
  });

  test('ORD-1024 placed in the US evening is the next morning in London', () => {
    expect(formatLocal(new Date('2026-10-12T21:10:00-07:00'))).toBe('13 Oct 2026, 05:10 BST');
  });

  test('a date after the clocks go back on 25 Oct shows GMT', () => {
    expect(formatLocal(new Date('2026-10-26T09:00:00Z'))).toBe('26 Oct 2026, 09:00 GMT');
  });
});

describe('formatAtSource', () => {
  test('shows the wall-clock time in the customer offset', () => {
    expect(formatAtSource(new Date('2026-10-12T21:10:00-07:00'), '-07:00')).toBe(
      '12 Oct 2026, 21:10 (UTC−07:00)',
    );
  });

  test('handles half-hour offsets', () => {
    expect(formatAtSource(new Date('2026-10-07T00:30:00+05:30'), '+05:30')).toBe(
      '7 Oct 2026, 00:30 (UTC+05:30)',
    );
  });

  test('UTC orders read as +00:00', () => {
    expect(formatAtSource(new Date('2026-10-01T09:15:00Z'), '+00:00')).toBe('1 Oct 2026, 09:15 (UTC+00:00)');
  });
});
