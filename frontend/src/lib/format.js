const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdRound = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (cents) => usd.format((cents ?? 0) / 100);
export const moneyShort = (cents) => ((cents ?? 0) % 100 === 0 ? usdRound.format(cents / 100) : money(cents));
export const priceLabel = (price) => (price.isFree ? 'Free' : moneyShort(price.finalCents));

export const compact = (n) => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0);

export const date = (value) =>
  value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

export const dateTime = (value) =>
  value ? new Date(value).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

export function timeAgo(value) {
  const s = (Date.now() - new Date(value).getTime()) / 1000;
  if (s < 60) return 'just now';
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, secs] of units) {
    if (s >= secs) {
      const n = Math.floor(s / secs);
      return `${n} ${unit}${n > 1 ? 's' : ''} ago`;
    }
  }
  return '';
}

export const fileSize = (bytes) => {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const initials = (name = '') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '◆';

export const cx = (...parts) => parts.filter(Boolean).join(' ');
