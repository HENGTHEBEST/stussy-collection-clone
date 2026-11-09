import { existsSync, mkdirSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { dirname, resolve } from 'node:path';
import { loadConfig } from './config.js';
import { createApp } from './http/app.js';
import { OrderService } from './orders/order-service.js';
import { SqliteOrderRepository } from './orders/sqlite-order-repository.js';
import { MockBakongGateway } from './payments/mock-bakong-gateway.js';

class UnsupportedPaymentModeError extends Error {}

function logStartupError(error: unknown): void {
  console.error({ errorClass: error instanceof Error ? error.constructor.name : 'UnknownError', route: 'startup', method: 'START' });
  process.exitCode = 1;
}

try {
  if (existsSync('.env.local')) loadEnvFile('.env.local');
  const config = loadConfig();
  // Real adapters require a separate implementation and acceptance tests before activation.
  if (config.paymentMode !== 'mock') throw new UnsupportedPaymentModeError();
  if (config.sqlitePath !== ':memory:') mkdirSync(dirname(resolve(config.sqlitePath)), { recursive: true });
  const repository = new SqliteOrderRepository(config.sqlitePath);
  const service = new OrderService(repository, new MockBakongGateway());
  const server = createApp({ service, config }).listen(config.port, '127.0.0.1');
  server.once('error', error => { repository.close(); logStartupError(error); });
  const shutdown = () => { server.close(() => repository.close()); };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
} catch (error) {
  logStartupError(error);
}
