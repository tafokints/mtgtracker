'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { SerializedRingCard } from '@/lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { formatTrackerCardLabel, getTrackerCardDeepLinkParams } from '@/lib/tracker-data';
import { getTrackerMarketSummary } from '@/lib/tracker-market-summary';
import AffiliateDisclosureNotice from '@/components/AffiliateDisclosureNotice';
import PrimaryAffiliateCtas from '@/components/PrimaryAffiliateCtas';
import TrackerMarketTrustStrip from '@/components/TrackerMarketTrustStrip';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
import Link from 'next/link';

export default function TrackerStatsClient({ tracker }: { tracker: TrackerSummary }) {
  const [cards, setCards] = useState<SerializedRingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const trackerPath = `/trackers/${tracker.slug}`;

  useEffect(() => {
    fetch(`/api/trackers/${tracker.slug}/cards`)
      .then(res => {
        if (!res.ok) {
          throw new Error(`Cards request failed with status ${res.status}`);
        }

        return res.json();
      })
      .then(data => {
        if (!Array.isArray(data)) {
          throw new Error('Cards response was not an array');
        }

        setCards(data);
        setDataError(null);
      })
      .catch(error => {
        console.warn('Tracker stats data unavailable:', error);
        setCards([]);
        setDataError('Tracker data is temporarily unavailable.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tracker.slug]);

  const foundCards = useMemo(() => cards.filter(c => c.found), [cards]);
  const gradedCards = useMemo(() => foundCards.filter(c => c.grading), [foundCards]);
  const confirmedCards = useMemo(() => foundCards.filter(c => c.verificationStatus === 'confirmed'), [foundCards]);
  const sourceLinkedCards = useMemo(() => foundCards.filter(c => c.verificationStatus === 'source-linked'), [foundCards]);
  const unverifiedCards = useMemo(() => foundCards.filter(c => c.verificationStatus === 'unverified'), [foundCards]);
  const marketSummary = useMemo(() => getTrackerMarketSummary(tracker, cards), [cards, tracker]);

  const stats = useMemo(() => {
    const prices = foundCards.map(c => c.price).filter(p => p != null) as number[];
    const averagePrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
    const totalValue = prices.reduce((a, b) => a + b, 0);

    const findsByMonth = foundCards.reduce((acc, card) => {
      if (card.dateFound) {
        const month = new Date(card.dateFound).toISOString().slice(0, 7);
        acc[month] = (acc[month] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const gradingStats = {
      totalGraded: gradedCards.length,
      averageGrade: gradedCards.length > 0
        ? gradedCards.reduce((sum, card) => sum + (card.grading?.grade || 0), 0) / gradedCards.length
        : 0,
      gradeDistribution: gradedCards.reduce((acc, card) => {
        const grade = card.grading?.grade;
        if (grade !== undefined) {
          const gradeKey = grade.toString();
          acc[gradeKey] = (acc[gradeKey] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
      serviceDistribution: gradedCards.reduce((acc, card) => {
        const service = card.grading?.service;
        if (service) {
          acc[service] = (acc[service] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };

    const finderCounts = foundCards.reduce((acc, card) => {
      if (card.foundBy) {
        acc[card.foundBy] = (acc[card.foundBy] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const sourceTypeCounts = foundCards.reduce((acc, card) => {
      const sourceType = card.sourceType || 'other';
      acc[sourceType] = (acc[sourceType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const priceRanges = [
      { range: 'Under $10k', count: prices.filter(p => p < 10000).length },
      { range: '$10k-$25k', count: prices.filter(p => p >= 10000 && p < 25000).length },
      { range: '$25k-$50k', count: prices.filter(p => p >= 25000 && p < 50000).length },
      { range: '$50k-$100k', count: prices.filter(p => p >= 50000 && p < 100000).length },
      { range: '$100k+', count: prices.filter(p => p >= 100000).length },
    ];

    return {
      totalCards: tracker.total || cards.length,
      foundCount: foundCards.length,
      confirmedCount: confirmedCards.length,
      sourceLinkedCount: sourceLinkedCards.length,
      unverifiedCount: unverifiedCards.length,
      pricedCount: prices.length,
      foundPercentage: (foundCards.length / (tracker.total || cards.length || 1)) * 100,
      averagePrice,
      totalValue,
      findsByMonth: Object.entries(findsByMonth)
        .map(([month, count]) => ({ month, count }))
        .sort((a, b) => a.month.localeCompare(b.month)),
      gradingStats,
      topFinders: Object.entries(finderCounts)
        .map(([finder, count]) => ({ finder, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      sourceTypes: Object.entries(sourceTypeCounts)
        .map(([sourceType, count]) => ({ sourceType, count }))
        .sort((a, b) => b.count - a.count),
      recentDiscoveries: foundCards
        .filter(card => card.dateFound)
        .sort((a, b) => new Date(b.dateFound!).getTime() - new Date(a.dateFound!).getTime())
        .slice(0, 10),
      priceRanges,
    };
  }, [cards.length, foundCards, gradedCards, confirmedCards, sourceLinkedCards, unverifiedCards, tracker.total]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-ring-gold text-xl">Loading Stats...</div>
      </main>
    );
  }

  const COLORS = ['#D6A73D', '#2BAE9E', '#A4508B', '#E4DCCF', '#4C7C59'];
  const renderGradeLabel = ({ payload, percent }: PieLabelRenderProps) => {
    const grade = payload && typeof payload === 'object' && 'grade' in payload
      ? String(payload.grade)
      : 'Grade';
    const percentage = typeof percent === 'number' ? percent : 0;

    return `${grade} (${(percentage * 100).toFixed(0)}%)`;
  };

  return (
    <>
      <main className="flex min-h-screen flex-col items-center p-8 md:p-12">
        <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-ring-gold">
            {tracker.title} Statistics
          </h1>
          <Link href={trackerPath} className="text-ring-gold hover:text-yellow-400 transition-colors">
            &larr; Back to Tracker
          </Link>
        </div>

        {dataError ? (
          <div className="text-center text-ring-light">{dataError}</div>
        ) : (
          <div className="w-full max-w-7xl space-y-8">
            <section className="rounded-lg border border-ring-gold/30 bg-ring-dark/75 p-4" aria-label="Stats marketplace context">
              <div className="mb-4">
                <AffiliateDisclosureNotice links={tracker.affiliateLinks} compact />
              </div>
              <PrimaryAffiliateCtas
                links={tracker.affiliateLinks}
                trackerSlug={tracker.slug}
                placement="tracker-stats-cta"
                title={marketSummary.statsCtaTitle}
                description={marketSummary.statsCtaDescription}
              />
              <TrackerMarketTrustStrip summary={marketSummary} />
            </section>

            {foundCards.length === 0 ? (
              <div className="rounded-lg border border-ring-gold/30 bg-ring-dark/75 p-6 text-center text-ring-light">
                No public discoveries have been approved for this tracker yet. Marketplace context remains available while reports enter review.
              </div>
            ) : (
              <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Located" value={`${stats.foundCount}/${stats.totalCards}`} detail={`${stats.foundPercentage.toFixed(1)}% complete`} />
              <StatCard title="Confirmed" value={stats.confirmedCount.toString()} detail="Primary or grading-backed" />
              <StatCard
                title="Total Value"
                value={stats.pricedCount > 0 ? `$${stats.totalValue.toLocaleString()}` : 'No prices'}
                detail={stats.pricedCount > 0 ? `${stats.pricedCount} priced ${stats.pricedCount === 1 ? 'copy' : 'copies'}` : 'Awaiting public sale data'}
              />
              <StatCard
                title="Average Price"
                value={stats.pricedCount > 0 ? `$${Math.round(stats.averagePrice).toLocaleString()}` : 'N/A'}
                detail={stats.pricedCount > 0 ? 'Per priced copy' : 'No public prices yet'}
              />
            </div>

            {stats.pricedCount > 0 ? (
              <ChartPanel title="Price Distribution">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.priceRanges}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(214, 167, 61, 0.2)" />
                    <XAxis dataKey="range" stroke="#D6A73D" />
                    <YAxis allowDecimals={false} stroke="#D6A73D" />
                    <Tooltip contentStyle={{ backgroundColor: '#101413', border: '1px solid #D6A73D' }} />
                    <Bar dataKey="count" fill="#2BAE9E" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartPanel>
            ) : (
              <ChartPanel title="Price Distribution">
                <p className="text-sm text-ring-light/70">No public sale prices have been approved for this tracker yet.</p>
              </ChartPanel>
            )}

            {stats.gradingStats.totalGraded > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPanel title="Grade Distribution">
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(stats.gradingStats.gradeDistribution).map(([grade, count]) => ({ grade, count }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={renderGradeLabel}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {Object.entries(stats.gradingStats.gradeDistribution).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: '#101413', border: '1px solid #D6A73D' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartPanel>
                <ChartPanel title="Grading Services">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(stats.gradingStats.serviceDistribution).map(([service, count]) => ({ service, count }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(214, 167, 61, 0.2)" />
                      <XAxis dataKey="service" stroke="#D6A73D" />
                      <YAxis allowDecimals={false} stroke="#D6A73D" />
                      <Tooltip contentStyle={{ backgroundColor: '#101413', border: '1px solid #D6A73D' }} />
                      <Bar dataKey="count" fill="#D6A73D" />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartPanel>
              </div>
            )}

            <ChartPanel title="Discovery Timeline">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.findsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(214, 167, 61, 0.2)" />
                  <XAxis dataKey="month" stroke="#D6A73D" />
                  <YAxis allowDecimals={false} stroke="#D6A73D" />
                  <Tooltip contentStyle={{ backgroundColor: '#101413', border: '1px solid #D6A73D' }} />
                  <Line type="monotone" dataKey="count" name="Located" stroke="#2BAE9E" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <ListPanel title="Top Discoverers">
                {stats.topFinders.length > 0 ? (
                  stats.topFinders.map((finder, index) => (
                    <div key={finder.finder} className="flex justify-between items-center gap-4">
                      <span className="min-w-0 break-words text-ring-light">{index + 1}. {finder.finder}</span>
                      <span className="shrink-0 text-ring-gold font-bold">{finder.count} cards</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ring-light/70">No public discoverer names yet.</p>
                )}
              </ListPanel>
              <ListPanel title="Source Quality">
                <QualityRow label="Confirmed" count={stats.confirmedCount} total={stats.foundCount} />
                <QualityRow label="Source-linked" count={stats.sourceLinkedCount} total={stats.foundCount} />
                <QualityRow label="Unverified" count={stats.unverifiedCount} total={stats.foundCount} />
              </ListPanel>
              <ListPanel title="Source Types">
                {stats.sourceTypes.map((sourceType) => (
                  <QualityRow
                    key={sourceType.sourceType}
                    label={formatSourceTypeLabel(sourceType.sourceType)}
                    count={sourceType.count}
                    total={stats.foundCount}
                  />
                ))}
              </ListPanel>
              <ListPanel title="Recent Discoveries">
                {stats.recentDiscoveries.map((card) => (
                  <div key={card.id} className="flex justify-between items-center gap-4">
                    <Link
                      href={`${trackerPath}?${getTrackerCardDeepLinkParams(tracker, card).toString()}`}
                      className="min-w-0 break-words text-ring-light underline-offset-4 transition-colors hover:text-ring-gold hover:underline"
                    >
                      {formatTrackerCardLabel(tracker, card)} - {card.foundBy}
                    </Link>
                    <span className="shrink-0 text-ring-gold font-bold">{card.price !== undefined ? `$${card.price.toLocaleString()}` : 'No price'}</span>
                  </div>
                ))}
              </ListPanel>
            </div>
              </>
            )}
          </div>
        )}
      </main>
    </>
  );
}

function formatSourceTypeLabel(sourceType: string) {
  return sourceType
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function QualityRow({ label, count, total }: { label: string; count: number; total: number }) {
  const percentage = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-ring-light">{label}</span>
      <span className="shrink-0 text-ring-gold font-bold">{count} ({percentage}%)</span>
    </div>
  );
}

function StatCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <div className="bg-ring-dark bg-opacity-75 p-6 rounded-lg border border-ring-gold text-center">
      <h3 className="text-lg font-bold text-ring-light">{title}</h3>
      <p className="text-3xl font-bold text-ring-gold mt-2">{value}</p>
      <p className="text-sm text-ring-light mt-1">{detail}</p>
    </div>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-ring-dark bg-opacity-75 p-6 rounded-lg border border-ring-gold">
      <h3 className="text-xl font-bold text-ring-gold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function ListPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-ring-dark bg-opacity-75 p-6 rounded-lg border border-ring-gold">
      <h3 className="text-xl font-bold text-ring-gold mb-4">{title}</h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
