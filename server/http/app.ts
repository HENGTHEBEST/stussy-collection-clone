import express from 'express';
import type { ErrorRequestHandler } from 'express';
import type { ServerConfig } from '../config.js';
import { OrderPricingError } from '../catalog/order-pricing.js';
import { OrderService, OrderValidationError } from '../orders/order-service.js';

export function createApp({ service, config }: { service: OrderService; config: ServerConfig }) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use((req, res, next) => {
    res.vary('Origin');
    const origin = req.get('Origin');
    if (origin && origin !== config.appOrigin) {
      res.status(403).json({ error: { code: 'origin_not_allowed', message: 'Request origin is not allowed.' } });
      return;
    }
    if (origin) res.setHeader('Access-Control-Allow-Origin', config.appOrigin);
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ready: true, paymentMode: config.paymentMode });
  });
  app.post('/api/orders', async (req, res) => {
    res.status(201).json(await service.createOrder(req.body));
  });
  app.get('/api/orders/:id', async (req, res) => {
    res.locals.orderId = req.params.id;
    const order = await service.getOrder(req.params.id);
    if (!order) { notFound(res); return; }
    res.json(order);
  });
  if (config.paymentMode === 'mock') {
    app.post('/api/orders/:id/mock-payment', async (req, res) => {
      res.locals.orderId = req.params.id;
      const order = await service.simulateSuccess(req.params.id);
      if (!order) { notFound(res); return; }
      res.json(order);
    });
  }
  app.use((_req, res) => { notFound(res); });

  const handleError: ErrorRequestHandler = (error: unknown, req, res, _next) => {
    const orderId: unknown = res.locals.orderId;
    console.error({
      errorClass: error instanceof Error ? error.constructor.name : 'UnknownError',
      route: req.route?.path ?? '/api', method: req.method,
      ...(typeof orderId === 'string' && /^[0-9a-f-]{36}$/i.test(orderId) ? { orderId } : {}),
    });
    const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
    if (error instanceof OrderValidationError || error instanceof OrderPricingError || type === 'entity.parse.failed') {
      res.status(400).json({ error: { code: 'invalid_checkout', message: 'Check the highlighted checkout information.' } });
    } else if (type === 'entity.too.large') {
      res.status(413).json({ error: { code: 'request_too_large', message: 'Checkout information is too large.' } });
    } else {
      res.status(500).json({ error: { code: 'internal_error', message: 'Unable to process the request.' } });
    }
  };
  app.use(handleError);
  return app;
}

function notFound(res: express.Response): void {
  res.status(404).json({ error: { code: 'not_found', message: 'Order or endpoint not found.' } });
}
