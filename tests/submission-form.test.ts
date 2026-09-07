import { describe, expect, it } from 'vitest';
import { evidenceFileError, inferReportSourceType } from '@/lib/submission-form';
import { MAX_UPLOAD_BYTES } from '@/lib/evidence-policy';
import { MAX_UPLOAD_BYTES as serverUploadLimit } from '@/lib/evidence-upload';

describe('minimal report form', () => {
  it.each([
    ['https://www.ebay.com/itm/123456789012?tracking=ignore', 'marketplace'],
    ['https://www.tcgplayer.com/product/12345/test-card', 'marketplace'],
    ['https://www.psacard.com/cert/12345678', 'grading-pop'],
    ['https://www.cgccards.com/certlookup/1234567890/', 'grading-pop'],
    ['https://www.reddit.com/r/mtg/comments/abc123/serial_found/', 'social'],
    ['https://x.com/collector/status/12345678', 'social'],
    ['https://twitter.com/collector/status/12345678', 'social'],
    ['https://www.instagram.com/p/abc123/', 'social'],
    ['https://magic.wizards.com/en/news/feature/serialized-cards', 'article'],
  ])('classifies supported direct source %s', (link, expected) => {
    expect(inferReportSourceType(link)).toBe(expected);
  });

  it.each(['', 'https://unknown.example/report', 'https://www.ebay.com/sch/i.html',
    'https://www.ebay.com.evil.example/itm/123456789012', 'https://evil.example/?url=https://x.com/a/status/123',
    'https://www.ebay.com@evil.example/itm/123456789012', 'http://x.com/a/status/123', 'javascript:alert(1)',
    'https://www.ebay.com:444/itm/123456789012', 'not a URL'])('does not infer a supported source from %s', (link) => {
    expect(inferReportSourceType(link)).toBe('other');
  });

  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts selectable %s files within the shared limit', (type) => {
    expect(evidenceFileError({ type, size: MAX_UPLOAD_BYTES })).toBeUndefined();
  });
  it('shares the exact server upload limit', () => expect(MAX_UPLOAD_BYTES).toBe(serverUploadLimit));
  it('rejects oversized and empty images before any request', () => {
    expect(evidenceFileError({ type: 'image/png', size: MAX_UPLOAD_BYTES + 1 })).toContain('4 MB');
    expect(evidenceFileError({ type: 'image/png', size: 0 })).toContain('empty');
  });
  it.each(['image/svg+xml', 'image/gif', 'text/html', 'application/octet-stream', ''])('rejects %s files', (type) => {
    expect(evidenceFileError({ type, size: 100 })).toContain('JPEG, PNG, or WebP');
  });
});
