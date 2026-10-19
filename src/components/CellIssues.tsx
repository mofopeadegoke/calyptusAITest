import { Info, TriangleAlert } from 'lucide-react';
import type { DataIssue, IssueField } from '../domain/types';

export function CellIssues({ issues, fields }: { issues: DataIssue[]; fields: readonly IssueField[] }) {
  const shown = issues.filter((issue) => fields.includes(issue.field));
  if (shown.length === 0) return null;
  return (
    <ul className="cell-issues">
      {shown.map((issue) => {
        const Icon = issue.severity === 'note' ? Info : TriangleAlert;
        return (
          <li key={`${issue.field}:${issue.message}`} data-severity={issue.severity}>
            <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
            <span>
              <span className="vh">{issue.severity === 'note' ? 'Note: ' : 'Data issue: '}</span>
              {issue.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
