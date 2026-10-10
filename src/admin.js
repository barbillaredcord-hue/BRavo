import { createAuthClient } from '@neondatabase/auth';
const authClient=createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);
let rows=[],stateFilter='all',categoryFilter='all',query='',selectedId=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const msg=t=>{const e=document.getElementById('msg');if(e)e.textContent=t||''};
async function bearer(){const s=await authClient.getSession();const t=s?.data?.session?.access_token||s?.data?.session?.accessToken||await authClient.getJWTToken?.();if(!t)throw new Error('No active session');return t}
async function load(){let headers={};try{headers.Authorization='Bearer '+await bearer()}catch{}const r=await fetch('/api/admin/requests',{headers,credentials:'same-origin'});if(!r.ok)throw new Error(r.status===403?'Esta cuenta no tiene acceso al Admin.':'No se pudo cargar el Admin.');const d=await r.json();rows=d.requests||[];login.classList.add('hidden');admin.classList.remove('hidden');populateCategories();render(stateFilter)}
async function google(){msg('Abriendo Google…');await authClient.signIn.social({provider:'google',callbackURL:location.origin+'/admin.html'})}
async function signOut(){const r=await fetch('/api/admin/passkey-logout',{method:'POST',credentials:'same-origin'});if(!r.ok)throw new Error('No se pudo cerrar la sesión de passkey.');await authClient.signOut().catch(()=>{});rows=[];admin.classList.add('hidden');login.classList.remove('hidden');msg('Sesión cerrada.')}
async function updateStatus(id,status){let headers={'Content-Type':'application/json'};try{headers.Authorization='Bearer '+await bearer()}catch{}const r=await fetch('/api/admin/requests',{method:'PATCH',credentials:'same-origin',headers,body:JSON.stringify({id,status})});if(!r.ok)throw new Error('No se pudo actualizar el estado.');await load();select(id)}
function populateCategories(){const s=document.getElementById('categoryFilter');if(!s)return;const cats=[...new Set(rows.map(x=>x.category).filter(Boolean))];s.innerHTML='<option value="all">Todas las categorías</option>'+cats.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');s.value=categoryFilter}
function statusClass(s){return s==='Nueva'?'new':s==='En proceso'?'progress':'closed'}
function filtered(){return rows.filter(x=>(stateFilter==='all'||x.status===stateFilter)&&(categoryFilter==='all'||x.category===categoryFilter)&&(!query||[x.business,x.category,x.need,x.goal,x.details,x.contact].join(' ').toLowerCase().includes(query)))}
function render(filter='all'){stateFilter=filter;total.textContent=rows.length;newCount.textContent=rows.filter(x=>x.status==='Nueva').length;progressCount.textContent=rows.filter(x=>x.status==='En proceso').length;closedCount.textContent=rows.filter(x=>x.status==='Cerrada').length;const items=filtered();requests.innerHTML=items.length?items.map((x,i)=>`<div class="row ${selectedId===x.id?'selected':''}" onclick="adminSelect('${esc(x.id)}')"><b>${String(i+1).padStart(3,'0')}</b><b>${esc(x.business)}</b><span><i class="pill cat">${esc(x.category)}</i></span><span>${esc(x.goal||x.need)}</span><span><i class="pill ${statusClass(x.status)}">${esc(x.status)}</i></span><span>${new Date(x.created_at||x.createdAt).toLocaleDateString('es-MX')}</span></div>`).join(''):'<div class="empty">Todavía no hay solicitudes en BRavo.</div>'}
function select(id){selectedId=id;render(stateFilter);const x=rows.find(r=>r.id===id);if(!x)return;detail.innerHTML=`<h2>Detalle de la solicitud <span class="pill cat" style="float:right">#${esc(x.id)}</span></h2><dl><dt>Nombre</dt><dd>${esc(x.business)}</dd><dt>Contacto</dt><dd>${esc(x.contact)}</dd><dt>Categoría</dt><dd><span class="pill cat">${esc(x.category)}</span></dd><dt>Fecha</dt><dd>${new Date(x.created_at||x.createdAt).toLocaleString('es-MX')}</dd></dl><h3>Necesidad</h3><div class="message"><b>${esc(x.goal)}</b><br><br>${esc(x.need)}${x.details?'<br><br>'+esc(x.details):''}</div><label><b>Estado</b></label><select id="detailStatus"><option ${x.status==='Nueva'?'selected':''}>Nueva</option><option ${x.status==='En proceso'?'selected':''}>En proceso</option><option ${x.status==='Cerrada'?'selected':''}>Cerrada</option></select><label style="display:block;margin-top:14px"><b>Notas internas</b></label><textarea placeholder="Agregar una nota…"></textarea><button class="primary save" onclick="adminSaveDetail('${esc(x.id)}')">Guardar cambios</button>`}

const fromBase64url=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));
const toBase64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=+$/,'');
async function passkeyLogin(){
 if(!window.PublicKeyCredential||!navigator.credentials){msg('Este navegador no admite passkeys.');return}
 msg('Preparando acceso con passkey…');
 const r=await fetch('/api/admin/passkey-options',{method:'POST',credentials:'same-origin'});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'No se pudo preparar Touch ID');
 const options=data.options;
 options.challenge=fromBase64url(options.challenge);
 options.allowCredentials=(options.allowCredentials||[]).map(x=>({...x,id:fromBase64url(x.id)}));
 const credential=await navigator.credentials.get({publicKey:options});
 if(!credential)throw new Error('No se seleccionó una passkey');
 const response={id:credential.id,rawId:toBase64url(credential.rawId),type:credential.type,response:{authenticatorData:toBase64url(credential.response.authenticatorData),clientDataJSON:toBase64url(credential.response.clientDataJSON),signature:toBase64url(credential.response.signature),userHandle:credential.response.userHandle?toBase64url(credential.response.userHandle):undefined},clientExtensionResults:credential.getClientExtensionResults()};
 const verify=await fetch('/api/admin/passkey-verify',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({response})});
 const result=await verify.json();if(!verify.ok)throw new Error(result.error||'Passkey no autorizada');
 await load();msg('');
}
window.adminPasskeyLogin=()=>passkeyLogin().catch(e=>msg(e.message||'No se pudo iniciar con passkey'));

window.adminGoogleLogin=()=>google().catch(e=>msg(e.message||'No se pudo iniciar con Google.'));
window.adminSignOut=()=>signOut().catch(e=>msg(e.message));window.adminRender=render;window.adminSelect=select;
window.adminSearch=v=>{query=v.toLowerCase().trim();render(stateFilter)};
window.adminCategory=v=>{categoryFilter=v;render(stateFilter)};
window.adminSaveDetail=id=>updateStatus(id,document.getElementById('detailStatus').value).catch(e=>alert(e.message));
window.addEventListener('DOMContentLoaded',async()=>{
  try{
    const params=new URLSearchParams(location.search);
    const authError=params.get('error')||params.get('error_description');
    if(authError){msg('Google devolvió un error: '+authError+'. Puedes utilizar una passkey ya registrada.');}

    msg('Comprobando sesión…');
    let session=null;
    for(let i=0;i<10;i++){
      const s=await authClient.getSession();
      session=s?.data?.session||null;
      if(session) break;
      await new Promise(r=>setTimeout(r,500));
    }

    try{await load();if(session)history.replaceState({},'',location.pathname)}catch{if(!authError)msg('Inicia con una passkey registrada. Si es tu primer acceso, falta activar tu credencial administradora.')}
  }catch(e){
    msg(e.message==='No active session'?'':e.message);
  }
});
