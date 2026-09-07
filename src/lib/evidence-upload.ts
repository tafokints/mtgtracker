import sharp from 'sharp';

import { MAX_UPLOAD_BYTES } from './evidence-policy';
export { MAX_UPLOAD_BYTES } from './evidence-policy';
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
const IMAGE_FORMATS = { 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' } as const;

export class EvidenceUploadError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readEvidenceFile(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) {
    throw new EvidenceUploadError('A multipart image upload is required', 415);
  }
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) {
    throw new EvidenceUploadError('Image must be 4 MB or smaller', 413);
  }
  const reader = request.body?.getReader();
  if (!reader) throw new EvidenceUploadError('Image file is required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new EvidenceUploadError('Image must be 4 MB or smaller', 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': contentType } }).formData();
  } catch {
    throw new EvidenceUploadError('Invalid multipart upload');
  }
  const file = form.get('file');
  if (!(file instanceof File) || form.getAll('file').length !== 1) {
    throw new EvidenceUploadError('Exactly one image file is required');
  }
  return file;
}

export async function prepareEvidenceImage(file: File) {
  if (!Object.hasOwn(IMAGE_FORMATS, file.type)) {
    throw new EvidenceUploadError('Only JPEG, PNG, and WebP images are supported');
  }
  if (file.size === 0) throw new EvidenceUploadError('Image file is empty');
  if (file.size > MAX_UPLOAD_BYTES) throw new EvidenceUploadError('Image must be 4 MB or smaller', 413);
  try {
    const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, failOn: 'warning' });
    const metadata = await input.metadata();
    if (metadata.format !== IMAGE_FORMATS[file.type as keyof typeof IMAGE_FORMATS]) {
      throw new EvidenceUploadError('Image contents do not match the file type');
    }
    if ((metadata.pages || 1) > 1) throw new EvidenceUploadError('Animated images are not supported');
    // Decode and re-encode pixels, preserving orientation but not EXIF/GPS or embedded payloads.
    const { data, info } = await input.rotate().resize({ width: 3000, height: 3000, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90 }).toBuffer({ resolveWithObject: true });
    if (data.byteLength > MAX_UPLOAD_BYTES) throw new EvidenceUploadError('Processed image is too large');
    return { data, contentType: 'image/webp', extension: 'webp', width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof EvidenceUploadError) throw error;
    throw new EvidenceUploadError('Image cannot be decoded. Use a valid JPEG, PNG, or WebP under 25 megapixels.');
  }
}
