-- Apply only after review/backup. No news, existing deadlines or R2 objects are deleted.
-- Historical 011 stays immutable; existing lifecycle rows are NOT enrolled.
ALTER TABLE news_retention_policy ADD COLUMN prospective_from timestamptz NOT NULL DEFAULT now();
ALTER TABLE news_retention_policy ALTER COLUMN publication_hours SET DEFAULT 360;
UPDATE news_retention_policy SET publication_hours=360,cleanup_enabled=false,updated_at=now();
ALTER TABLE news_retention_policy ADD CONSTRAINT news_retention_fifteen_days CHECK(publication_hours=360);
ALTER TABLE news_lifecycle ADD COLUMN retention_managed boolean NOT NULL DEFAULT false;
ALTER TABLE news_lifecycle ALTER COLUMN publication_hours SET DEFAULT 360;
CREATE INDEX news_lifecycle_managed_expiry ON news_lifecycle(expires_at) WHERE retention_managed AND NOT permanent AND NOT editorial_protected;
CREATE OR REPLACE VIEW public_news_managed AS
SELECT n.* FROM public_news n
WHERE NOT EXISTS (SELECT 1 FROM news_lifecycle l WHERE l.news_id=n.id AND
 (l.trashed_at IS NOT NULL OR (l.retention_managed AND NOT l.permanent AND NOT l.editorial_protected
  AND NOT n.featured AND n.id::text<>COALESCE((SELECT value FROM settings WHERE key='HOME_LEAD_NEWS_ID'),'')
  AND l.expires_at<=now())));
