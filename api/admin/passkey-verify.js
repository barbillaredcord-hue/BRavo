import { neon } from '@neondatabase/serverless';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { createHash, randomBytes } from 'node:crypto';

const hash=s=>createHash('sha256').update(s).digest('hex');
const b64url=s=>Buffer.from(s,'base64url').toString('utf8');
const error=(res,status,message)=>res.status(status).json({ok:false,error:message});

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return error(res,405,'Method not allowed');}
 const rpID=process.env.BRAVO_WEBAUTHN_RP_ID;
 const origin=process.env.BRAVO_WEBAUTHN_ORIGIN;
 const email=(process.env.BRAVO_ADMIN_EMAIL||'').trim().toLowerCase();
 if(!rpID||origin!==`https://${rpID}`||!email||!process.env.DATABASE_URL)return error(res,503,'Passkeys no configuradas');
 const response=req.body?.response;
 if(!response||typeof response.id!=='string'||response.id.length>2048||!response.response?.clientDataJSON)return error(res,400,'Respuesta WebAuthn inválida');
 try{
  const clientData=JSON.parse(b64url(response.response.clientDataJSON));
  if(clientData.type!=='webauthn.get'||typeof clientData.challenge!=='string')return error(res,400,'Desafío inválido');
  const sql=neon(process.env.DATABASE_URL);
  const consumed=await sql`UPDATE bravo_admin_passkey_challenges SET consumed_at=now()
    WHERE challenge_hash=${hash(clientData.challenge)} AND purpose='authenticate'
      AND consumed_at IS NULL AND expires_at>now() RETURNING challenge_hash`;
  if(consumed.length!==1)return error(res,401,'Desafío vencido o utilizado');
  const rows=await sql`SELECT credential_id,public_key,counter,transports FROM bravo_admin_passkeys
    WHERE credential_id=${response.id} AND lower(admin_email)=${email} LIMIT 1`;
  if(!rows.length)return error(res,401,'Passkey no autorizada');
  const credential=rows[0];
  const verification=await verifyAuthenticationResponse({
   response,expectedChallenge:clientData.challenge,expectedOrigin:origin,expectedRPID:rpID,
   requireUserVerification:true,
   credential:{id:credential.credential_id,publicKey:new Uint8Array(credential.public_key),counter:Number(credential.counter),transports:credential.transports||[]}
  });
  if(!verification.verified)return error(res,401,'Verificación de passkey fallida');
  const nextCounter=verification.authenticationInfo.newCounter;
  const updated=await sql`UPDATE bravo_admin_passkeys SET counter=${nextCounter},last_used_at=now()
    WHERE credential_id=${credential.credential_id} AND counter=${credential.counter} RETURNING credential_id`;
  if(updated.length!==1)return error(res,401,'Contador de credencial desactualizado');
  const token=randomBytes(32).toString('base64url');
  await sql`INSERT INTO bravo_admin_sessions(token_hash,admin_email,expires_at)
    VALUES(${hash(token)},${email},now()+interval '8 hours')`;
  res.setHeader('Set-Cookie',`bravo_admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=28800`);
  return res.status(200).json({ok:true,authenticated:true});
 }catch(e){console.error('passkey verification failed',e);return error(res,401,'No se pudo verificar la passkey');}
}
