import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { prepareEvidenceImage, readEvidenceFile } from '@/lib/evidence-upload';

describe('evidence image processing', () => {
  it('removes EXIF metadata and keeps orientation and readable pixels', async () => {
    const buffer = await sharp({ create: { width: 32, height: 24, channels: 3, background: '#00aa88' } })
      .jpeg().withMetadata({ orientation: 6 }).withExif({ IFD0: { Artist: 'Private owner' } }).toBuffer();
    const image = await prepareEvidenceImage(new File([new Uint8Array(buffer)], 'private.jpg', { type: 'image/jpeg' }));
    const metadata = await sharp(image.data).metadata();
    expect(metadata).toMatchObject({ format: 'webp', width: 24, height: 32 });
    expect(metadata.exif).toBeUndefined();
    expect(metadata.xmp).toBeUndefined();
    expect(image.data.includes(Buffer.from('Private owner'))).toBe(false);
    const stats = await sharp(image.data).stats();
    expect(stats.channels[1].mean).toBeGreaterThan(100);
  });

  it('rejects images above the pixel limit before decoding', async () => {
    const buffer = await sharp({ create: { width: 6000, height: 5000, channels: 3, background: '#fff' } }).png().toBuffer();
    await expect(prepareEvidenceImage(new File([new Uint8Array(buffer)], 'large.png', { type: 'image/png' }))).rejects.toThrow('25 megapixels');
  });

  it('bounds a multipart body even when Content-Length is absent', async () => {
    const request = new Request('https://mtgtrackers.com/upload', { method: 'POST', headers: { 'content-type': 'multipart/form-data; boundary=test' }, body: new Uint8Array(4 * 1024 * 1024 + 65537) });
    await expect(readEvidenceFile(request)).rejects.toMatchObject({ status: 413 });
  });
});
