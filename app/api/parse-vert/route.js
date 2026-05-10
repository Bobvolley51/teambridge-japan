// VERT PDF parser.
//
// VERT PDFs use custom font encoding that free text-extraction libraries can't
// decode (pdfjs returns empty strings). Claude reads the PDF visually and
// extracts the structured data reliably.
//
// The last page of every VERT report is the legend — we strip it before
// sending to reduce token cost by ~33%.
//
// Requires ANTHROPIC_API_KEY in Vercel environment variables.

import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PROMPT = `Extract the per-player data from this VERT session report PDF.

Return ONLY valid JSON — no markdown, no explanation:
{
  "session_name": "Practice - 1",
  "session_date": "YYYY-MM-DD",
  "players": [
    {
      "vert_name": "Yamamoto",
      "jumps": 63,
      "avg_hi_jump_cm": 67.6,
      "jpam": 1.0,
      "avg_hi_jump_power": 54.1,
      "high_impact_pct": 8,
      "alert_impact_pct": 3,
      "elevated_pct": 10,
      "energy": 2942,
      "sets_by_energy": 3.3,
      "intensity": 49
    }
  ]
}

Rules:
- One entry per player row — do NOT include team averages or position averages
- vert_name: last name only as shown
- session_date: convert the report date to YYYY-MM-DD
- elevated_pct: use the ELEVATED (HIGH + ALERT) column from Landing Breakdown
- Numbers only — no units (cm, %, etc.)
- Missing values: use null`;

export async function POST(req) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return Response.json({
        error: 'NO_API_KEY',
        message: 'Add ANTHROPIC_API_KEY to Vercel Environment Variables then redeploy.',
      }, { status: 503 });
    }

    const form = await req.formData();
    const file = form.get('file');
    if (!file) return Response.json({ error: 'No file' }, { status: 400 });

    const buf = Buffer.from(await file.arrayBuffer());

    // Strip the last page (always the VERT legend — not needed for extraction)
    let sendBuf = buf;
    try {
      const pdfDoc = await PDFDocument.load(buf);
      if (pdfDoc.getPageCount() > 1) {
        pdfDoc.removePage(pdfDoc.getPageCount() - 1);
        sendBuf = Buffer.from(await pdfDoc.save());
      }
    } catch {
      // If pdf-lib can't parse it, just send the original
    }

    const b64 = sendBuf.toString('base64');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'content-type':      'application/json',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
            { type: 'text', text: PROMPT },
          ],
        }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Anthropic API error ${res.status}: ${errText}` }, { status: 502 });
    }

    const ai    = await res.json();
    const raw   = ai.content?.[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return Response.json({ error: 'AI returned no JSON', raw }, { status: 422 });

    return Response.json(JSON.parse(match[0]));
  } catch (err) {
    return Response.json({ error: err.message, stack: err.stack?.slice(0, 300) }, { status: 500 });
  }
}
