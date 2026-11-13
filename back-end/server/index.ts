import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { buildApp } from './bootstrap.js';
import { loadConfig } from './config.js';

function logStartupError(error: unknown): void {
  console.error({ errorClass: error instanceof Error ? error.constructor.name : 'UnknownError', route: 'startup', method: 'START' });
  process.exitCode = 1;
}

try {
  if (existsSync('.env.local')) loadEnvFile('.env.local');
  const config = loadConfig();
  const app = await buildApp();
  const server = app.listen(config.port, '127.0.0.1');
  server.once('error', logStartupError);
  process.once('SIGINT', () => { server.close(); });
  process.once('SIGTERM', () => { server.close(); });
} catch (error) {
  logStartupError(error);
}
