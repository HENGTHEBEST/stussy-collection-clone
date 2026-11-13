import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Clock3, ShieldCheck, X } from 'lucide-react';
import type { PublicOrder } from '../../../shared/commerce';

export type KhqrModalStatus = 'pending' | 'success' | 'failed' | 'unavailable';

interface KhqrPaymentModalProps {
  order: PublicOrder;
  countdown: string;
  remaining: number;
  status: KhqrModalStatus;
  refreshError: string;
  error: string;
  onClose: () => void;
}

export function KhqrPaymentModal({ order, countdown, remaining, status, refreshError, error, onClose }: KhqrPaymentModalProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef(document.activeElement);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const background = Array.from(document.body.children).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.contains(dialog.current));
    const inert = background.map(element => element.inert);
    background.forEach(element => { element.inert = true; });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close.current();
      if (event.key === 'Tab') {
        event.preventDefault();
        dialog.current?.querySelector<HTMLButtonElement>('.khqr-close')?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      background.forEach((element, index) => { element.inert = inert[index]; });
      document.removeEventListener('keydown', onKeyDown);
      if (returnFocus.current instanceof HTMLElement && returnFocus.current.isConnected) returnFocus.current.focus();
    };
  }, []);

  const alert = error || refreshError;
  return createPortal(
    <div className="khqr-overlay">
      <div ref={dialog} className="khqr-modal" role="dialog" aria-modal="true" aria-label="KHQR">
        <img className="khqr-watermark" src="/assets/stussy-logo.png" alt="" aria-hidden="true" />
        <div className="khqr-modal-content">
          <button className="khqr-close" type="button" aria-label="Close KHQR" autoFocus onClick={onClose}><X aria-hidden="true" /></button>
          <p className="khqr-viewport-notice">Enlarge this window or rotate your device to view the payment code. Your order is saved; if you already paid, do not pay again.</p>
          <header className="khqr-header">
            <img className="khqr-logo" src="/assets/stussy-logo.png" alt="Stussy" />
            <p className="khqr-subtitle">Scan with your banking app to pay</p>
          </header>
          <div className="khqr-card">
            <div className="khqr-band"><img src="/assets/payment/khqr.svg" alt="" /></div>
            <div className="khqr-body">
              <div className="khqr-amount">
                <strong>Stüssy Collection</strong>
                <small>Payment Amount</small>
                <span className="khqr-amount-value">{new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(order.totalMinor / 100)} <small>{order.currency}</small></span>
              </div>
              <div className="khqr-divider" aria-hidden="true" />
              {remaining > 0
                ? <div className="khqr-code"><img src={order.payment.qrDataUrl} alt={order.mockMode ? 'Simulated Bakong KHQR payment code' : 'Bakong KHQR payment code'} width="320" height="320" /><span className="khqr-emblem"><img src="/assets/payment/bakong-emblem.png" alt="Bakong logo" /></span></div>
                : <div className="khqr-expired">
                    <p>QR expired. Checking the final payment status.</p>
                  </div>}
            </div>
          </div>
          <p className="khqr-timer"><Clock3 size={16} aria-hidden="true" />{remaining > 0 ? <span>Pay within <strong>{countdown}</strong></span> : <span>Waiting for confirmation</span>}</p>
          {order.mockMode && <p className="khqr-note">Simulation only - no money will move.</p>}
          {status === 'success'
            ? <p className="khqr-assurance is-success"><CircleCheck aria-hidden="true" />Payment Successful</p>
            : status === 'failed'
              ? <p className="khqr-assurance is-failed"><X aria-hidden="true" />Payment Failed</p>
              : status === 'unavailable'
                ? <>
                    <p className="khqr-assurance is-warning"><CircleAlert aria-hidden="true" />Payment verification is temporarily unavailable.</p>
                    <p className="khqr-note">Already paid? Do not pay again. We will confirm your payment once verification is restored.</p>
                  </>
                : <p className="khqr-assurance"><ShieldCheck aria-hidden="true" />Payment is verified automatically.</p>}
          {alert && <p role="alert" className="khqr-alert">{alert}</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
