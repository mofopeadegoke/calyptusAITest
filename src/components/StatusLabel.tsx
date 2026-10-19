import { statusColorVar, statusLabel } from '../domain/status';
import type { Status } from '../domain/types';

export function LineBar({ colorVar }: { colorVar: string }) {
  return <span className="line-bar" style={{ '--bar': `var(${colorVar})` }} aria-hidden="true" />;
}

export function StatusLabel({ status }: { status: Status }) {
  return (
    <span className="status">
      <LineBar colorVar={statusColorVar(status)} />
      {statusLabel(status)}
    </span>
  );
}
