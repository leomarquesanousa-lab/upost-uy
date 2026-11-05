-- Apply manually after review. No seed data and no scheduled jobs.
CREATE TABLE portal_resources (
  id uuid PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('partner','radio','source')),
  name varchar(200) NOT NULL,
  url text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  media_type varchar(100) NOT NULL DEFAULT '',
  stream_url text NOT NULL DEFAULT '',
  feed_url text NOT NULL DEFAULT '',
  category_slug varchar(180) NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(kind,url)
);
CREATE INDEX portal_resources_public ON portal_resources(kind,display_order,name) WHERE active;
-- Match the Spanish search expression without removing the legacy index.
CREATE INDEX news_search_es_idx ON news USING gin (
  to_tsvector('spanish', title || ' ' || subtitle || ' ' || excerpt)
);
-- New placements only; no advertisers or campaigns are created.
INSERT INTO ad_slots(id,code,name,description,active) VALUES
 ('00900000-0000-4000-8000-000000000001','HOME_TOP','Inicio — superior','Encima de las noticias principales.',false),
 ('00900000-0000-4000-8000-000000000002','HOME_SIDEBAR','Inicio — lateral','Columna de noticias complementarias.',false)
ON CONFLICT(code) DO NOTHING;
