import sharp from 'sharp';
import type { SniffedType } from './upload-rules.js';

/** Longest side of a stored photo. Enough for full-screen viewing on any phone; photos are never enlarged. */
export const MAX_IMAGE_DIMENSION = 1600;
export const JPEG_QUALITY = 80;
export const WEBP_QUALITY = 80;

export class UnreadableImageError extends Error {}

export interface CompressedImage {
  buffer: Buffer;
  type: SniffedType;
  /** Size before and after, for logging. */
  before: number;
  after: number;
}

/**
 * Shrinks an uploaded photo before it is stored: fixes the orientation from EXIF, scales it down to at most
 * MAX_IMAGE_DIMENSION px on the longest side, re-encodes it, and drops all metadata (including GPS location).
 * JPEG stays JPEG and WebP stays WebP; a PNG becomes a JPEG unless it has transparency. HEIC and AVIF photos are
 * stored as they are (the phone apps already send JPEG). Throws UnreadableImageError when the bytes are not a
 * decodable image, so a corrupt or disguised file is refused instead of stored.
 */
export async function compressImage(input: Buffer, type: SniffedType): Promise<CompressedImage> {
  if (type.kind !== 'image' || !['image/jpeg', 'image/png', 'image/webp'].includes(type.mime)) {
    return { buffer: input, type, before: input.length, after: input.length };
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(input, { failOn: 'error' }).metadata();
  } catch {
    throw new UnreadableImageError('That image could not be read. Please choose another photo.');
  }
  if (!meta.width || !meta.height) throw new UnreadableImageError('That image could not be read. Please choose another photo.');
  // Refuse absurd dimensions up front (decompression bombs) rather than spending memory on them.
  if (meta.width * meta.height > 100_000_000) throw new UnreadableImageError('That image is too large to process.');

  const pipeline = sharp(input, { failOn: 'error', limitInputPixels: 100_000_000 })
    .rotate() // apply EXIF orientation, then the orientation tag is dropped with the rest of the metadata
    .resize({ width: MAX_IMAGE_DIMENSION, height: MAX_IMAGE_DIMENSION, fit: 'inside', withoutEnlargement: true });

  let out: Buffer;
  let outType: SniffedType;
  try {
    if (type.mime === 'image/webp') {
      out = await pipeline.webp({ quality: WEBP_QUALITY }).toBuffer();
      outType = type;
    } else if (type.mime === 'image/png' && meta.hasAlpha) {
      out = await pipeline.png({ compressionLevel: 9, palette: true, quality: 85 }).toBuffer();
      outType = type;
    } else {
      // JPEG, and PNG photos without transparency (screenshots, camera exports): JPEG is far smaller.
      out = await pipeline.flatten({ background: '#ffffff' }).jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer();
      outType = { kind: 'image', mime: 'image/jpeg', ext: '.jpg' };
    }
  } catch {
    throw new UnreadableImageError('That image could not be read. Please choose another photo.');
  }

  return { buffer: out, type: outType, before: input.length, after: out.length };
}
