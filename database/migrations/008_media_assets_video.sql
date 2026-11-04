ALTER TABLE media_assets
  DROP CONSTRAINT IF EXISTS media_assets_mime_type_check;

ALTER TABLE media_assets
  ADD CONSTRAINT media_assets_mime_type_check
  CHECK (
    mime_type IN (
      'image/webp',
      'image/jpeg',
      'image/png',
      'video/mp4',
      'video/webm'
    )
  );