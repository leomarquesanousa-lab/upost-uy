CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY,
  title varchar(180) NOT NULL,
  slug varchar(200) NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  thumbnail_url varchar(200) NOT NULL DEFAULT '',
  video_url text NOT NULL,
  source varchar(20) NOT NULL DEFAULT 'EXTERNAL',
  status varchar(20) NOT NULL DEFAULT 'DRAFT',
  featured boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  seo_title varchar(180) NOT NULL DEFAULT '',
  seo_description varchar(320) NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT videos_source_check
    CHECK (source IN ('YOUTUBE', 'VIMEO', 'EXTERNAL')),

  CONSTRAINT videos_status_check
    CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'))
);

CREATE INDEX IF NOT EXISTS videos_status_idx
  ON videos(status);

CREATE INDEX IF NOT EXISTS videos_published_at_idx
  ON videos(published_at DESC);

CREATE INDEX IF NOT EXISTS videos_featured_idx
  ON videos(featured)
  WHERE featured = true;

CREATE INDEX IF NOT EXISTS videos_deleted_at_idx
  ON videos(deleted_at);