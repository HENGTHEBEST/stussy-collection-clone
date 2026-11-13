import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Send, X } from 'lucide-react';
import { answerGuideQuestion, guideSuggestions } from '../../lib/mascotGuide';
import '../../styles/mascot-guide.css';

type Expression = 'idle' | 'curious' | 'thoughtful' | 'happy';
type Message = { from: 'user' | 'guide'; text: string };

export function MascotGuide({ pathname, open, onOpenChange }: { pathname: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [expression, setExpression] = useState<Expression>('idle');
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(document.visibilityState !== 'hidden');
  const [reducedMotion, setReducedMotion] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return;
    const update = () => setReducedMotion(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setInViewport(entry.isIntersecting));
    if (trigger.current) observer.observe(trigger.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (open) { setExpression('curious'); input.current?.focus(); }
  }, [open]);
  useEffect(() => {
    if (open || !inViewport || !pageVisible || reducedMotion) return;
    const faces: Expression[] = ['idle', 'curious', 'happy'];
    const interval = window.setInterval(() => setExpression((face) => faces[(faces.indexOf(face) + 1) % faces.length]), 2000);
    return () => window.clearInterval(interval);
  }, [open, inViewport, pageVisible, reducedMotion]);
  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => { if (conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight; }, [messages]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') close(); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKeyDown); };
  }, [open, onOpenChange]);

  const close = () => { onOpenChange(false); trigger.current?.focus(); };
  async function ask(question: string) {
    if (!question.trim() || busy.current) return;
    busy.current = true;
    setDraft(''); setExpression('thoughtful');
    setMessages((current) => [...current, { from: 'user', text: question }]);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const answer = await answerGuideQuestion(question, pathname);
      setMessages((current) => [...current, { from: 'guide', text: answer }]);
      setExpression('happy');
    } catch {
      setMessages((current) => [...current, { from: 'guide', text: "I couldn't prepare an answer right now. Please try again." }]);
      setExpression('curious');
    } finally { busy.current = false; }
  }
  const submit = (event: FormEvent) => { event.preventDefault(); void ask(draft); };

  const panelContent = open && <section ref={panel} id="mascot-panel" className="mascot-panel" aria-label="Store guide">
      <header className="mascot-panel-header"><div><strong>Stüssy guide</strong><small>Answers from this shop</small></div><button type="button" aria-label="Close store guide" onClick={close}><X aria-hidden="true" size={20} /></button></header>
      <div ref={conversation} className="mascot-conversation" role="log" aria-live="polite" aria-label="Guide conversation">
        <p className="mascot-message guide">Ask me about this page, products, or how checkout works.</p>
        {messages.map((message, index) => <p className={'mascot-message ' + message.from} key={index}>{message.text}</p>)}
      </div>
      <div className="mascot-suggestions">{guideSuggestions(pathname).map((suggestion) => <button type="button" key={suggestion} onClick={() => void ask(suggestion)}>{suggestion}</button>)}</div>
      <form className="mascot-form" onSubmit={submit}><label htmlFor="mascot-question">Your question</label><div><input ref={input} id="mascot-question" aria-label="Ask the store guide" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about this page…" maxLength={300} /><button type="submit" aria-label="Send question" disabled={!draft.trim()}><Send size={18} aria-hidden="true" /></button></div></form>
      <p className="mascot-disclosure">Site guide only. No live AI service is connected; I may not know current stock or payment availability.</p>
    </section>;
  return <div className="mascot-guide">
    <button ref={trigger} className="mascot-trigger" type="button" aria-label={open ? 'Hide store guide' : 'Open store guide'} title="Store guide" aria-expanded={open} aria-controls="mascot-panel" onClick={() => open ? close() : onOpenChange(true)}>
      <span className="mascot-sprite" data-expression={expression} aria-hidden="true" />
    </button>
    {panelContent}
  </div>;
}
