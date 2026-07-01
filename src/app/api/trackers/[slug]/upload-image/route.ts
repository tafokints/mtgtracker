import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { getTracker } from '@/lib/trackers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type RouteContext = {
  params: Promise<{ slug: string }>;
};

function sanitizeFilename(filename: string) {
  const fallbackName = 'evidence-image';
  const sanitized = filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return sanitized || fallbackName;
}

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
      key: `rate-limit:${tracker.slug}:upload:${clientIp}`,
      limit: 10,
      windowSeconds: 60 * 60,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { message: 'Too many uploads. Please try again later.' },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'Image file is required' }, { status: 400 });
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json({ message: 'Only JPEG, PNG, and WebP images are supported' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ message: 'Image must be 4 MB or smaller' }, { status: 400 });
    }

    const blob = await put(
      `trackers/${tracker.slug}/evidence/${Date.now()}-${sanitizeFilename(file.name)}`,
      file,
      {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type,
      }
    );

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: file.type,
      size: file.size,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    console.error('Error uploading evidence image:', error);
    return NextResponse.json({ message: 'Image upload failed' }, { status: 500 });
  }
}
