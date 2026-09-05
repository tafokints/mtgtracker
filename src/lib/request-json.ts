import { NextResponse } from 'next/server';

export async function readJsonBody(request: Request, maxBytes = 4 * 1024 * 1024) {
  try {
    const reader = request.body?.getReader();
    let size = 0;
    const chunks: Uint8Array[] = [];
    if (reader) {
      try {
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          size += part.value.length;
          if (size > maxBytes) return { ok: false as const, response: NextResponse.json({ message: 'Request body is too large' }, { status: 413 }) };
          chunks.push(part.value);
        }
      } finally { await reader.cancel(); }
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return {
        ok: false as const,
        response: NextResponse.json({ message: 'Request body must be a JSON object' }, { status: 400 }),
      };
    }
    return { ok: true as const, value };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Request body must be valid JSON' }, { status: 400 }),
    };
  }
}
