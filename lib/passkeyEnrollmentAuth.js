import { createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const digest=s=>createHash('sha256').update(s).digest();
export async function authorizeEnrollment(req,sql,email){
 const header=String(req.headers.authorization||'');
 if(!/^Bearer\s+/i.test(header))throw new Error('AUTH_REQUIRED');
 const supplied=header.replace(/^Bearer\s+/i,'');
 const bootstrap=process.env.BRAVO_PASSKEY_BOOTSTRAP_SECRET||'';
 if(bootstrap.length>=43&&/^[A-Za-z0-9_-]+$/.test(bootstrap)&&supplied.length===bootstrap.length&&timingSafeEqual(digest(supplied),digest(bootstrap))){
  const rows=await sql`SELECT credential_id FROM bravo_admin_passkeys LIMIT 1`;
  if(rows.length)throw new Error('BOOTSTRAP_DISABLED');
  return 'bootstrap';
 }
 const base=process.env.NEON_AUTH_BASE_URL;
 if(!base)throw new Error('AUTH_REQUIRED');
 const url=new URL(base);
 const {payload}=await jwtVerify(supplied,createRemoteJWKSet(new URL('/.well-known/jwks.json',url)),{issuer:url.origin});
 if(String(payload.email||'').trim().toLowerCase()!==email)throw new Error('FORBIDDEN');
 return 'neon';
}
