import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface FeedbackContextValue { announce: (message: string) => void }
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [feedback, setFeedback] = useState({ message: '', revision: 0 });
  const announce = useCallback((message: string) => {
    setFeedback((previous) => ({ message, revision: previous.revision + 1 }));
  }, []);
  const value = useMemo(() => ({ announce }), [announce]);
  return <FeedbackContext.Provider value={value}>
    {children}
    <div role="status" aria-live="polite" aria-atomic="true"
      style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap', border: 0 }}>
      <span key={feedback.revision}>{feedback.message}</span>
    </div>
  </FeedbackContext.Provider>;
}

export function useFeedback(): FeedbackContextValue {
  const value = useContext(FeedbackContext);
  if (!value) throw new Error('useFeedback must be used within FeedbackProvider');
  return value;
}
