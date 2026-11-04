import 'server-only';
import { fetchRemoteImage } from '@/lib/security/remote-page.mjs';
import { persistEditorialImage } from './editorial-media';

export async function importEditorialImage(url: string, userId: string) {
  const image = await fetchRemoteImage(url);
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[image.mimeType as string];
  return persistEditorialImage({ bytes: image.bytes, filename: `import.${extension}`, mimeType: image.mimeType }, userId, {
    sourceType: 'import', sourceHost: new URL(image.url).hostname,
  });
}
