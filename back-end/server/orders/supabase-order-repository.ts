import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CreateStoredOrderInput, OrderRepository, StoredOrder } from './order-repository.js';

type RpcClient = Pick<SupabaseClient, 'rpc'>;

export class SupabaseOrderRepository implements OrderRepository {
  private readonly client: RpcClient;

  constructor(url: string, serviceRoleKey: string, client: RpcClient = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })) {
    this.client = client;
  }

  async createOrder(input: CreateStoredOrderInput): Promise<StoredOrder> {
    const order = await this.rpcOrder('create_order', { payload: input });
    if (!order) throw new Error('Order storage is unavailable.');
    return order;
  }

  async findById(id: string): Promise<StoredOrder | null> {
    return this.rpcOrder('get_order', { target_id: id });
  }

  async findByRequestId(requestId: string): Promise<StoredOrder | null> {
    return this.rpcOrder('get_order_by_request_id', { target_request_id: requestId });
  }

  async findByProviderReference(providerReference: string): Promise<StoredOrder | null> {
    return this.rpcOrder('get_order_by_provider_reference', { target_reference: providerReference });
  }

  async markPaid(id: string, transactionHash: string, updatedAt: string): Promise<boolean> {
    return this.rpcBoolean('mark_order_paid', { target_id: id, target_hash: transactionHash, changed_at: updatedAt });
  }

  async markFailed(id: string, updatedAt: string): Promise<boolean> {
    return this.rpcBoolean('mark_order_unpaid', { target_id: id, target_status: 'failed', changed_at: updatedAt });
  }

  async markExpired(id: string, updatedAt: string): Promise<boolean> {
    return this.rpcBoolean('mark_order_unpaid', { target_id: id, target_status: 'expired', changed_at: updatedAt });
  }

  async close(): Promise<void> {}

  private async rpcOrder(name: string, args: Record<string, unknown>): Promise<StoredOrder | null> {
    const data = await this.rpc(name, args);
    return data === null ? null : data as StoredOrder;
  }

  private async rpcBoolean(name: string, args: Record<string, unknown>): Promise<boolean> {
    const data = await this.rpc(name, args);
    return data === true;
  }

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const { data, error } = await this.client.rpc(name, args);
      if (error) throw error;
      return data;
    } catch {
      throw new Error('Order storage is unavailable.');
    }
  }
}
