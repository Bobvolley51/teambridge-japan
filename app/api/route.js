// app/api/translate/route.js
//
// Server-side API route — the Anthropic API key stays on the server,
// never exposed to the browser.
//
// Add to .env.local:
//   ANTHROPIC_API_KEY=sk-ant-...

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const { text, targetLang } = body;

  if (!text || !targetLang) {
    return NextResponse.json({ error: 'Missing text or targetLang' }, { status: 400 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'AI not configured' }, { status: 503 });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':         'application/json',
      'x-api-key':            process.env.ANTHROPIC_API_KEY,
      'anthropic-version':    '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 500,
      system:     'You are a professional translator. Respond with ONLY the translation — no explanations, no quotes, no preamble.',
      messages: [
        {
          role:    'user',
          content: `Translate the following text to ${targetLang}:\n\n${text}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: 'Anthropic API error: ' + err }, { status: 502 });
  }

  const data = await response.json();
  const translation = data.content?.[0]?.text ?? '';

  return NextResponse.json({ translation });
  } catch (err) {
    console.error('[api/route]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
