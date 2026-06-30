'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { SerializedRingCard } from '@/lib/types';
import type { TrackerSummary } from '@/lib/trackers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import Link from 'next/link';
import Head from 'next/head';

export default function TrackerStatsClient({ tracker }: { tracker: TrackerSummary }) {
  const [cards, setCards] = useState<SerializedRingCard[]>([]);
  const [loading, setLoading] = useState(true);
  const trackerPath = `/trackers/${tracker.slug}`;

  useEffect(() => {
    fetch(`/api/trackers/${tracker.slug}/cards`)
      .then(res => res.json())
      .then(data => {
        setCards(data);
        setLoading(false);
      });
  }, [tracker.slug]);

  const foundCards = useMemo(() => cards.filter(c => c.found), [cards]);
  const gradedCards = useMemo(() => foundCards.filter(c => c.grading), [foundCards]);
  const confirmedCards = useMemo(() => foundCards.filter(c => c.verificationStatus === 'confirmed'), [foundCards]);

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
      recentDiscoveries: foundCards
        .filter(card => card.dateFound)
        .sort((a, b) => new Date(b.dateFound!).getTime() - new Date(a.dateFound!).getTime())
        .slice(0, 10),
      priceRanges,
    };
  }, [cards.length, foundCards, gradedCards, confirmedCards, tracker.total]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `${tracker.title} Statistics`,
    description: `Comprehensive statistics and analytics for serialized ${tracker.title} discoveries, including grading data, price trends, and discovery patterns.`,
    url: `https://mtgtrackers.com${trackerPath}/stats`,
    mainEntity: {
      '@type': 'Dataset',
      name: `${tracker.title} Card Statistics`,
      description: `Detailed statistics for ${tracker.total} serialized ${tracker.title} cards from ${tracker.setName || 'Magic: The Gathering'}`,
      numberOfItems: foundCards.length,
    },
  };

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-ring-gold text-xl">Loading Stats...</div>
      </main>
    );
  }

  const COLORS = ['#D6A73D', '#2BAE9E', '#A4508B', '#E4DCCF', '#4C7C59'];

  return (
    <>
      <Head>
        <title>Statistics | {tracker.title} Tracker</title>
        <meta name="description" content={`Comprehensive statistics and analytics for serialized ${tracker.title} discoveries, including grading data, price trends, and discovery patterns.`} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </Head>
      <main className="flex min-h-screen flex-col items-center p-8 md:p-12">
        <div className="z-10 w-full max-w-7xl items-center justify-between font-mono text-sm lg:flex mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-ring-gold">
            {tracker.title} Statistics
          </h1>
          <Link href={trackerPath} className="text-ring-gold hover:text-yellow-400 transition-colors">
            &larr; Back to Tracker
          </Link>
        </div>

        {foundCards.length === 0 ? (
          <div className="text-center text-ring-light">No cards found yet. Check back later for stats!</div>
        ) : (
          <div className="w-full max-w-7xl space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard title="Located" value={`${stats.foundCount}/${stats.totalCards}`} detail={`${stats.foundPercentage.toFixed(1)}% complete`} />
              <StatCard title="Confirmed" value={stats.confirmedCount.toString()} detail="Primary or grading-backed" />
              <StatCard title="Total Value" value={`$${stats.totalValue.toLocaleString()}`} detail="Tracked sale prices" />
              <StatCard title="Average Price" value={`$${Math.round(stats.averagePrice).toLocaleString()}`} detail="Per priced copy" />
            </div>

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
                        label={({ grade, percent }) => `${grade} (${(percent * 100).toFixed(0)}%)`}
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ListPanel title="Top Discoverers">
                {stats.topFinders.map((finder, index) => (
                  <div key={finder.finder} className="flex justify-between items-center gap-4">
                    <span className="text-ring-light">{index + 1}. {finder.finder}</span>
                    <span className="text-ring-gold font-bold">{finder.count} cards</span>
                  </div>
                ))}
              </ListPanel>
              <ListPanel title="Recent Discoveries">
                {stats.recentDiscoveries.map((card) => (
                  <div key={card.id} className="flex justify-between items-center gap-4">
                    <span className="text-ring-light">{card.serialNumber}/{tracker.total} - {card.foundBy}</span>
                    <span className="text-ring-gold font-bold">${card.price?.toLocaleString() || 'N/A'}</span>
                  </div>
                ))}
              </ListPanel>
            </div>
          </div>
        )}
      </main>
    </>
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
