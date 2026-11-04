import sharp from 'sharp';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export async function normalizeImage(buffer, filename, mime) {
  const extension = filename.split('.').pop()?.toLowerCase();
  const formats = { 'image/jpeg': ['jpg','jpeg'], 'image/png': ['png'], 'image/webp': ['webp'] };
  if (!formats[mime]?.includes(extension) || !buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('Envie JPEG, PNG ou WebP de até 5 MB.');
  const image = sharp(buffer, { limitInputPixels: 20000000, failOn: 'warning', animated: false });
  const metadata = await image.metadata();
  const expected = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[mime];
  if (metadata.format !== expected || (metadata.pages || 1) > 1) throw new Error('Formato de imagem inválido.');
  return image.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
}
