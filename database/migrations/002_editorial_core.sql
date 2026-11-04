CREATE TABLE categories (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE authors (
  id uuid PRIMARY KEY,
  name varchar(120) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio text NOT NULL DEFAULT '',
  photo_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE media_assets (
  id uuid PRIMARY KEY,
  path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type = 'image/webp'),
  size integer NOT NULL CHECK (size > 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE news (
  id uuid PRIMARY KEY,
  title varchar(240) NOT NULL,
  slug varchar(180) NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  subtitle varchar(400) NOT NULL DEFAULT '',
  excerpt varchar(600) NOT NULL DEFAULT '',
  body text NOT NULL,
  cover_image text NOT NULL DEFAULT '',
  cover_alt varchar(300) NOT NULL DEFAULT '',
  cover_caption varchar(500) NOT NULL DEFAULT '',
  cover_credit varchar(200) NOT NULL DEFAULT '',
  author_id uuid NOT NULL REFERENCES authors(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  scheduled_at timestamptz,
  featured boolean NOT NULL DEFAULT false,
  seo_title varchar(120) NOT NULL DEFAULT '',
  seo_description varchar(300) NOT NULL DEFAULT '',
  canonical_url text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1,
  CHECK (status <> 'PUBLISHED' OR published_at IS NOT NULL),
  CHECK (status <> 'SCHEDULED' OR scheduled_at IS NOT NULL)
);

CREATE TABLE news_categories (
  news_id uuid NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  PRIMARY KEY (news_id, category_id)
);
CREATE INDEX news_categories_category_idx ON news_categories(category_id,news_id);
CREATE INDEX news_author_idx ON news(author_id);
CREATE INDEX news_publication_idx ON news(status,published_at DESC,scheduled_at DESC);
CREATE INDEX news_featured_idx ON news(featured) WHERE featured;
CREATE INDEX news_search_idx ON news USING gin (
  to_tsvector('portuguese', title || ' ' || subtitle || ' ' || excerpt)
);

-- Um único critério de visibilidade para home, busca, notícia e sitemap.
CREATE VIEW public_news AS
SELECT n.*, CASE WHEN status='SCHEDULED' THEN scheduled_at ELSE published_at END AS visible_at
FROM news n
WHERE (status='PUBLISHED' AND published_at <= now())
   OR (status='SCHEDULED' AND scheduled_at <= now());
