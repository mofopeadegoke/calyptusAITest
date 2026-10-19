const localFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

const wallClockFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
});

const OFFSET = /^([+-])(\d{2}):(\d{2})$/;

export function formatLocal(date: Date): string {
  return localFormat.format(date);
}

export function formatAtSource(date: Date, offset: string): string {
  const match = OFFSET.exec(offset);
  if (!match) throw new RangeError(`Not a UTC offset: ${offset}`);
  const [, sign, hours, minutes] = match;
  const offsetMinutes = (sign === '-' ? -1 : 1) * (Number(hours) * 60 + Number(minutes));
  const shifted = new Date(date.getTime() + offsetMinutes * 60_000);
  const label = `UTC${sign === '-' ? '−' : '+'}${hours}:${minutes}`;
  return `${wallClockFormat.format(shifted)} (${label})`;
}
