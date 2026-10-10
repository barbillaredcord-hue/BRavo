import { neon } from '@neondatabase/serverless';
import { authorizeAdmin } from '../../lib/adminAuth.js';
const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
  try {
    const user = await authorizeAdmin(req);
    if (req.method === 'GET') {
      const rows = await sql`SELECT id, created_at, business, category, need, goal, details, contact, status FROM bravo_requests ORDER BY created_at DESC LIMIT 200`;
      return res.status(200).json({ ok: true, user: { email: user.email }, requests: rows });
    }
    if (req.method === 'PATCH') {
      const body = req.body || {};
      if (typeof body.id !== 'string' || !['Nueva','En proceso','Cerrada'].includes(body.status)) {
        return res.status(400).json({ ok: false, error: 'Invalid update' });
      }
      const rows = await sql`UPDATE bravo_requests SET status = ${body.status} WHERE id = ${body.id} RETURNING id, status`;
      if (!rows.length) return res.status(404).json({ ok: false, error: 'Request not found' });
      return res.status(200).json({ ok: true, request: rows[0] });
    }
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    const status = error.status === 403 ? 403 : 401;
    return res.status(status).json({ ok: false, error: status === 403 ? 'Forbidden' : 'Unauthorized' });
  }
}
