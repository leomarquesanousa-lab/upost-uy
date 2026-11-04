'use client';

import { FileUpload } from './file-upload';

export function ImageUpload({
  label,
  value,
  onChange,
  endpoint = '/api/editorial/upload',
  onBusyChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  endpoint?: string;
  onBusyChange?: (busy: boolean) => void;
}) {
  return (
    <FileUpload
      kind="image"
      onBusyChange={onBusyChange}
      label={label}
      value={value}
      onChange={onChange}
      endpoint={endpoint}
      accept="image/jpeg,image/png,image/webp"
      maxBytes={5 * 1024 * 1024}
      helperText="JPEG, PNG ou WebP · até 5 MB e 20 megapixels."
    />
  );
}
