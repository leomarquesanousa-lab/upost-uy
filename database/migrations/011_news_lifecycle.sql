-- MANUAL ONLY, after backup/review. No news or objects are deleted by this migration.
-- Existing automatic news have NO lifecycle row and remain untouched (no retroactive expiry).
CREATE TABLE news_retention_policy (
 id boolean PRIMARY KEY DEFAULT true CHECK(id),
 global_daily_limit integer NOT NULL DEFAULT 20 CHECK(global_daily_limit BETWEEN 1 AND 10000),
 min_sync_minutes integer NOT NULL DEFAULT 60 CHECK(min_sync_minutes BETWEEN 60 AND 10080),
 publication_hours integer NOT NULL DEFAULT 48 CHECK(publication_hours BETWEEN 1 AND 87600),
 recovery_days integer NOT NULL DEFAULT 7 CHECK(recovery_days BETWEEN 1 AND 3650),
 active_limit integer NOT NULL DEFAULT 500 CHECK(active_limit BETWEEN 1 AND 100000),
 cleanup_enabled boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO news_retention_policy(id) VALUES(true);
ALTER TABLE source_automation ADD COLUMN daily_limit integer NOT NULL DEFAULT 5 CHECK(daily_limit BETWEEN 1 AND 10000);
-- Keep the existing default unchanged. The application enforces the configured minimum.
CREATE INDEX source_news_items_daily ON source_news_items(created_at);
CREATE INDEX source_news_items_source_daily ON source_news_items(resource_id,created_at);
CREATE TABLE news_lifecycle (
 news_id uuid PRIMARY KEY REFERENCES news(id) ON DELETE CASCADE,
 automatic boolean NOT NULL DEFAULT false,
 permanent boolean NOT NULL DEFAULT false,
 editorial_protected boolean NOT NULL DEFAULT false,
 publication_hours integer NOT NULL DEFAULT 48,
 recovery_days integer NOT NULL DEFAULT 7,
 first_published_at timestamptz,
 expires_at timestamptz,
 trashed_at timestamptz,
 trash_reason text CHECK(trash_reason IN ('expired','manual')),
 purge_after timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_lifecycle_expiry ON news_lifecycle(expires_at) WHERE automatic AND NOT permanent;
CREATE INDEX news_lifecycle_purge ON news_lifecycle(purge_after) WHERE automatic AND NOT permanent AND NOT editorial_protected;
-- Small tombstones survive article/resource deletion, without retaining article text/photos.
CREATE TABLE news_origin_tombstones (
 canonical_url text PRIMARY KEY,
 resource_id uuid,
 source_identifier text NOT NULL,
 removed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_origin_identifier ON news_origin_tombstones(resource_id,source_identifier);
CREATE TABLE news_media_cleanup (
 path text PRIMARY KEY,
 object_key text NOT NULL,
 queued_at timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 0,
 last_error text NOT NULL DEFAULT '',
 next_attempt_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE news_cleanup_runs (
 id uuid PRIMARY KEY,
 started_at timestamptz NOT NULL DEFAULT now(),
 finished_at timestamptz,
 dry_run boolean NOT NULL,
 expired integer NOT NULL DEFAULT 0,
 removed integer NOT NULL DEFAULT 0,
 images_removed integer NOT NULL DEFAULT 0,
 errors integer NOT NULL DEFAULT 0,
 summary text NOT NULL DEFAULT ''
);
CREATE INDEX news_cleanup_runs_time ON news_cleanup_runs(started_at DESC);
CREATE INDEX audit_media_upload_entity ON audit_log(entity_id,id DESC) WHERE entity='media_assets' AND action='media.upload';
-- Add a filtered view without replacing or changing public_news or its column order.
CREATE VIEW public_news_managed AS
SELECT n.* FROM public_news n
WHERE NOT EXISTS (SELECT 1 FROM news_lifecycle l WHERE l.news_id=n.id AND
   (l.trashed_at IS NOT NULL OR (l.automatic AND NOT l.permanent AND l.expires_at<=now())));
