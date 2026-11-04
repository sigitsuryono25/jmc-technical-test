-- Skema database Aplikasi Pengelolaan Barang (PostgreSQL / Supabase)
-- Jalankan lewat `npm run db:setup` atau tempel di SQL Editor Supabase.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  role          VARCHAR(20)  NOT NULL CHECK (role IN ('admin', 'operator')),
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(100) NOT NULL,
  is_locked     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(10)  NOT NULL UNIQUE,
  name       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sub_categories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER      NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  name        VARCHAR(100) NOT NULL,
  price_limit NUMERIC(16, 2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_ins (
  id              SERIAL PRIMARY KEY,
  operator_id     INTEGER      NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  category_id     INTEGER      NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  sub_category_id INTEGER      NOT NULL REFERENCES sub_categories (id) ON DELETE RESTRICT,
  origin          VARCHAR(200) NOT NULL,
  recipient       VARCHAR(100),
  unit            VARCHAR(100),
  letter_number   VARCHAR(100),
  attachment_path TEXT,
  attachment_name TEXT,
  total_price     NUMERIC(16, 2) NOT NULL DEFAULT 0,
  is_verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_in_items (
  id           SERIAL PRIMARY KEY,
  stock_in_id  INTEGER        NOT NULL REFERENCES stock_ins (id) ON DELETE CASCADE,
  code         VARCHAR(30),
  name         VARCHAR(200)   NOT NULL,
  price        NUMERIC(16, 2) NOT NULL,
  quantity     INTEGER        NOT NULL,
  unit         VARCHAR(40)    NOT NULL,
  total        NUMERIC(16, 2) NOT NULL,
  expired_date DATE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- Migrasi untuk database yang sudah terlanjur dibuat sebelum kolom ini ada.
ALTER TABLE stock_ins ADD COLUMN IF NOT EXISTS recipient VARCHAR(100);
ALTER TABLE stock_ins ADD COLUMN IF NOT EXISTS unit VARCHAR(100);
ALTER TABLE stock_in_items ADD COLUMN IF NOT EXISTS code VARCHAR(30);

CREATE INDEX IF NOT EXISTS idx_sub_categories_category ON sub_categories (category_id);
CREATE INDEX IF NOT EXISTS idx_stock_ins_created_at ON stock_ins (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_ins_category ON stock_ins (category_id);
CREATE INDEX IF NOT EXISTS idx_stock_ins_sub_category ON stock_ins (sub_category_id);
CREATE INDEX IF NOT EXISTS idx_stock_in_items_stock_in ON stock_in_items (stock_in_id);
