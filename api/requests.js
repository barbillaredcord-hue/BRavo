import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS bravo_requests (
      id text PRIMARY KEY,
      created_at timestamptz NOT NULL DEFAULT now(),
      business text NOT NULL,
      category text NOT NULL,
      need text NOT NULL,
      goal text NOT NULL,
      details text NOT NULL DEFAULT '',
      contact text NOT NULL,
      status text NOT NULL DEFAULT 'Nueva'
        CHECK (status IN ('Nueva','En proceso','Cerrada'))
    )
  `;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    await ensureSchema();
    const { id, business, category, need, goal, details = '', contact } = req.body || {};
    if (![id, business, category, need, goal, contact].every(v => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ ok: false, error: 'Invalid request' });
    }
    if ([id,business,category,need,goal,details,contact].some(v => typeof v === 'string' && v.length > 2000)) {
      return res.status(400).json({ ok: false, error: 'Request too large' });
    }

    const rows = await sql`
      INSERT INTO bravo_requests (id,business,category,need,goal,details,contact)
      VALUES (${id},${business},${category},${need},${goal},${details},${contact})
      ON CONFLICT (id) DO NOTHING
      RETURNING id, created_at
    `;
    return res.status(201).json({ ok: true, request: rows[0] || { id } });
  } catch (error) {
    console.error('bravo request create failed', error);
    return res.status(500).json({ ok: false, error: 'Unable to create request' });
  }
}
