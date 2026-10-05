import { createAuthClient } from '@neondatabase/auth';

const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);

function message(text) {
  const el = document.getElementById('adminAuthMessage');
  if (el) el.textContent = text || '';
}

async function bearer() {
  const result = await authClient.token();
  const token = result?.data?.token || result?.token;
  if (!token) throw new Error('No active session');
  return token;
}

async function loadRequests() {
  try {
    const token = await bearer();
    const response = await fetch('/api/admin/requests', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error(response.status === 403 ? 'Esta cuenta no tiene acceso al Admin.' : 'Sesión requerida.');
    const data = await response.json();
    document.getElementById('adminLogin')?.classList.add('hidden');
    document.getElementById('adminContent')?.classList.remove('hidden');
    message('');
    return data.requests || [];
  } catch (error) {
    document.getElementById('adminLogin')?.classList.remove('hidden');
    document.getElementById('adminContent')?.classList.add('hidden');
    message(error.message === 'No active session' ? '' : error.message);
    return [];
  }
}

async function refresh() {
  const rows = await loadRequests();
  if (rows.length || document.getElementById('adminContent')?.classList.contains('hidden') === false) {
    await window.renderAdmin?.('all');
  }
}

async function signIn(email, password) {
  message('Verificando…');
  const result = await authClient.signIn.email({ email, password });
  if (result?.error) {
    message(result.error.message || 'No se pudo iniciar sesión.');
    return;
  }
  message('');
  await window.renderAdmin?.('all');
}

async function signOut() {
  await authClient.signOut();
  document.getElementById('adminContent')?.classList.add('hidden');
  document.getElementById('adminLogin')?.classList.remove('hidden');
  message('Sesión cerrada.');
}

async function updateStatus(id, status) {
  const token = await bearer();
  const response = await fetch('/api/admin/requests', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ id, status })
  });
  if (!response.ok) throw new Error('No se pudo actualizar el estado.');
}

window.bravoAuth = { refresh, signIn, signOut, loadRequests, updateStatus };
