'use client';

import { FileUpload } from '@/components/editorial/file-upload';

export function VideoUpload({
  label,
  value,
  onChange,
  endpoint = '/api/videos/upload',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  endpoint?: string;
}) {
  return (
    <FileUpload
      kind="video"
      label={label}
      value={value}
      onChange={onChange}
      endpoint={endpoint}
      accept="video/mp4,video/webm"
      maxBytes={100 * 1024 * 1024}
      helperText="MP4 ou WebM · até 100 MB."
    />
  );
}