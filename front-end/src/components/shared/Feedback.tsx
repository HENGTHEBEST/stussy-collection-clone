import type { ReactNode } from 'react';

// Visible companion copy; announcements belong to the single FeedbackProvider.
export function Feedback({ children, id, className = '' }: { children: ReactNode; id?: string; className?: string }) {
  return <p id={id} className={`feedback ${className}`}>{children}</p>;
}
