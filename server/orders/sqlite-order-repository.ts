import { DatabaseSync } from 'node:sqlite';
import type { PublicOrderLine } from '../../shared/commerce';
import type {
  CreateStoredOrderInput, OrderRepository, StoredOrder, StoredPaymentAttempt,
} from './order-repository';

type OrderRow = Omit<StoredOrder, 'customer' | 'address' | 'lines' | 'payment' | 'mockMode'>
  & Omit<StoredPaymentAttempt, 'status'> & {
  customerJson: string;
  addressJson: string;
  mockMode: number;
  paymentStatus: StoredPaymentAttempt['status'];
};

export class SqliteOrderRepository implements OrderRepository {
  private readonly database: DatabaseSync;

  constructor(path: string) {
    this.database = new DatabaseSync(path);
    this.database.exec('PRAGMA foreign_keys = ON');
    if (path !== ':memory:') this.database.exec('PRAGMA journal_mode = WAL');
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY NOT NULL,
        request_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('awaiting_payment', 'paid', 'failed', 'expired', 'cancelled')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        customer_json TEXT NOT NULL,
        address_json TEXT NOT NULL,
        delivery TEXT NOT NULL CHECK (delivery IN ('standard', 'express')),
        delivery_label TEXT NOT NULL,
        currency TEXT NOT NULL CHECK (currency = 'USD'),
        subtotal_minor INTEGER NOT NULL,
        shipping_minor INTEGER NOT NULL,
        total_minor INTEGER NOT NULL,
        mock_mode INTEGER NOT NULL CHECK (mock_mode IN (0, 1))
      ) STRICT;
      CREATE TABLE IF NOT EXISTS order_lines (
        order_id TEXT NOT NULL REFERENCES orders(id),
        position INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        image TEXT NOT NULL,
        size TEXT NOT NULL,
        color TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price_minor INTEGER NOT NULL,
        PRIMARY KEY (order_id, position)
      ) STRICT;
      CREATE TABLE IF NOT EXISTS payment_attempts (
        order_id TEXT PRIMARY KEY NOT NULL REFERENCES orders(id),
        status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'expired')),
        qr_data_url TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        provider_reference TEXT NOT NULL,
        qr_payload TEXT NOT NULL,
        md5 TEXT NOT NULL,
        transaction_hash TEXT
      ) STRICT;
      CREATE UNIQUE INDEX IF NOT EXISTS payment_transaction_hash
        ON payment_attempts(transaction_hash) WHERE transaction_hash IS NOT NULL;
    `);
  }

  createOrder(input: CreateStoredOrderInput): StoredOrder {
    return this.transaction(() => {
      const existing = this.findByRequestId(input.requestId);
      if (existing) return existing;

      this.database.prepare(`
        INSERT INTO orders (id, request_id, status, created_at, updated_at, customer_json,
          address_json, delivery, delivery_label, currency, subtotal_minor, shipping_minor,
          total_minor, mock_mode)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.id, input.requestId, input.status, input.createdAt, input.updatedAt,
        JSON.stringify(input.customer), JSON.stringify(input.address), input.delivery,
        input.deliveryLabel, input.currency, input.subtotalMinor, input.shippingMinor,
        input.totalMinor, Number(input.mockMode));

      const insertLine = this.database.prepare(`
        INSERT INTO order_lines (order_id, position, product_id, slug, name, image, size,
          color, quantity, unit_price_minor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.lines.forEach((line, position) => {
        insertLine.run(input.id, position, line.productId, line.slug, line.name,
          line.image, line.size, line.color, line.quantity, line.unitPriceMinor);
      });

      const payment = input.payment;
      this.database.prepare(`
        INSERT INTO payment_attempts (order_id, status, qr_data_url, expires_at,
          provider_reference, qr_payload, md5, transaction_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(input.id, payment.status, payment.qrDataUrl, payment.expiresAt,
        payment.providerReference, payment.qrPayload, payment.md5, payment.transactionHash);

      return this.findById(input.id)!;
    });
  }

  findById(id: string): StoredOrder | null {
    const row = this.database.prepare(`
      SELECT orders.id, request_id AS requestId, orders.status, created_at AS createdAt, updated_at AS updatedAt,
        customer_json AS customerJson, address_json AS addressJson, delivery,
        delivery_label AS deliveryLabel, currency, subtotal_minor AS subtotalMinor,
        shipping_minor AS shippingMinor, total_minor AS totalMinor, mock_mode AS mockMode,
        payment_attempts.status AS paymentStatus, qr_data_url AS qrDataUrl, expires_at AS expiresAt,
        provider_reference AS providerReference, qr_payload AS qrPayload, md5, transaction_hash AS transactionHash
      FROM orders JOIN payment_attempts ON payment_attempts.order_id = orders.id WHERE orders.id = ?
    `).get(id) as OrderRow | undefined;
    if (!row) return null;

    const lines = this.database.prepare(`
      SELECT product_id AS productId, slug, name, image, size, color, quantity,
        unit_price_minor AS unitPriceMinor FROM order_lines WHERE order_id = ? ORDER BY position
    `).all(id) as unknown as PublicOrderLine[];
    const { customerJson, addressJson, mockMode, paymentStatus, qrDataUrl, expiresAt,
      providerReference, qrPayload, md5, transactionHash, ...order } = row;
    return {
      ...order,
      customer: JSON.parse(customerJson),
      address: JSON.parse(addressJson),
      mockMode: Boolean(mockMode),
      lines,
      payment: { status: paymentStatus, qrDataUrl, expiresAt, providerReference, qrPayload, md5, transactionHash },
    };
  }

  findByRequestId(requestId: string): StoredOrder | null {
    const row = this.database.prepare('SELECT id FROM orders WHERE request_id = ?').get(requestId);
    return row ? this.findById(row.id as string) : null;
  }

  markPaid(id: string, transactionHash: string, updatedAt: string): boolean {
    return this.transaction(() => {
      const order = this.findById(id);
      if (!order) return false;
      if (order.status === 'paid') return order.payment.transactionHash === transactionHash;
      const result = this.database.prepare(`
        UPDATE orders SET status = 'paid', updated_at = ? WHERE id = ? AND status = 'awaiting_payment'
      `).run(updatedAt, id);
      if (result.changes === 0) return false;
      const paymentResult = this.database.prepare(`
        UPDATE payment_attempts SET status = 'paid', transaction_hash = ?
        WHERE order_id = ? AND status = 'pending'
      `).run(transactionHash, id);
      if (paymentResult.changes === 0) throw new Error('Payment status does not allow this transition.');
      return true;
    });
  }

  markFailed(id: string, updatedAt: string): boolean {
    return this.markUnpaid(id, 'failed', updatedAt);
  }

  markExpired(id: string, updatedAt: string): boolean {
    return this.markUnpaid(id, 'expired', updatedAt);
  }

  close(): void {
    if (this.database.isOpen) this.database.close();
  }

  private markUnpaid(id: string, status: 'failed' | 'expired', updatedAt: string): boolean {
    return this.transaction(() => {
      const order = this.findById(id);
      if (!order) return false;
      if (order.status === 'paid') throw new Error('Cannot change a paid order.');
      if (order.status === status) return true;
      const result = this.database.prepare(`
        UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_payment'
      `).run(status, updatedAt, id);
      if (result.changes === 0) return false;
      const paymentResult = this.database.prepare(`
        UPDATE payment_attempts SET status = ? WHERE order_id = ? AND status = 'pending'
      `).run(status, id);
      if (paymentResult.changes === 0) throw new Error('Payment status does not allow this transition.');
      return true;
    });
  }

  private transaction<T>(action: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}
