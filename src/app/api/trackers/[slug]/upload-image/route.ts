import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getTracker } from '@/lib/trackers';
import { randomUUID } from 'node:crypto';
import { EvidenceUploadError, prepareEvidenceImage, readEvidenceFile } from '@/lib/evidence-upload';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const tracker = getTracker(slug);
  if (!tracker || tracker.status !== 'live') {
    return NextResponse.json({ message: 'Tracker not found' }, { status: 404 });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ message: 'Image uploads are not configured' }, { status: 503 });
  }

  try {
    const redis = getRedis();
    const clientIp = getClientIp(request);
    const rateLimit = await checkRateLimit(redis, {
      key: `rate-limit:upload:${clientIp}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many uploads. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '3600' } }
      );
    }

    const budget = await checkRateLimit(redis, {
      key: 'rate-limit:upload:site', limit: 500, windowSeconds: 24 * 60 * 60,
    });
    if (!budget.allowed) {
      return NextResponse.json({ message: 'Daily upload capacity reached. Please use an evidence URL or try again later.' }, {
        status: 429, headers: { 'Retry-After': '86400' },
      });
    }

    const file = await readEvidenceFile(request);
    const image = await prepareEvidenceImage(file);

    const blob = await put(
      `trackers/${tracker.slug}/evidence/${randomUUID()}.${image.extension}`,
      image.data,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: image.contentType,
      }
    );

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: image.contentType,
      size: image.data.byteLength,
      width: image.width,
      height: image.height,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    if (error instanceof EvidenceUploadError) return NextResponse.json({ message: error.message }, { status: error.status });
    console.error('Error uploading evidence image:', error);
    return NextResponse.json({ message: 'Image upload failed' }, { status: 500 });
  }
}
