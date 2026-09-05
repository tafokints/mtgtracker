import { NextResponse } from 'next/server';
import { requireAdmin, isAdminConfigured } from '@/lib/admin-auth';
import { getRedisEnvStatus } from '@/lib/redis';

export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  const denied = await requireAdmin(request);
  if (denied) { Object.entries(headers).forEach(([key, value]) => denied.headers.set(key, value)); return denied; }
  const configured = (...names: string[]) => names.every((name) => Boolean(process.env[name]?.trim()));
  return NextResponse.json({ services: [
    { name: 'Owner authentication', configured: isAdminConfigured() },
    { name: 'Authenticator', configured: configured('ADMIN_TOTP_SECRET') },
    { name: 'Redis', configured: getRedisEnvStatus().provider !== 'missing' },
    { name: 'Private image storage', configured: configured('BLOB_READ_WRITE_TOKEN') },
    { name: 'Bot challenge', configured: configured('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'TURNSTILE_ALLOWED_HOSTNAMES') },
    { name: 'Malware scanner', configured: configured('CLOUDMERSIVE_API_KEY') },
    { name: 'Sexual-content scanner', configured: configured('AZURE_CONTENT_SAFETY_ENDPOINT', 'AZURE_CONTENT_SAFETY_KEY') },
    { name: 'Source-link screening', configured: configured('GOOGLE_WEB_RISK_API_KEY') },
  ] }, { headers });
}
