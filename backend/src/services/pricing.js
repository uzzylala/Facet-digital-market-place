// export function effectivePrice(product, now = new Date()){
//     const discountActive = product.discount_percent > 0 && (!product.discount_ends_at || new Date(product.discount-ends_at) > now);
//     const percent = discountActive ? product.discount_percent : 0;
//     const final = Math.round(product.price_cents * (1 - percent / 100));
//     return {listCents: product.price_cents, finalCents: final, discountPercent: percent};
// }

// export const EFFECTIVE_PRICE_SQL = `
// ROUND(p.price_cents * (1 - (CASE WHEN p.discount_percent > 0 AND (p.discount_ends_at IS NULL OR p.discount_ends_at > now())
//                                 THEN p.discount_percent ELSE 0 END) / 100.0))::int`;

export function effectivePrice(row) {
  const listCents = Number(row.price_cents) || 0;
  const rawDiscount = Number(row.discount_percent) || 0;
  const expired = row.discount_ends_at && new Date(row.discount_ends_at) <= new Date();
  const discountPercent = rawDiscount > 0 && !expired ? rawDiscount : 0;
  const finalCents = Math.round(listCents * (1 - discountPercent / 100));

  return {
    listCents,
    finalCents,
    discountPercent,
  };
}

export const EFFECTIVE_PRICE_SQL = `
  ROUND(
    p.price_cents * (
      1 - (
        CASE
          WHEN p.discount_percent > 0 AND (p.discount_ends_at IS NULL OR p.discount_ends_at > now())
          THEN p.discount_percent
          ELSE 0
        END
      ) / 100.0
    )
  )::int
`;
