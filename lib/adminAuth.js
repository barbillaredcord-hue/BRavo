import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { createHash } from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const unauthorized=(status=401)=>Object.assign(new Error(status===403?'Forbidden':'Unauthorized'),{status});
export async function authorizeAdmin(req){
 const email=(process.env.BRAVO_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!email)throw unauthorized(503);
 const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bravo_admin_session='));
 if(cookie){
  const token=cookie.slice('bravo_admin_session='.length);
  if(!/^[a-zA-Z0-9_-]{43}$/.test(token))throw unauthorized();
  if(!process.env.DATABASE_URL)throw unauthorized(503);
  const sql=neon(process.env.DATABASE_URL);
  const rows=await sql`SELECT admin_email FROM bravo_admin_sessions WHERE token_hash=${hash(token)} AND revoked_at IS NULL AND expires_at>now() LIMIT 1`;
  if(!rows.length||String(rows[0].admin_email).toLowerCase()!==email)throw unauthorized();
  return {email,method:'passkey'};
 }
 const header=String(req.headers.authorization||'');
 if(!/^Bearer\s+/i.test(header))throw unauthorized();
 const base=process.env.NEON_AUTH_BASE_URL;
 if(!base)throw unauthorized(503);
 const url=new URL(base);
 const verified=await jwtVerify(header.replace(/^Bearer\s+/i,''),createRemoteJWKSet(new URL('/.well-known/jwks.json',url)),{issuer:url.origin});
 if(String(verified.payload.email||'').trim().toLowerCase()!==email)throw unauthorized(403);
 return {email,method:'neon'};
}
