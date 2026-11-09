export interface ServerConfig {
  port: number;
  appOrigin: string;
  paymentMode: 'mock' | 'sit' | 'production';
  merchantName: string;
  merchantCity: string;
  bakongAccountId: string;
  currency: 'USD';
  sqlitePath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  function text(key: string, fallback: string): string {
    const value = (env[key] ?? fallback).trim();
    if (!value) throw new Error('Invalid server setting: ' + key);
    return value;
  }
  const portText = text('API_PORT', '8787');
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('Invalid server setting: API_PORT');
  }
  const appOrigin = text('APP_ORIGIN', 'http://localhost:5173');
  let origin: URL;
  try { origin = new URL(appOrigin); } catch { throw new Error('Invalid server setting: APP_ORIGIN'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.origin !== appOrigin) {
    throw new Error('Invalid server setting: APP_ORIGIN');
  }
  const paymentMode = text('PAYMENT_MODE', 'mock');
  if (paymentMode !== 'mock' && paymentMode !== 'sit' && paymentMode !== 'production') {
    throw new Error('Invalid server setting: PAYMENT_MODE');
  }
  if (paymentMode !== 'mock' && !env.BAKONG_API_TOKEN?.trim()) {
    throw new Error('BAKONG_API_TOKEN is required for non-mock payment modes.');
  }
  const currency = text('ORDER_CURRENCY', 'USD');
  if (currency !== 'USD') throw new Error('Invalid server setting: ORDER_CURRENCY');
  return {
    port, appOrigin, paymentMode, currency,
    merchantName: text('MERCHANT_NAME', 'Stussy Collection Showcase'),
    merchantCity: text('MERCHANT_CITY', 'Phnom Penh'),
    bakongAccountId: text('BAKONG_ACCOUNT_ID', 'demo@mock'),
    sqlitePath: text('SQLITE_PATH', './data/store.sqlite'),
  };
}
