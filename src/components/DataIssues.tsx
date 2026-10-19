import { TriangleAlert } from 'lucide-react';
import type { DataIssue } from '../domain/types';

export function DataIssues({ issues }: { issues: DataIssue[] }) {
  if (issues.length === 0) return null;
  return (
    <details className="issues">
      <summary>
        <TriangleAlert size={14} strokeWidth={2.25} aria-hidden="true" />
        {issues.length === 1 ? 'Data issue' : `${issues.length} data issues`}
      </summary>
      <ul>
        {issues.map((issue) => (
          <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
        ))}
      </ul>
    </details>
  );
}
