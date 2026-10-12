import { createRemoteJWKSet, jwtVerify } from 'jose';
export async function authorizeEnrollment(req,sql,email){
 const header=String(req.headers.authorization||'');
 if(!/^Bearer\s+/i.test(header))throw new Error('AUTH_REQUIRED');
 const supplied=header.replace(/^Bearer\s+/i,'');
 const base=process.env.NEON_AUTH_BASE_URL;
 if(!base)throw new Error('AUTH_REQUIRED');
 const url=new URL(base);
 const {payload}=await jwtVerify(supplied,createRemoteJWKSet(new URL('/.well-known/jwks.json',url)),{issuer:url.origin});
 if(String(payload.email||'').trim().toLowerCase()!==email)throw new Error('FORBIDDEN');
 return 'neon';
}
