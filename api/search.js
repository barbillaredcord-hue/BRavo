import { interpretNeed, rankListing } from '../lib/companion.js';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const seed = [
  ['north-fight-lab','North Fight Lab','Entrenamiento','Muay Thai · San Nicolás','Principiantes · desde $850/mes','Clases guiadas para empezar desde cero, técnica, condición física y comunidad.','entrenar muay thai ejercicio gimnasio defensa personal condicion fisica clases principiante'],
  ['distrito-combat','Distrito Combat','Entrenamiento','MMA · Monterrey','MMA + grappling · prueba gratuita','Alternativa para explorar striking y suelo antes de elegir una disciplina.','mma grappling boxeo entrenamiento combate gimnasio ejercicio'],
  ['coach-daniel','Coach Daniel M.','Entrenamiento','Entrenador independiente','Sesiones 1 a 1','Acompañamiento individual para objetivos físicos y técnicos específicos.','coach entrenador personal ejercicio acondicionamiento entrenamiento'],
  ['ruta-legal','Ruta legal BRavo','Legal','Orientación inicial','Aclara el tipo de situación','Primera orientación para entender qué especialidad o profesional puede ayudarte.','legal abogado asesoria problema contrato familiar laboral mercantil'],
  ['lex-norte','Lex Norte','Legal','Derecho laboral','Consulta presencial o videollamada','Orientación en trabajo, contratos, terminación laboral y relaciones laborales.','abogado laboral trabajo contrato despido empleo legal'],
  ['punto-juridico','Punto Jurídico','Legal','Derecho familiar','Asesoría · Monterrey','Atención para asuntos familiares y representación jurídica.','abogado familiar divorcio custodia pension legal'],
  ['estudio-nexo','Estudio Nexo','Publicidad','Marketing y contenido','Contenido · campañas · diseño','Ayuda a negocios que necesitan visibilidad, contenido y campañas.','publicidad marketing redes clientes contenido diseño negocio ventas'],
  ['br-tu-negocio','BRTuNegocio','Operación','ERP para negocio','Inventario · compras · ventas','Control operativo para empresas que necesitan ordenar inventario, compras y ventas.','negocio administrar inventario compras ventas erp operacion control'],
  ['red-industrial','Red Industrial Norte','Proveedores','Red B2B','Materiales y suministros','Conecta negocios con proveedores y opciones de abastecimiento.','proveedor materiales suministros mayoreo negocio b2b compras'],
  ['obra-conecta','Obra Conecta','Construcción','Casa y proyectos','Materiales · oficios · instalación','Opciones para remodelación, materiales, técnicos y oficios.','casa construir remodelar materiales instalacion tecnico carpinteria vidrio aluminio'],
  ['mercado-local','Mercado Local BRavo','Productos','Productos locales','Comparar opciones cercanas','Descubre productos por necesidad y compara condiciones antes de comprar.','comprar producto tienda precio comparar local']
];

async function ensureCatalog(){
  await sql`
    CREATE TABLE IF NOT EXISTS bravo_listings (
      id text PRIMARY KEY,
      name text NOT NULL,
      category text NOT NULL,
      type text NOT NULL,
      reference text NOT NULL,
      reason text NOT NULL,
      search_text text NOT NULL,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  for (const row of seed) {
    await sql`
      INSERT INTO bravo_listings (id,name,category,type,reference,reason,search_text)
      VALUES (${row[0]},${row[1]},${row[2]},${row[3]},${row[4]},${row[5]},${row[6]})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

async function getApprovedPartners(){
  // Migration 003 may not have been applied yet. Keep demo search working.
  const availability=await sql`SELECT to_regclass('public.bravo_partners') AS partners, to_regclass('public.bravo_partner_services') AS services`;
  if(!availability[0]?.partners||!availability[0]?.services)return [];
  const rows=await sql`
    SELECT s.id::text AS id,p.display_name AS name,s.category,
      s.title AS type, 'Servicio publicado'::text AS reference,
      s.description AS reason,
      (p.display_name || ' ' || s.title || ' ' || s.category || ' ' || s.description) AS search_text,
      p.id::text AS partner_id
    FROM bravo_partner_services s
    JOIN bravo_partners p ON p.id=s.partner_id
    WHERE p.status='approved' AND s.active=true
    ORDER BY s.created_at DESC LIMIT 250
  `;
  return rows.map(r=>({...r,id:'partner:'+r.id,source:'partner',verified:true}));
}
export default async function handler(req,res){
  if(req.method!=='GET'){
    res.setHeader('Allow','GET');
    return res.status(405).json({ok:false,error:'Method not allowed'});
  }
  try{
    await ensureCatalog();
    const q=String(req.query?.q||'').trim().toLowerCase().slice(0,200);
    if(!q) return res.status(400).json({ok:false,error:'Missing query'});
    const need=interpretNeed(q);
    const rows=await sql`
      SELECT id,name,category,type,reference,reason,search_text
      FROM bravo_listings
      WHERE active=true
      ORDER BY created_at ASC
    `;
    const partnerRows=await getApprovedPartners();
    const all=[...partnerRows,...rows.map(r=>({...r,source:'demo',verified:false}))];
    const scored=all.map(r=>({...r,score:rankListing(r,need,q)}))
      .filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,6);
    return res.status(200).json({
      ok:true,query:q,
      interpretation:need.category
        ? 'Entendimos una posible ruta: '+need.goal+'. Puedes explorar otras alternativas.'
        : 'Necesitamos un poco más de contexto para orientar tu búsqueda.',
      companion:need,
      results:scored.map(({search_text,score,...r})=>r),
      catalog:{approvedPartners:partnerRows.length,demoResults:scored.filter(r=>r.source==='demo').length}
    });
  }catch(error){
    console.error('bravo search failed',error);
    return res.status(500).json({ok:false,error:'Unable to search'});
  }
}
