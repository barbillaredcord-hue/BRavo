import { neon } from '@neondatabase/serverless';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({ok:false,error:'Método no permitido'});}
 if(!process.env.DATABASE_URL)return res.status(503).json({ok:false,error:'Catálogo no disponible'});
 try{
  const sql=neon(process.env.DATABASE_URL);
  const t=await sql`SELECT to_regclass('public.bravo_partners') AS p,to_regclass('public.bravo_partner_services') AS s,to_regclass('public.bravo_partner_domains') AS d`;
  if(!t[0]?.p||!t[0]?.s||!t[0]?.d)return res.status(200).json({ok:true,partners:[],notice:'Catálogo de proveedores aún no habilitado'});
  const id=typeof req.query?.id==='string'?req.query.id:'';
  if(id&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))return res.status(400).json({ok:false,error:'Identificador inválido'});
  const partners=await sql`
   SELECT p.id,p.display_name,p.description,p.website_url,
    (SELECT json_agg(json_build_object('id',s.id,'title',s.title,'description',s.description,'category',s.category) ORDER BY s.created_at)
      FROM bravo_partner_services s WHERE s.partner_id=p.id AND s.active=true) AS services
   FROM bravo_partners p WHERE p.status='approved'
    AND (${id}='' OR p.id::text=${id})
    AND EXISTS(SELECT 1 FROM bravo_partner_domains d WHERE d.partner_id=p.id AND d.verified_at IS NOT NULL)
    AND EXISTS(SELECT 1 FROM bravo_partner_services s WHERE s.partner_id=p.id AND s.active=true)
   ORDER BY p.created_at DESC LIMIT 100`;
  if(id&&!partners.length)return res.status(404).json({ok:false,error:'Proveedor no disponible'});
  return res.status(200).json({ok:true,partners});
 }catch(error){console.error('public partner catalog failed',error);return res.status(500).json({ok:false,error:'No se pudo consultar el catálogo'});}
}
