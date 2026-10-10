import { neon } from '@neondatabase/serverless';
import { authorizeAdmin } from '../../lib/adminAuth.js';
const sql=neon(process.env.DATABASE_URL);
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Method not allowed'});}
 try{
  await authorizeAdmin(req);
  const table=await sql`SELECT to_regclass('public.bravo_partner_applications') AS table_name`;
  if(!table[0]?.table_name)return res.status(200).json({ok:true,applications:[],notice:'Todavía no se ha creado la tabla de solicitudes.'});
  const applications=await sql`SELECT id,business_name,contact_email,service_description,website_url,status,created_at FROM bravo_partner_applications ORDER BY created_at DESC LIMIT 200`;
  return res.status(200).json({ok:true,applications});
 }catch(e){console.error('partner admin read failed',e);return res.status(401).json({ok:false,error:'No se pudo verificar la sesión'});}
}
