-- Apply manually after review and backup. No existing resources/news are changed.
CREATE TABLE source_automation (
 resource_id uuid PRIMARY KEY REFERENCES portal_resources(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false,
 interval_minutes integer NOT NULL DEFAULT 30 CHECK(interval_minutes BETWEEN 15 AND 1440),
 max_items integer NOT NULL DEFAULT 3 CHECK(max_items BETWEEN 1 AND 10),
 publication_mode text NOT NULL DEFAULT 'review' CHECK(publication_mode IN ('review','automatic')),
 content_mode text NOT NULL DEFAULT 'summary' CHECK(content_mode IN ('summary','full')),
 keywords text NOT NULL DEFAULT '',
 last_sync_at timestamptz,
 next_sync_at timestamptz NOT NULL DEFAULT now(),
 last_title text NOT NULL DEFAULT '',
 last_found_count integer NOT NULL DEFAULT 0,
 last_status text NOT NULL DEFAULT 'pending',
 last_error text NOT NULL DEFAULT '',
 imported_count integer NOT NULL DEFAULT 0,
 duplicate_count integer NOT NULL DEFAULT 0
);
CREATE TABLE source_news_items (
 resource_id uuid NOT NULL REFERENCES portal_resources(id) ON DELETE CASCADE,
 source_identifier text NOT NULL,
 canonical_url text NOT NULL UNIQUE,
 news_id uuid REFERENCES news(id) ON DELETE SET NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(resource_id,source_identifier)
);
CREATE TABLE source_sync_runs (
 id uuid PRIMARY KEY,
 resource_id uuid NOT NULL REFERENCES portal_resources(id) ON DELETE CASCADE,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 status text NOT NULL DEFAULT 'running',
 imported integer NOT NULL DEFAULT 0,
 duplicates integer NOT NULL DEFAULT 0,
 errors integer NOT NULL DEFAULT 0,
 message text NOT NULL DEFAULT ''
);
CREATE INDEX source_sync_runs_resource_time ON source_sync_runs(resource_id,started_at DESC);
CREATE INDEX source_news_items_news ON source_news_items(news_id);
CREATE INDEX news_source_url_idx ON news(source_url);
CREATE INDEX news_canonical_url_idx ON news(canonical_url);
