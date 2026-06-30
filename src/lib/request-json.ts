import { NextResponse } from 'next/server';

export async function readJsonBody(request: Request) {
  try {
    const value = await request.json();
    return { ok: true as const, value };
  } catch {
    return {
      ok: false as const,
      response: NextResponse.json({ message: 'Request body must be valid JSON' }, { status: 400 }),
    };
  }
}
