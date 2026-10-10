import { neon } from '@neondatabase/serverless';
import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'});}
 const rpID=process.env.BRAVO_WEBAUTHN_RP_ID;
 const origin=process.env.BRAVO_WEBAUTHN_ORIGIN;
 if(!rpID||!origin||origin!==`https://${rpID}`)return res.status(503).json({ok:false,error:'Passkeys no configuradas'});
 if(!process.env.DATABASE_URL)return res.status(503).json({ok:false,error:'Base de datos no configurada'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  const table=await sql`SELECT to_regclass('public.bravo_admin_passkeys') AS credentials, to_regclass('public.bravo_admin_passkey_challenges') AS challenges`;
  if(!table[0]?.credentials||!table[0]?.challenges)return res.status(503).json({ok:false,error:'Migración de passkeys pendiente'});
  const credentials=await sql`SELECT credential_id FROM bravo_admin_passkeys WHERE admin_email=${(process.env.BRAVO_ADMIN_EMAIL||'').toLowerCase()} LIMIT 30`;
  if(!credentials.length)return res.status(409).json({ok:false,error:'Primera passkey pendiente de activación segura'});
  const options=await generateAuthenticationOptions({rpID,userVerification:'required',allowCredentials:credentials.map(c=>({id:c.credential_id}))});
  await sql`INSERT INTO bravo_admin_passkey_challenges(challenge_hash,purpose,expires_at)
    VALUES(${digest(options.challenge)},'authenticate',now()+interval '5 minutes')`;
  return res.status(200).json({ok:true,options});
 }catch(error){console.error('webauthn options failed',error);return res.status(500).json({ok:false,error:'No se pudo preparar la autenticación'});}
}
