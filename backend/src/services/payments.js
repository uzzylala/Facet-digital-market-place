import { randomUUID } from 'node:crypto';

export async function charge({ amountCents, card }) {
  const number = String(card?.number ?? '').replace(/\D/g, '');

  if (amountCents === 0) return { status: 'succeeded', reference: `free_${randomUUID()}`, last4: null };
  if (number.length < 12) return { status: 'failed', reason: 'Enter a full card number.' };
  if (number === '4000000000000002') return { status: 'failed', reason: 'The card was declined. Try another card.' };

  await new Promise((r) => setTimeout(r, 600));
  return { status: 'succeeded', reference: `demo_${randomUUID()}`, last4: number.slice(-4) };
}
