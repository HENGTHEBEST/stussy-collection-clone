import { existsSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { loadBakongCredentials, loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { OrderService } from './orders/order-service.js';
import { SqliteOrderRepository } from './orders/sqlite-order-repository.js';
import { createPaymentGateway } from './payments/create-payment-gateway.js';

function logStartupError(error: unknown): void {
  console.error({ errorClass: error instanceof Error ? error.constructor.name : 'UnknownError', route: 'startup', method: 'START' });
  process.exitCode = 1;
}

try {
  if (existsSync('.env.local')) loadEnvFile('.env.local');
  const config = loadConfig();
  const gateway = createPaymentGateway(config.paymentMode, loadBakongCredentials(process.env, config.paymentMode));
  if (config.sqlitePath !== ':memory:') mkdirSync(dirname(resolve(config.sqlitePath)), { recursive: true });
  const repository = new SqliteOrderRepository(config.sqlitePath);
  const service = new OrderService(repository, gateway, undefined, config.pricing, config.merchantName);
  const server = createApp({ service, config }).listen(config.port, '127.0.0.1');
  server.once('error', error => { repository.close(); logStartupError(error); });
  const shutdown = () => { server.close(() => repository.close()); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  logStartupError(error);
}
