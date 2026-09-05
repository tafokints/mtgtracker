import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { EVIDENCE_ID } from './evidence-policy';
import { EvidenceUploadError } from './evidence-upload';

export interface SubmissionSession { id: string; tracker: string; cardId: number; exp: number }

function sign(payload: string) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new EvidenceUploadError('Submission protection is not configured', 503);
  return createHmac('sha256', secret).update(`submission-v1:${payload}`).digest('base64url');
}

export function createSubmissionSession(tracker: string, cardId: number, id: string = randomUUID()) {
  const session: SubmissionSession = { id, tracker, cardId, exp: Date.now() + 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return { token: `${payload}.${sign(payload)}`, expiresAt: session.exp };
}

export function readSubmissionSession(request: Request, tracker: string, cardId?: number): SubmissionSession {
  const token = request.headers.get('x-submission-token') || '';
  if (token.length > 2048) throw new EvidenceUploadError('Invalid submission session', 403);
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) throw new EvidenceUploadError('Complete the verification check before submitting', 403);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new EvidenceUploadError('Invalid submission session', 403);
  try {
    const session: SubmissionSession = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!EVIDENCE_ID.test(session.id) || session.tracker !== tracker || !Number.isSafeInteger(session.cardId) || session.cardId < 1 ||
      (cardId !== undefined && cardId !== session.cardId) || !Number.isSafeInteger(session.exp) || session.exp <= Date.now() || session.exp > Date.now() + 3600000) throw new Error();
    return session;
  } catch { throw new EvidenceUploadError('Submission session expired or card selection changed. Verify again.', 403); }
}

export async function verifyTurnstile(token: unknown) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  const hosts = (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '').split(',').map((host) => host.trim()).filter(Boolean);
  if (!secret || hosts.length === 0) throw new EvidenceUploadError('Submission protection is not configured', 503);
  if (typeof token !== 'string' || !token || token.length > 2048) throw new EvidenceUploadError('Complete the verification check', 400);
  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token }), redirect: 'error',
      signal: AbortSignal.timeout(10000), cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const result = await response.json();
    if (result.success !== true || result.action !== 'discovery' || !hosts.includes(result.hostname)) {
      throw new EvidenceUploadError('Verification failed or expired. Please try again.', 403);
    }
  } catch (error) {
    if (error instanceof EvidenceUploadError) throw error;
    throw new EvidenceUploadError('Verification is temporarily unavailable. Please try again later.', 503);
  }
}
