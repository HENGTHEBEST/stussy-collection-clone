import { useState, type FormEvent } from 'react';
import { useFeedback } from '../../state/FeedbackProvider';
import { DemoBadge } from './DemoBadge';
import { Feedback } from './Feedback';

export function SiteFooter() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);
  const [message, setMessage] = useState('');
  const { announce } = useFeedback();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(true);
      setMessage('');
      announce('Enter a valid email address.');
      return;
    }
    const success = 'Demo signup complete — no email was sent.';
    setError(false);
    setEmail('');
    setMessage(success);
    announce(success);
  }
  return <footer id="contact" className="site-footer" tabIndex={-1}>
    <div className="footer-grid">
      <div><h2>Stay connected</h2><p>Stussy Collection</p><DemoBadge />
        <p>A showcase and simulated shopping experience. No orders are fulfilled.</p>
      </div>
      <div><h3>Social</h3><ul className="social-list">
        <li><span aria-disabled="true">Instagram</span></li>
        <li><span aria-disabled="true">Twitter</span></li>
        <li><span aria-disabled="true">TikTok</span></li>
      </ul><p>Social destinations unavailable in this demo.</p></div>
      <div><h3>Newsletter</h3><p>Demo signup only. Your email stays on this page.</p>
        <form noValidate onSubmit={submit}>
          <label htmlFor="newsletter-email">Email address</label>
          <div className="newsletter-controls"><input id="newsletter-email" type="email" value={email}
            autoComplete="email" onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error} aria-describedby={error ? 'newsletter-error' : undefined} />
            <button type="submit">Sign up</button></div>
          {error && <Feedback id="newsletter-error">Enter a valid email address.</Feedback>}
          {message && <Feedback className="newsletter-message">{message}</Feedback>}
        </form>
      </div>
    </div>
    <p className="footer-legal">© {new Date().getFullYear()} Stussy Collection demo. An unofficial recreation.</p>
  </footer>;
}
