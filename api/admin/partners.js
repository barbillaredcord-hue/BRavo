import { neon } from '@neondatabase/serverless';
import { authorizeAdmin } from '../../lib/adminAuth.js';
const sql=neon(process.env.DATABASE_URL);
const json=(res,status,body)=>res.status(status).json(body);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PATCH'].includes(req.method)){res.setHeader('Allow','GET, PATCH');return json(res,405,{ok:false,error:'Method not allowed'});}
 try{
  const admin=await authorizeAdmin(req);
  const table=await sql`SELECT to_regclass('public.bravo_partner_applications') AS table_name`;
  if(!table[0]?.table_name)return req.method==='GET'?json(res,200,{ok:true,applications:[],notice:'Todavía no hay solicitudes.'}):json(res,409,{ok:false,error:'No existe la bandeja de proveedores'});
  if(req.method==='GET'){
   const applications=await sql`SELECT id,business_name,contact_email,service_description,website_url,status,created_at FROM bravo_partner_applications ORDER BY created_at DESC LIMIT 200`;
   return json(res,200,{ok:true,applications});
  }
  if(req.headers.origin!==process.env.BRAVO_WEBAUTHN_ORIGIN)return json(res,403,{ok:false,error:'Origen no autorizado'});
  const {id,status,confirmation}=req.body||{};
  if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return json(res,400,{ok:false,error:'Identificador inválido'});
  if(!['approved','rejected'].includes(status)||confirmation!=='REVISADO_MANUALMENTE')return json(res,400,{ok:false,error:'Revisión y confirmación explícita requeridas'});
  const changed=await sql`UPDATE bravo_partner_applications SET status=${status} WHERE id=${id} AND status='pending_review' RETURNING id,status`;
  if(!changed.length)return json(res,409,{ok:false,error:'La solicitud ya fue procesada o no existe'});
  console.info('partner application reviewed',{id,status,admin:admin.email});
  return json(res,200,{ok:true,application:changed[0],notice:'Decisión interna; no publica negocios ni activa suscripciones.'});
 }catch(e){console.error('partner admin request failed',e);return json(res,e.status===403?403:401,{ok:false,error:'No se pudo completar la operación administrativa'});}
}
