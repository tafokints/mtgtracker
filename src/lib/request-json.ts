import { NextResponse } from 'next/server';

export async function readJsonBody(request: Request) {
  try {
    const value = await request.json();
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
