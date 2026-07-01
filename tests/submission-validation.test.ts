import { describe, expect, it } from 'vitest';
import { validateDiscoverySubmission } from '@/lib/submission-validation';

describe('validateDiscoverySubmission', () => {
  it('normalizes a valid crowd-sourced discovery report', () => {
    const result = validateDiscoverySubmission({
      cardId: '7',
      foundBy: '  Collector One  ',
      dateFound: '2026-06-30',
      link: 'https://example.com/source',
      sourceType: 'marketplace',
      verificationStatus: 'confirmed',
      price: '1234.56',
      imageUrl: 'https://example.com/image-a.jpg',
      evidenceImageUrls: 'https://example.com/image-b.jpg, https://example.com/image-a.jpg',
      notes: '  Looks legitimate.  ',
    }, 100);

    expect(result.errors).toEqual([]);
    expect(result.value).toMatchObject({
      cardId: 7,
      foundBy: 'Collector One',
      dateFound: '2026-06-30',
      link: 'https://example.com/source',
      sourceType: 'marketplace',
      verificationStatus: 'confirmed',
      price: 1234.56,
      imageUrl: 'https://example.com/image-a.jpg',
      notes: 'Looks legitimate.',
    });
    expect(result.value.evidenceImages).toEqual([
      { url: 'https://example.com/image-a.jpg' },
      { url: 'https://example.com/image-b.jpg' },
    ]);
  });

  it('rejects invalid serials, urls, prices, and missing evidence', () => {
    const result = validateDiscoverySubmission({
      cardId: '101',
      link: 'javascript:alert(1)',
      sourceType: 'not-real',
      verificationStatus: 'gold-star',
      price: '-1',
      imageUrl: 'ftp://example.com/image.jpg',
    }, 100);

    expect(result.errors).toEqual(expect.arrayContaining([
      'Serial slot must be between 1 and 100.',
      'Source link must be a valid http(s) URL.',
      'Source type is not valid.',
      'Evidence level is not valid.',
      'Sale price must be a non-negative number.',
      'Primary image URL must be a valid http(s) URL.',
      'Evidence image URLs must be valid http(s) URLs.',
    ]));
  });

  it('requires at least one review signal', () => {
    const result = validateDiscoverySubmission({
      cardId: '10',
      sourceType: 'other',
      verificationStatus: 'source-linked',
    }, 100);

    expect(result.errors).toContain('Please include a source link, evidence image, or note for review.');
  });

  it('caps evidence images', () => {
    const evidenceImageUrls = Array.from({ length: 9 }, (_, index) => `https://example.com/${index}.jpg`).join('\n');
    const result = validateDiscoverySubmission({
      cardId: '10',
      evidenceImageUrls,
    }, 100);

    expect(result.errors).toContain('Please submit no more than 8 evidence image URLs.');
  });
});
