import { loadBakongCredentials, loadConfig, loadPayWayCredentials } from './config.js';
import { createApp } from './http/app.js';
import { OrderService } from './orders/order-service.js';
import { SupabaseOrderRepository } from './orders/supabase-order-repository.js';
import { createPaymentGateway } from './payments/create-payment-gateway.js';
import { PayWayGateway } from './payments/payway-gateway.js';

export async function buildApp(env: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(env);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY!.trim();
  const repository = new SupabaseOrderRepository(config.supabaseUrl, serviceRoleKey);
  const gateway = createPaymentGateway(config.paymentMode, loadBakongCredentials(env, config.paymentMode));
  const cardCredentials = loadPayWayCredentials(env);
  const cardGateway = cardCredentials ? new PayWayGateway(cardCredentials, config.appOrigin) : undefined;
  const service = new OrderService(repository, gateway, undefined, config.pricing, config.merchantName, cardGateway);
  return createApp({ service, config });
}
