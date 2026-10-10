import { neon } from '@neondatabase/serverless';
import { createHash } from 'node:crypto';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'});}
 const cookie=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bravo_admin_session='));
 if(cookie&&process.env.DATABASE_URL){
  const token=cookie.slice('bravo_admin_session='.length);
  if(/^[A-Za-z0-9_-]{43}$/.test(token)){
   try{const sql=neon(process.env.DATABASE_URL);await sql`UPDATE bravo_admin_sessions SET revoked_at=now() WHERE token_hash=${createHash('sha256').update(token).digest('hex')}`;}catch(e){console.error('passkey logout failed',e);return res.status(503).json({ok:false,error:'No se pudo cerrar la sesión'});}
  }
 }
 res.setHeader('Set-Cookie','bravo_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=0');
 return res.status(200).json({ok:true});
}
