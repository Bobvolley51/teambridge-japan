import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 30;

const PROMPT = `Extract the per-player data from this VERT session report PDF.

Return ONLY a valid JSON object — no markdown, no explanation — in exactly this shape:
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
- session_name: the session title shown in the top-right (e.g. "Practice - 1")
- session_date: convert the date shown in the report header to YYYY-MM-DD
- players: one entry per player row in the tables — do NOT include team averages or position averages
- vert_name: last name only as shown in the report
- elevated_pct: use the ELEVATED (HIGH + ALERT) column from the Landing Breakdown table
- All numeric fields: numbers only, no units (cm, %, etc.)
- If a value is missing or "N/A", use null`;

export async function POST(req) {
  const form = await req.formData();
  const file = form.get('file');
  if (!file) return Response.json({ error: 'No file' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());
  const b64 = buf.toString('base64');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
        { type: 'text', text: PROMPT },
      ],
    }],
  });

  const raw = msg.content[0].text;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return Response.json({ error: 'Parse failed', raw }, { status: 422 });

  try {
    const data = JSON.parse(match[0]);
    return Response.json(data);
  } catch {
    return Response.json({ error: 'Invalid JSON', raw }, { status: 422 });
  }
}
