import { createAuthClient } from '@neondatabase/auth';

const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);
const ADMIN_EMAIL = 'fabiangzz54@gmail.com';
let currentJWT = '';

function message(text) {
  const el = document.getElementById('adminAuthMessage');
  if (el) el.textContent = text || '';
}

async function bearer() {
  if (currentJWT) return currentJWT;
  const session = await authClient.getSession();
  const token = session?.data?.session?.access_token || session?.data?.session?.accessToken || '';
  if (token) {
    currentJWT = token;
    return token;
  }
  const jwt = await Promise.race([
    authClient.getJWTToken?.(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('Auth timeout')), 8000))
  ]);
  if (!jwt) throw new Error('No active session');
  currentJWT = jwt;
  return jwt;
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
  try {
    const session = await authClient.getSession();
    const hasSession = !!session?.data?.session;
    if (hasSession) {
      document.getElementById('admin')?.classList.remove('hidden');
      document.getElementById('admin')?.scrollIntoView({ behavior: 'smooth' });
    }
    const rows = await loadRequests();
    if (document.getElementById('adminContent')?.classList.contains('hidden') === false) {
      window.adminRequests = rows;
      await window.renderAdmin?.('all');
    }
  } catch (error) {
    console.error('BRavo auth refresh:', error);
  }
}

async function signInGoogle() {
  message('Abriendo acceso seguro con Google…');
  try {
    sessionStorage.setItem('bravo_admin_after_oauth', '1');
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: location.origin + location.pathname
    });
  } catch (error) {
    console.error('BRavo Google sign-in:', error);
    message('No se pudo iniciar el acceso con Google.');
  }
}

async function signOut() {
  currentJWT = '';
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

window.bravoAuth = { refresh, signInGoogle, signOut, loadRequests, updateStatus };



window.addEventListener('DOMContentLoaded', async () => {
  const wantsAdmin =
    sessionStorage.getItem('bravo_admin_after_oauth') === '1' ||
    new URLSearchParams(location.search).get('admin') === '1';

  if (!wantsAdmin) return;

  try {
    let session = null;

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const result = await authClient.getSession();
      session = result?.data?.session || null;
      if (session) break;
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!session) {
      message('La sesión de Google todavía no está disponible. Pulsa Admin y vuelve a intentar.');
      return;
    }

    sessionStorage.removeItem('bravo_admin_after_oauth');
    history.replaceState({}, '', location.pathname);

    document.getElementById('admin')?.classList.remove('hidden');
    await refresh();

    requestAnimationFrame(() => {
      document.getElementById('admin')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    });
  } catch (error) {
    console.error('BRavo session bootstrap:', error);
  }
});
