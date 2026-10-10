import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Method not allowed'});}
 try{
  const base=process.env.NEON_AUTH_BASE_URL,email=(process.env.BRAVO_ADMIN_EMAIL||'').trim().toLowerCase();
  if(!base||!email)return res.status(503).json({ok:false,error:'Admin no configurado'});
  const header=req.headers.authorization||'';
  if(!/^Bearer\s+/i.test(header))return res.status(401).json({ok:false,error:'Inicia sesión'});
  const url=new URL(base);
  const keys=createRemoteJWKSet(new URL('/.well-known/jwks.json',url));
  const verified=await jwtVerify(header.replace(/^Bearer\s+/i,''),keys,{issuer:url.origin});
  if(String(verified.payload.email||'').toLowerCase()!==email)return res.status(403).json({ok:false,error:'Cuenta no autorizada'});
  const table=await sql`SELECT to_regclass('public.bravo_partner_applications') AS table_name`;
  if(!table[0]?.table_name)return res.status(200).json({ok:true,applications:[],notice:'Todavía no se ha creado la tabla de solicitudes.'});
  const applications=await sql`SELECT id,business_name,contact_email,service_description,website_url,status,created_at FROM bravo_partner_applications ORDER BY created_at DESC LIMIT 200`;
  return res.status(200).json({ok:true,applications});
 }catch(e){console.error('partner admin read failed',e);return res.status(401).json({ok:false,error:'No se pudo verificar la sesión'});}
}
