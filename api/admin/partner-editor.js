import { neon } from '@neondatabase/serverless';
import { authorizeAdmin } from '../../lib/adminAuth.js';
const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','POST'].includes(req.method)){res.setHeader('Allow','GET, POST');return res.status(405).json({ok:false,error:'Método no permitido'});}
 try{
  await authorizeAdmin(req);
  const sql=neon(process.env.DATABASE_URL);
  const t=await sql`SELECT to_regclass('public.bravo_partners') AS partners,to_regclass('public.bravo_partner_services') AS services`;
  if(!t[0]?.partners||!t[0]?.services)return res.status(409).json({ok:false,error:'Falta aplicar la migración 003_bravo_partners.sql en Neon.'});
  if(req.method==='GET'){
   const partners=await sql`SELECT id,display_name,description,website_url,status,created_at FROM bravo_partners ORDER BY created_at DESC LIMIT 100`;
   const services=await sql`SELECT id,partner_id,title,description,category,active FROM bravo_partner_services ORDER BY created_at DESC LIMIT 300`;
   return res.status(200).json({ok:true,partners,services});
  }
  if(req.headers.origin!==process.env.BRAVO_WEBAUTHN_ORIGIN)return res.status(403).json({ok:false,error:'Origen no autorizado'});
  if(Number(req.headers['content-length']||0)>8192)return res.status(413).json({ok:false,error:'Datos demasiado grandes'});
  const b=req.body||{};
  if(b.action==='create_partner'){
   const name=clean(b.name,120),description=clean(b.description,1200),website=clean(b.website,300);
   if(name.length<3)return res.status(400).json({ok:false,error:'El nombre requiere al menos 3 caracteres'});
   if(website){try{const u=new URL(website);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error();}catch{return res.status(400).json({ok:false,error:'Sitio web inválido'});}}
   const rows=await sql`INSERT INTO bravo_partners(legal_name,display_name,description,website_url,status) VALUES(${name},${name},${description},${website||null},'draft') RETURNING id,status`;
   return res.status(201).json({ok:true,partner:rows[0],notice:'Borrador creado; no está publicado'});
  }
  if(b.action==='create_service'){
   const id=clean(b.partnerId,40),title=clean(b.title,120),category=clean(b.category,80),description=clean(b.description,1000);
   if(!uuid.test(id)||title.length<3||category.length<2)return res.status(400).json({ok:false,error:'Datos del servicio incompletos'});
   const rows=await sql`INSERT INTO bravo_partner_services(partner_id,title,description,category,active)
    SELECT id,${title},${description},${category},false FROM bravo_partners WHERE id=${id} AND status='draft' RETURNING id,active`;
   if(!rows.length)return res.status(409).json({ok:false,error:'El negocio debe estar en borrador'});
   return res.status(201).json({ok:true,service:rows[0],notice:'Servicio guardado inactivo'});
  }
  return res.status(400).json({ok:false,error:'Acción no válida'});
 }catch(e){console.error('partner editor failed',e);return res.status(e.status===403?403:e.status===401?401:500).json({ok:false,error:'No se pudo procesar la solicitud'});}
}
