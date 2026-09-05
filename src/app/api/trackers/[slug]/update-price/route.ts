import { requireAdmin } from '@/lib/admin-auth';
import { readJsonBody } from '@/lib/request-json';
import { POST as addPriceHistory } from '../add-price-history/route';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Preserve the older route, but all price writes now append an observation.
export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;
  const { cardId, price, kind, currency, date, sourceUrl } = body.value;
  const headers = new Headers(request.headers);
  headers.delete('content-length');
  return addPriceHistory(new Request(request.url, {
    method: 'POST', headers,
    body: JSON.stringify({ cardId, entry: { price, kind, currency, date, sourceUrl } }),
  }), context);
}
