ALTER TABLE news ADD COLUMN source_name varchar(200) NOT NULL DEFAULT '';
ALTER TABLE news ADD COLUMN source_url text NOT NULL DEFAULT '';
-- A view da 002 captura a lista de colunas no momento da criação.
CREATE OR REPLACE VIEW public_news AS
SELECT n.id,n.title,n.slug,n.subtitle,n.excerpt,n.body,n.cover_image,n.cover_alt,
  n.cover_caption,n.cover_credit,n.author_id,n.status,n.published_at,n.scheduled_at,
  n.featured,n.seo_title,n.seo_description,n.canonical_url,n.created_by,n.updated_by,
  n.created_at,n.updated_at,n.version,
  CASE WHEN status='SCHEDULED' THEN scheduled_at ELSE published_at END AS visible_at,
  n.source_name,n.source_url
FROM news n WHERE (status='PUBLISHED' AND published_at<=now()) OR (status='SCHEDULED' AND scheduled_at<=now());

CREATE TABLE song_requests (
  id uuid PRIMARY KEY,
  name varchar(100) NOT NULL,
  song varchar(200) NOT NULL,
  message varchar(600) NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'NEW' CHECK (status='NEW'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX song_requests_created_idx ON song_requests(created_at DESC);
CREATE TABLE request_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now()
);
