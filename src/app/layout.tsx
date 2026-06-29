import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";
import React from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { RING_REFERENCE_IMAGE } from "@/lib/ring-data";

const cinzel = Cinzel({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "MTG Trackers",
    template: "%s | MTG Trackers"
  },
  description: "Community trackers for Magic: The Gathering serialized cards, sightings, sales, grading, and source verification.",
  keywords: [
    "The One Ring",
    "MTG Lord of the Rings",
    "Tales of Middle-earth",
    "Magic The Gathering",
    "serialized cards",
    "collector tracker",
    "The One Ring serialized",
    "MTG collector",
    "rare cards",
    "card tracking",
    "MTG Trackers"
  ],
  authors: [{ name: "MTG Trackers" }],
  creator: "MTG Trackers",
  publisher: "MTG Trackers",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL('https://mtgtrackers.com'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://mtgtrackers.com',
    title: 'MTG Trackers',
    description: 'Community trackers for Magic: The Gathering serialized cards, sightings, sales, grading, and source verification.',
    siteName: 'MTG Trackers',
    images: [
      {
        url: RING_REFERENCE_IMAGE,
        width: 1200,
        height: 630,
        alt: 'MTG Trackers',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MTG Trackers',
    description: 'Community trackers for Magic: The Gathering serialized cards.',
    images: [RING_REFERENCE_IMAGE],
    creator: '@mtgtrackers',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#D6A73D" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MTG Trackers" />
        <link rel="apple-touch-icon" href="/icon.svg" />
        <meta name="msapplication-TileColor" content="#D6A73D" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </head>
      <body className={cinzel.className}>
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
} 
