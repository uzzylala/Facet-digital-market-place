import { withTransaction } from '../db/pool.js';

export async function markPaid(orderId, { provider, reference, last4 }) {
  return withTransaction(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE orders SET status = 'paid', paid_at = now(), payment_provider = $2, payment_ref = $3, payment_last4 = $4
       WHERE id = $1 AND status IN ('pending', 'failed')`,
      [orderId, provider, reference, last4 ?? null],
    );
    if (rowCount) {
      await db.query(
        `UPDATE products SET sales_count = sales_count + 1
         WHERE id IN (SELECT product_id FROM order_items WHERE order_id = $1)`,
        [orderId],
      );
    }
    return rowCount > 0;
  });
}
