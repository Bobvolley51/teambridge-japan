import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { text, targetLang } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.DEEPL_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'DEEPL_API_KEY not configured' }, { status: 503 });
    }

    const deeplLang = targetLang === 'Japanese' ? 'JA' : 'EN';

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        text:        [text],
        target_lang: deeplLang,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error('DeepL error:', body);
      return NextResponse.json({ error: 'Translation API error' }, { status: 500 });
    }

    const data = await res.json();
    const translation = data.translations?.[0]?.text ?? text;
    return NextResponse.json({ translation });
  } catch (err) {
    console.error('translate route error:', err);
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
