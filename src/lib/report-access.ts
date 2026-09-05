import { createHmac, timingSafeEqual } from 'node:crypto';
import { EvidenceUploadError } from './evidence-upload';

function signature(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new EvidenceUploadError('Report access is not configured', 503);
  return createHmac('sha256', secret).update(`report-access-v1:${payload}`).digest('base64url');
}

export function createReportAccess(tracker: string, id: string, submittedAt: string) {
  const payload = Buffer.from(JSON.stringify({ tracker, id, exp: new Date(submittedAt).getTime() + 90 * 86400000 })).toString('base64url');
  return `${payload}.${signature(payload)}`;
}

export function requireReportAccess(request: Request, tracker: string, id: string) {
  const token = request.headers.get('x-report-token') || '';
  const [payload, supplied, extra] = token.split('.');
  if (token.length > 2048 || !payload || !supplied || extra !== undefined) throw new EvidenceUploadError('Invalid or expired private report link', 403);
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(supplied);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new EvidenceUploadError('Invalid or expired private report link', 403);
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (data.tracker !== tracker || data.id !== id || !Number.isSafeInteger(data.exp) || data.exp <= Date.now()) throw new Error();
  } catch { throw new EvidenceUploadError('Invalid or expired private report link', 403); }
}
