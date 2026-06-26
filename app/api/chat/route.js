// app/api/chat/route.js
// Server-side chat endpoint — keeps ANTHROPIC_API_KEY off the browser.

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const { messages, system } = body;
    if (!messages?.length) {
      return NextResponse.json({ error: 'No messages provided' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system:     system ?? 'You are a helpful assistant.',
        messages:   messages.map(({ role, content }) => ({ role, content })),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const data  = await response.json();
    const reply = data.content?.map((b) => b.text ?? '').join('') ?? '';

    return NextResponse.json({ reply });
  } catch (err) {
    console.error('[chat]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
