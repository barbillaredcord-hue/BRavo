import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { generateRegistrationOptions } from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'});}
 const email=(process.env.BRAVO_ADMIN_EMAIL||'').trim().toLowerCase();
 const rpID=process.env.BRAVO_WEBAUTHN_RP_ID;
 const origin=process.env.BRAVO_WEBAUTHN_ORIGIN;
 const base=process.env.NEON_AUTH_BASE_URL;
 if(!email||!rpID||origin!==`https://${rpID}`||!base||!process.env.DATABASE_URL)return res.status(503).json({ok:false,error:'Configuración incompleta'});
 try{
  const header=req.headers.authorization||'';
  if(!header.startsWith('Bearer '))return res.status(401).json({ok:false,error:'Se requiere una sesión administradora verificada para registrar la primera passkey'});
  const url=new URL(base);
  const {payload}=await jwtVerify(header.slice(7),createRemoteJWKSet(new URL('/.well-known/jwks.json',url)),{issuer:url.origin});
  if(String(payload.email||'').toLowerCase()!==email)return res.status(403).json({ok:false,error:'Cuenta no autorizada'});
  const sql=neon(process.env.DATABASE_URL);
  const existing=await sql`SELECT credential_id FROM bravo_admin_passkeys WHERE lower(admin_email)=${email} LIMIT 50`;
  const options=await generateRegistrationOptions({rpName:'BRavo Admin',rpID,userName:email,userDisplayName:'Administrador BRavo',attestationType:'none',authenticatorSelection:{residentKey:'required',userVerification:'required'},excludeCredentials:existing.map(x=>({id:x.credential_id}))});
  await sql`INSERT INTO bravo_admin_passkey_challenges(challenge_hash,purpose,admin_email,expires_at) VALUES(${hash(options.challenge)},'register',${email},now()+interval '5 minutes')`;
  return res.status(200).json({ok:true,options});
 }catch(e){console.error('passkey enrollment options failed',e);return res.status(401).json({ok:false,error:'No se pudo autorizar el registro'});}
}
