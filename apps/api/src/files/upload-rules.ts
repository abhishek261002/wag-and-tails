// What may be uploaded, decided from the file's own bytes rather than from anything the client claims (its name,
// its content type, the `entity` it says it belongs to). Pure functions, so they are tested on their own.

export type FileKind = 'image' | 'video' | 'pdf';

export const MB = 1024 * 1024;
/** Largest accepted size per kind. */
export const MAX_BYTES: Record<FileKind, number> = { image: 10 * MB, video: 50 * MB, pdf: 10 * MB };
/** The most any upload may be; the multipart parser is configured with this so it never silently truncates. */
export const ABSOLUTE_MAX_BYTES = Math.max(...Object.values(MAX_BYTES));

/** Which kinds each upload purpose accepts. Anything not listed here is refused. */
export const ENTITY_KINDS: Record<string, readonly FileKind[]> = {
  pet: ['image'],
  user: ['image'],
  booking: ['image'],
  partner: ['image'],
  conversation: ['image'],
  support_ticket: ['image', 'pdf'],
  partner_document: ['image', 'pdf'],
  // Photos and videos of a groomer's tools, shown to staff before approval.
  partner_tool: ['image', 'video'],
};

export interface SniffedType {
  kind: FileKind;
  mime: string;
  ext: string;
}

const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to));
const startsWith = (b: Uint8Array, sig: number[]) => b.length >= sig.length && sig.every((v, i) => b[i] === v);

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);
const MP4_BRANDS = new Set(['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV', 'dash', 'mmp4', 'f4v ']);
const GPP_BRANDS = new Set(['3gp4', '3gp5', '3gp6', '3ge6', '3gg6', '3g2a']);

/** Identify a file from its leading bytes, or null when it is none of the accepted formats. */
export function sniffType(bytes: Uint8Array): SniffedType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg', ext: '.jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: 'image', mime: 'image/png', ext: '.png' };
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp', ext: '.webp' };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { kind: 'pdf', mime: 'application/pdf', ext: '.pdf' };
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'video', mime: 'video/webm', ext: '.webm' };

  // ISO base media files (HEIC photos, MP4/MOV/3GP videos): "ftyp" at byte 4, brand at byte 8.
  if (bytes.length >= 12 && ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12);
    if (HEIC_BRANDS.has(brand)) return { kind: 'image', mime: 'image/heic', ext: '.heic' };
    if (brand === 'avif') return { kind: 'image', mime: 'image/avif', ext: '.avif' };
    if (brand === 'qt  ') return { kind: 'video', mime: 'video/quicktime', ext: '.mov' };
    if (MP4_BRANDS.has(brand)) return { kind: 'video', mime: 'video/mp4', ext: '.mp4' };
    if (GPP_BRANDS.has(brand)) return { kind: 'video', mime: 'video/3gpp', ext: '.3gp' };
  }
  return null;
}

export type UploadRefusal =
  | { ok: false; status: 400 | 413 | 415; message: string }
  | { ok: true; type: SniffedType };

/**
 * Decide whether `bytes` may be stored for `entity`. `bytes` must be the whole file (or at least its start) and
 * `size` its full length.
 */
export function checkUpload(entity: string, bytes: Uint8Array, size: number): UploadRefusal {
  const allowed = ENTITY_KINDS[entity];
  if (!allowed) return { ok: false, status: 400, message: 'This kind of upload is not supported.' };
  if (size <= 0) return { ok: false, status: 400, message: 'The file is empty.' };

  const type = sniffType(bytes);
  if (!type || !allowed.includes(type.kind)) {
    const names = allowed.map((k) => (k === 'pdf' ? 'PDFs' : k === 'image' ? 'photos' : 'videos')).join(', ');
    return { ok: false, status: 415, message: `That file type is not allowed here. Please upload ${names}.` };
  }
  if (size > MAX_BYTES[type.kind]) {
    return { ok: false, status: 413, message: `That ${type.kind} is too large (limit ${Math.round(MAX_BYTES[type.kind] / MB)} MB).` };
  }
  return { ok: true, type };
}

/** A value safe to put in a file name: letters, digits, dash and underscore only. */
export function safeSegment(value: unknown, fallback = 'x', max = 40): string {
  const s = typeof value === 'string' ? value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, max) : '';
  return s || fallback;
}

/** The client's file name, for display only: no path, no control characters, bounded length. */
export function displayName(name: unknown): string {
  const base = typeof name === 'string' ? name.split(/[\\/]/).pop() ?? '' : '';
  return base.replace(/[^\w.\- ()]/g, '_').slice(0, 120) || 'upload';
}
