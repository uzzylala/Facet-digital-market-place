import { effectivePrice } from './pricing.js';

export const mediaUrl = (key) => (key ? `/api/media/${key}` : null);

export const PRODUCT_COLUMNS = `
  p.id, p.slug, p.title, p.tagline, p.tags, p.price_cents, p.discount_percent, p.discount_ends_at,
  p.thumbnail_key, p.rating_avg, p.rating_count, p.sales_count, p.status, p.created_at, p.updated_at,
  c.slug AS category_slug, c.name AS category_name,
  s.id AS seller_id, COALESCE(s.store_name, s.name) AS seller_name
`;

export const PRODUCT_JOINS = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  JOIN profiles s ON s.id = p.seller_id
`;

export function serializeProduct(row) {
  const price = effectivePrice(row);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tagline: row.tagline,
    tags: row.tags ?? [],
    price: { ...price, isFree: price.finalCents === 0, discountEndsAt: row.discount_ends_at },
    thumbnailUrl: mediaUrl(row.thumbnail_key),
    rating: Number(row.rating_avg) || 0,
    ratingCount: row.rating_count || 0,
    salesCount: row.sales_count || 0,
    status: row.status,
    category: row.category_slug ? { slug: row.category_slug, name: row.category_name } : null,
    seller: { id: row.seller_id, name: row.seller_name },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function serializeProductDetail(row) {
  return {
    ...serializeProduct(row),
    description: row.description,
    features: row.features ?? [],
    targetAudience: row.target_audience,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    version: row.version,
    file: row.file_key ? { name: row.file_name, size: row.file_size } : null,
    screenshots: (row.screenshot_keys ?? []).map((key) => ({ key, url: mediaUrl(key) })),
    thumbnailKey: row.thumbnail_key,
    viewCount: row.view_count || 0,
    seller: {
      id: row.seller_id,
      name: row.seller_name,
      bio: row.seller_bio,
      avatarUrl: row.seller_avatar,
    },
  };
}
