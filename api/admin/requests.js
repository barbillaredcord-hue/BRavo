import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const sql = neon(process.env.DATABASE_URL);
const authBase = process.env.NEON_AUTH_BASE_URL;
const allowedEmail = (process.env.BRAVO_ADMIN_EMAIL || '').toLowerCase();
const keys = createRemoteJWKSet(new URL(authBase + '/.well-known/jwks.json'));
const issuer = new URL(authBase).origin;

async function authorize(req) {
  const header = req.headers.authorization || '';
  if (!header.toLowerCase().startsWith('bearer ')) {
    const error = new Error('Unauthorized'); error.status = 401; throw error;
  }
  const verified = await jwtVerify(header.slice(7), keys, { issuer });
  const email = String(verified.payload.email || '').toLowerCase();
  if (!email || email !== allowedEmail) {
    const error = new Error('Forbidden'); error.status = 403; throw error;
  }
  return verified.payload;
}

export default async function handler(req, res) {
  try {
    const user = await authorize(req);
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
