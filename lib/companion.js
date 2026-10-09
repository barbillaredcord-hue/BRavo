// BR Companion 0.2A: deterministic need interpretation, no external AI or user profiling.
const groups=[
 {id:'training',category:'Entrenamiento',label:'Actividad física y entrenamiento',terms:['entren','gimnas','ejercicio','muay','mma','box','deporte','condicion fisica','defensa personal']},
 {id:'legal',category:'Legal',label:'Orientación jurídica',terms:['abog','legal','demanda','despid','contrato','divorcio','custodia','pension','laboral']},
 {id:'marketing',category:'Publicidad',label:'Conseguir clientes y comunicar',terms:['publicidad','marketing','anuncio','redes','promocion','atraer clientes','vender mas','ventas online']},
 {id:'operations',category:'Operación',label:'Organizar la operación del negocio',terms:['inventario','administr','erp','control','compras','factura','ordenar negocio','gestion']},
 {id:'suppliers',category:'Proveedores',label:'Encontrar proveedores',terms:['proveedor','mayoreo','suministro','abastec','distribuidor']},
 {id:'construction',category:'Construcción',label:'Construir, reparar o remodelar',terms:['remodel','constru','repar','instala','ventana','vidrio','aluminio','carpinter','casa','obra']},
 {id:'products',category:'Productos',label:'Encontrar productos',terms:['comprar','producto','tienda','precio','articulo']}
];
const normalize=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim();
export function interpretNeed(input){
 const q=normalize(input);
 const matched=groups.map(g=>({...g,score:g.terms.reduce((n,t)=>n+(q.includes(t)?1:0),0)})).filter(g=>g.score>0).sort((a,b)=>b.score-a.score);
 const openingBusiness=/abrir|montar|emprender|iniciar/.test(q)&&/negocio|empresa|taller|tienda/.test(q);
 const wantsSuppliers=/proveedor|suministro|mayoreo|abastec|distribuidor/.test(q);
 const main=(wantsSuppliers?matched.find(g=>g.id==='suppliers'):null)||matched[0]||null;
 const context={beginner:/primera vez|empezar|principiante|desde cero/.test(q),urgent:/urgente|hoy|inmediato/.test(q),budget:/presupuesto|barato|economico|costo|precio/.test(q)};
 const questions=[];
 if(!main) questions.push('¿Qué quieres lograr exactamente?');
 if(main&&main.id==='training') questions.push('¿Prefieres clases grupales o atención individual?');
 if(main&&main.id==='legal') questions.push('¿Tu situación es laboral, familiar o de otra especialidad?');
 if(main?.id==='suppliers') questions.push('¿Qué tipo de proveedores necesitas: aluminio, vidrio, herrajes, herramientas u otros?');
 if(main&&['marketing','operations'].includes(main.id)) questions.push('¿Qué problema necesitas resolver primero en tu negocio?');
 if(main&&main.id==='construction') questions.push('¿Necesitas materiales, instalación o ambos?');
 if(!context.budget) questions.push('¿Tienes un presupuesto o rango aproximado?');
 return {goal:openingBusiness&&wantsSuppliers?'Abrir un negocio y encontrar proveedores':main?.label||'Explorar soluciones',category:main?.category||null,alternateCategories:matched.slice(1,3).map(g=>g.category),context,questions:questions.slice(0,2),confidence:!main?'low':main.score>=2?'high':'medium'};
}
export function rankListing(listing,need,query){
 const hay=normalize([listing.name,listing.category,listing.type,listing.reference,listing.reason,listing.search_text].join(' '));
 const stop=new Set(['quiero','necesito','para','con','que','una','uno','por','algo','como','desde','tengo','busco','hacer','servicio','servicios','negocio']);
 const terms=normalize(query).split(' ').filter(t=>t.length>=3&&!stop.has(t));
 let score=terms.reduce((n,t)=>n+(hay.includes(t)?2:0),0);
 if(need.category===listing.category) score+=12;
 if(need.alternateCategories.includes(listing.category)) score+=3;
 return score;
}
