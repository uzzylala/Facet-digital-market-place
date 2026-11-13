CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION tags_to_text(TEXT[]) RETURNS TEXT
    LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT array_to_string($1, ' ') $$;


CREATE TABLE IF NOT EXISTS profiles (
    id          TEXT PRIMARY KEY,
    email       TEXT,
    name        TEXT,
    avatar_url  TEXT,
    is_seller   BOOLEAN NOT NULL DEFAULT FALSE,
    store_name  TEXT,
    bio         TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    slug        TEXT UNIQUE NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_id        TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    category_id      INT REFERENCES categories(id) ON DELETE SET NULL,
    slug             TEXT UNIQUE NOT NULL,
    title            TEXT NOT NULL,
    tagline          TEXT,
    description      TEXT,
    features         TEXT[] NOT NULL DEFAULT '{}',
    tags             TEXT[] NOT NULL DEFAULT '{}',
    target_audience  TEXT,
    seo_title        TEXT,
    seo_description  TEXT,
    price_cents      INT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    discount_percent INT NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 90),
    discount_ends_at TIMESTAMPTZ,
    status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    version          TEXT DEFAULT '1.0.0',
    file_key         TEXT,
    file_name        TEXT,
    file_size        BIGINT,
    thumbnail_key    TEXT,
    screenshot_keys  TEXT[] NOT NULL DEFAULT '{}',
    sales_count      INT NOT NULL DEFAULT 0,
    view_count       INT NOT NULL DEFAULT 0,
    rating_avg       NUMERIC(3,2) NOT NULL DEFAULT 0,
    rating_count     INT NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    search           TSVECTOR GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(tagline, '')), 'B') ||
        setweight(to_tsvector('english', tags_to_text(tags)), 'B') ||
        setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED
);

CREATE INDEX IF NOT EXISTS products_search_idx ON products USING GIN (search);
CREATE INDEX IF NOT EXISTS products_tags_idx ON products USING GIN (tags);
CREATE INDEX IF NOT EXISTS products_category_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_seller_id_idx ON products (seller_id);
CREATE INDEX IF NOT EXISTS products_status_idx ON products (status);

CREATE TABLE IF NOT EXISTS wishlist_items (
    user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS orders (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number   TEXT UNIQUE NOT NULL,
    buyer_id         TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal_cents   INT NOT NULL,
    discount_cents   INT NOT NULL DEFAULT 0,
    total_cents      INT NOT NULL,
    payment_provider TEXT NOT NULL DEFAULT 'demo',
    payment_ref      TEXT,
    payment_last4    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS orders_buyer_idx ON orders (buyer_id);

CREATE TABLE IF NOT EXISTS order_items (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id       UUID NOT NULL REFERENCES products(id),
    seller_id        TEXT NOT NULL REFERENCES profiles(id),
    title            TEXT NOT NULL,
    unit_price_cents INT NOT NULL,
    list_price_cents INT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_idx ON order_items (product_id);
CREATE INDEX IF NOT EXISTS order_items_seller_idx ON order_items (seller_id);


CREATE TABLE IF NOT EXISTS reviews (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id    TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rating     INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title      TEXT,
    body       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS reviews_product_idx ON reviews (product_id);

CREATE TABLE IF NOT EXISTS download_events (
    id              BIGSERIAL PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
)
