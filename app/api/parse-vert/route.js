// Free PDF text extraction — no AI API key required.
// Uses pdf-parse v1 to extract raw text then regex-parses the VERT report layout.

export const runtime = 'nodejs';
export const maxDuration = 30;

// ── Text parser ────────────────────────────────────────────────────────────────

function parseNum(s) {
  if (s == null) return null;
  const n = parseFloat(String(s).replace(/[^\d.]/g, ''));
  return isNaN(n) ? null : n;
}

function parseDate(text) {
  const m = text.match(/(\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})/i);
  if (!m) return null;
  const d = new Date(m[1]);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

const SKIP = new Set([
  'JUMP','JUMPS','LANDING','WORK','BREAKDOWN','NONE','ENERGY','INTENSITY','SETS',
  'TEAM','SESSION','AVERAGES','POSITION','REPORT','AVERAGE','HIGH','ALERT',
  'ELEVATED','IMPACT','POWER','ACTIVE','MINUTE','INSIDER','VERT','ENTRY','NO',
  'AVG','HI','MAX','JUMP','COACH','SESSION','PRACTICE','MATCH','GAME',
]);

function isName(s) {
  return /^[A-ZÜÖÄ][a-zA-ZüöäÜÖÄß-]{1,25}$/.test(s) && !SKIP.has(s.toUpperCase());
}

function extractSection(lines, fromKeyword, toKeyword) {
  const from = lines.findIndex(l => new RegExp(fromKeyword, 'i').test(l));
  if (from < 0) return [];
  const to = toKeyword
    ? lines.findIndex((l, i) => i > from && new RegExp(toKeyword, 'i').test(l))
    : -1;
  return lines.slice(from + 1, to > from ? to : undefined);
}

function parseRows(secLines, numCount) {
  const map = {};
  let i = 0;
  while (i < secLines.length) {
    if (isName(secLines[i]) && secLines[i + 1]?.toUpperCase() === 'NONE') {
      const name = secLines[i];
      const nums = [];
      let j = i + 2;
      while (j < secLines.length && nums.length < numCount + 3) {
        if (isName(secLines[j]) && secLines[j + 1]?.toUpperCase() === 'NONE') break;
        const n = parseNum(secLines[j]);
        if (n !== null) nums.push(n);
        j++;
      }
      map[name] = nums;
      i = j;
    } else {
      i++;
    }
  }
  return map;
}

function parseVertText(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  let sessionName = '';
  let sessionDate = '';
  for (const line of lines.slice(0, 40)) {
    if (!sessionName && /^(Practice|Match|Game|Training|Scrimmage)\s*[-–]\s*\d+/i.test(line)) {
      sessionName = line;
    }
    if (!sessionDate) {
      const d = parseDate(line);
      if (d) sessionDate = d;
    }
    if (sessionName && sessionDate) break;
  }

  const jumpSec = extractSection(lines, 'JUMP BREAKDOWN',    'LANDING BREAKDOWN');
  const landSec = extractSection(lines, 'LANDING BREAKDOWN', 'WORK BREAKDOWN');
  const workSec = extractSection(lines, 'WORK BREAKDOWN');

  const jumpMap = parseRows(jumpSec, 4);
  const landMap = parseRows(landSec, 3);
  const workMap = parseRows(workSec, 3);

  const allNames = new Set([...Object.keys(jumpMap), ...Object.keys(landMap), ...Object.keys(workMap)]);

  const players = [...allNames].map(name => {
    const j = jumpMap[name] || [];
    const l = landMap[name] || [];
    const w = workMap[name] || [];
    return {
      vert_name:         name,
      jumps:             j[0] ?? null,
      avg_hi_jump_cm:    j[1] ?? null,
      jpam:              j[2] ?? null,
      avg_hi_jump_power: j[3] ?? null,
      high_impact_pct:   l[0] ?? null,
      alert_impact_pct:  l[1] ?? null,
      elevated_pct:      l[2] ?? null,
      energy:            w[0] ?? null,
      sets_by_energy:    w[1] ?? null,
      intensity:         w[2] ?? null,
    };
  });

  return { session_name: sessionName, session_date: sessionDate, players };
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req) {
  const form = await req.formData();
  const file = form.get('file');
  if (!file) return Response.json({ error: 'No file' }, { status: 400 });

  const buf = Buffer.from(await file.arrayBuffer());

  let rawText;
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const parsed   = await pdfParse(buf);
    rawText = parsed.text;
  } catch (err) {
    return Response.json({ error: 'PDF read failed: ' + err.message }, { status: 422 });
  }

  const result = parseVertText(rawText);

  if (result.players.length === 0) {
    result._raw    = rawText.slice(0, 3000);
    result._notice = 'No players found — check _raw to see extracted text';
  }

  return Response.json(result);
}
