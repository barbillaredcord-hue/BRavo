import { neon } from '@neondatabase/serverless';
const sql=neon(process.env.DATABASE_URL);
const clean=(x,max)=>typeof x==='string'?x.trim().slice(0,max):'';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed'});}
 const body=req.body||{};
 if(body.website_check)return res.status(200).json({ok:true,message:'Solicitud recibida'});
 const name=clean(body.businessName,120),contact=clean(body.contactEmail,180),service=clean(body.service,500),website=clean(body.website,300);
 if(name.length<3||service.length<10||!/^\S+@\S+\.\S+$/.test(contact))return res.status(400).json({ok:false,error:'Completa el nombre, correo y descripción del servicio.'});
 if(website){try{const u=new URL(website);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return res.status(400).json({ok:false,error:'URL no válida'});}catch{return res.status(400).json({ok:false,error:'URL no válida'});}}
 try{
  await sql`CREATE TABLE IF NOT EXISTS bravo_partner_applications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name text NOT NULL,contact_email text NOT NULL,service_description text NOT NULL,
    website_url text,status text NOT NULL DEFAULT 'pending_review'
    CHECK(status IN ('pending_review','approved','rejected')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`;
  await sql`INSERT INTO bravo_partner_applications(business_name,contact_email,service_description,website_url)
  VALUES(${name},${contact.toLowerCase()},${service},${website||null})`;
  return res.status(202).json({ok:true,message:'Solicitud recibida para revisión. No implica aprobación ni suscripción.'});
 }catch(e){console.error('partner application failed',e);return res.status(500).json({ok:false,error:'No se pudo guardar la solicitud.'});}
}
