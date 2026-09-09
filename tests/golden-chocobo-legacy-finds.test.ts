import { describe, expect, it } from 'vitest';
import { validBackupCard, validBackupSubmission } from '@/lib/backup-validation';
import {
  buildGoldenChocoboLegacyFindImport,
  buildGoldenChocoboLegacySummary,
  inferGoldenChocoboLegacySourceType,
} from '@/lib/golden-chocobo-legacy';
import { getTracker } from '@/lib/trackers';

const tracker = getTracker('golden-chocobo');
if (!tracker) throw new Error('Golden Chocobo tracker fixture is missing');

function legacyCards() {
  return Array.from({ length: 77 }, (_, index) => ({
    id: index + 1,
    found: false,
  }));
}

describe('Golden Chocobo legacy find import', () => {
  it('summarizes found and missing legacy serials', () => {
    const cards = legacyCards();
    cards[0] = { id: 1, found: true };
    cards[76] = { id: 77, found: true };

    expect(buildGoldenChocoboLegacySummary(cards, tracker)).toEqual({
      total: 77,
      found: 2,
      missing: 75,
      foundSerials: ['01', '77'],
    });
  });

  it('maps legacy finds into approved public card records with review history', () => {
    const cards = legacyCards();
    cards[0] = {
      id: 1,
      found: true,
      foundBy: 'collector',
      dateFound: '2025-06-20',
      link: 'https://www.instagram.com/p/DLJPL2WviUe/?utm_source=ig_web_copy_link',
      image: '/images/chocobo-01.jpg',
      price: 50000,
      priceDate: '2025-07-25',
      grading: { service: 'CGC', grade: 10, dateGraded: '2025-08-07' },
    };
    cards[34] = {
      id: 35,
      found: true,
      foundBy: 'private collector',
      dateFound: '2025-07-01',
    };

    const imported = buildGoldenChocoboLegacyFindImport(tracker, cards, {
      generatedAt: '2026-09-09T20:00:00.000Z',
      reviewedBy: 'test-owner',
    });

    expect(imported.counts).toMatchObject({
      cards: 77,
      found: 2,
      submissions: 2,
      sourceLinked: 1,
      unverified: 1,
      prices: 1,
      graded: 1,
    });
    expect(imported.cards[0]).toMatchObject({
      id: 1,
      found: true,
      foundBy: 'collector',
      serialNumber: '01',
      link: 'https://www.instagram.com/p/DLJPL2WviUe/',
      sourceType: 'social',
      verificationStatus: 'source-linked',
      price: undefined,
      grading: { service: 'CGC', grade: 10 },
    });
    expect(imported.cards[0].priceHistory[0]).toMatchObject({
      price: 50000,
      date: '2025-07-25',
      kind: 'unknown',
      currency: 'USD',
    });
    expect(imported.cards[0].history?.[0]).toMatchObject({
      kind: 'discovery',
      sourceSubmissionId: 'legacy-golden-chocobo-01',
    });
    expect(imported.cards[34]).toMatchObject({
      id: 35,
      found: true,
      sourceType: 'other',
      verificationStatus: 'unverified',
    });
    expect(imported.submissions[0]).toMatchObject({
      id: 'legacy-golden-chocobo-01',
      status: 'approved',
      reviewedBy: 'test-owner',
      requestedVerificationStatus: 'source-linked',
      reviewHistory: [expect.objectContaining({ action: 'legacy-import', actorId: 'test-owner' })],
    });
    expect(imported.submissions[1]).toMatchObject({
      id: 'legacy-golden-chocobo-35',
      status: 'approved',
      requestedVerificationStatus: 'unverified',
      link: undefined,
    });
    expect(imported.cards.every((card) => validBackupCard(card, tracker))).toBe(true);
    expect(imported.submissions.every((submission) => validBackupSubmission(submission, tracker))).toBe(true);
  });

  it('keeps unsupported legacy sources out of public source links', () => {
    const cards = legacyCards();
    cards[13] = {
      id: 14,
      found: true,
      link: 'https://www.facebook.com/photo?fbid=1254032296726540',
    };

    const imported = buildGoldenChocoboLegacyFindImport(tracker, cards, {
      generatedAt: '2026-09-09T20:00:00.000Z',
    });

    expect(inferGoldenChocoboLegacySourceType(cards[13].link)).toBe('social');
    expect(imported.cards[13]).toMatchObject({
      found: true,
      link: undefined,
      sourceType: 'social',
      verificationStatus: 'unverified',
    });
    expect(imported.cards[13].notes).toContain('Legacy source link needs manual review');
  });
});
