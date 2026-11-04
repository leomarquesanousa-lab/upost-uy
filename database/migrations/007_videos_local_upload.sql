ALTER TABLE videos
  DROP CONSTRAINT IF EXISTS videos_source_check;

ALTER TABLE videos
  ADD CONSTRAINT videos_source_check
  CHECK (source IN ('YOUTUBE', 'VIMEO', 'EXTERNAL', 'LOCAL'));