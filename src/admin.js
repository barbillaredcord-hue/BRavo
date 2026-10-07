import { createAuthClient } from '@neondatabase/auth';

const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);
let rows = [];

function setMsg(text){ const el=document.getElementById('msg'); if(el) el.textContent=text||''; }

async function bearer(){
  const session = await authClient.getSession();
  const token = session?.data?.session?.access_token || session?.data?.session?.accessToken || await authClient.getJWTToken?.();
  if(!token) throw new Error('No active session');
  return token;
}

async function load(){
  const token = await bearer();
  const response = await fetch('/api/admin/requests',{headers:{Authorization:'Bearer '+token}});
  if(!response.ok) throw new Error(response.status===403?'Esta cuenta no tiene acceso al Admin.':'No se pudo cargar el Admin.');
  const data = await response.json();
  rows = data.requests || [];
  document.getElementById('login').classList.add('hidden');
  document.getElementById('admin').classList.remove('hidden');
  render('all');
}

async function google(){
  setMsg('Abriendo Google…');
  await authClient.signIn.social({provider:'google',callbackURL:location.origin+'/admin.html'});
}

async function signOut(){
  await authClient.signOut();
  rows=[];
  document.getElementById('admin').classList.add('hidden');
  document.getElementById('login').classList.remove('hidden');
  setMsg('Sesión cerrada.');
}

async function updateStatus(id,status){
  const token = await bearer();
  const response = await fetch('/api/admin/requests',{
    method:'PATCH',
    headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},
    body:JSON.stringify({id,status})
  });
  if(!response.ok) throw new Error('No se pudo actualizar el estado.');
  await load();
}

function render(filter){
  const items = filter==='all'?rows:rows.filter(x=>x.status===filter);
  total.textContent=rows.length;
  newCount.textContent=rows.filter(x=>x.status==='Nueva').length;
  progressCount.textContent=rows.filter(x=>x.status==='En proceso').length;
  closedCount.textContent=rows.filter(x=>x.status==='Cerrada').length;
  requests.innerHTML = items.length ? items.map(x=>`<article class="request"><div><small class="tag">${x.id}</small><h3>${x.business}</h3><p><b>${x.goal}</b></p><p class="meta">${x.need} · ${x.contact}${x.details?' · '+x.details:''}</p><small class="meta">${new Date(x.created_at||x.createdAt).toLocaleString()}</small></div><div><select onchange="adminUpdateStatus('${x.id}',this.value)"><option ${x.status==='Nueva'?'selected':''}>Nueva</option><option ${x.status==='En proceso'?'selected':''}>En proceso</option><option ${x.status==='Cerrada'?'selected':''}>Cerrada</option></select></div></article>`).join('') : '<div class="empty">Todavía no hay solicitudes en BRavo.</div>';
}

window.adminGoogleLogin=()=>google().catch(e=>setMsg(e.message||'No se pudo iniciar con Google.'));
window.adminSignOut=()=>signOut();
window.adminRender=render;
window.adminUpdateStatus=(id,status)=>updateStatus(id,status).catch(e=>setMsg(e.message));

window.addEventListener('DOMContentLoaded',async()=>{
  try{
    const session=await authClient.getSession();
    if(session?.data?.session) await load();
  }catch(e){ setMsg(e.message==='No active session'?'':e.message); }
});
