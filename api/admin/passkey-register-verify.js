import { neon } from '@neondatabase/serverless';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { verifyRegistrationResponse } from '@simplewebauthn/server';
import { createHash } from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const decode=s=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));
const fail=(res,code,error)=>res.status(code).json({ok:false,error});
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return fail(res,405,'Method not allowed');}
 const email=(process.env.BRAVO_ADMIN_EMAIL||'').trim().toLowerCase();
 const rpID=process.env.BRAVO_WEBAUTHN_RP_ID;
 const origin=process.env.BRAVO_WEBAUTHN_ORIGIN;
 const base=process.env.NEON_AUTH_BASE_URL;
 if(!email||!rpID||origin!==`https://${rpID}`||!base||!process.env.DATABASE_URL)return fail(res,503,'Configuración incompleta');
 const header=req.headers.authorization||'';
 if(!header.startsWith('Bearer '))return fail(res,401,'Autorización de administrador requerida');
 try{
  const authURL=new URL(base);
  const {payload}=await jwtVerify(header.slice(7),createRemoteJWKSet(new URL('/.well-known/jwks.json',authURL)),{issuer:authURL.origin});
  if(String(payload.email||'').trim().toLowerCase()!==email)return fail(res,403,'Cuenta no autorizada');
  const response=req.body?.response;
  if(!response||typeof response.id!=='string'||!response.response?.clientDataJSON)return fail(res,400,'Registro WebAuthn inválido');
  const clientData=decode(response.response.clientDataJSON);
  if(clientData.type!=='webauthn.create'||typeof clientData.challenge!=='string')return fail(res,400,'Desafío inválido');
  const sql=neon(process.env.DATABASE_URL);
  const consumed=await sql`UPDATE bravo_admin_passkey_challenges SET consumed_at=now()
    WHERE challenge_hash=${hash(clientData.challenge)} AND purpose='register' AND lower(admin_email)=${email}
    AND consumed_at IS NULL AND expires_at>now() RETURNING id`;
  if(consumed.length!==1)return fail(res,401,'Desafío vencido o utilizado');
  const result=await verifyRegistrationResponse({response,expectedChallenge:clientData.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true});
  if(!result.verified||!result.registrationInfo?.credential)return fail(res,401,'No se pudo verificar el registro');
  const credential=result.registrationInfo.credential;
  const transports=Array.isArray(response.response.transports)?response.response.transports.filter(x=>typeof x==='string').slice(0,8):[];
  await sql`INSERT INTO bravo_admin_passkeys(credential_id,admin_email,public_key,counter,transports)
    VALUES(${credential.id},${email},${Buffer.from(credential.publicKey)},${credential.counter},${JSON.stringify(transports)}::jsonb)
    ON CONFLICT (credential_id) DO NOTHING`;
  return res.status(201).json({ok:true,registered:true});
 }catch(e){console.error('passkey enrollment verification failed',e);return fail(res,401,'Registro no autorizado o inválido');}
}
