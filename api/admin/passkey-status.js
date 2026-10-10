// Non-sensitive readiness check. Never exposes credential data or secrets.
export default function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Method not allowed'});}
 const origin=process.env.BRAVO_WEBAUTHN_ORIGIN;
 const rpId=process.env.BRAVO_WEBAUTHN_RP_ID;
 const email=process.env.BRAVO_ADMIN_EMAIL;
 let valid=false;
 try{const url=new URL(origin);valid=url.protocol==='https:'&&url.hostname===rpId&&!url.username&&!url.password&&url.pathname==='/';}catch{}
 return res.status(200).json({ok:true,passkeyReady:false,configurationValid:Boolean(valid&&email),message:'WebAuthn aún no está habilitado. Falta registrar una credencial mediante un flujo autorizado y verificarla en servidor.'});
}
