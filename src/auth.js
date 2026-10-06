import { createAuthClient } from '@neondatabase/auth';

const authClient = createAuthClient(import.meta.env.VITE_NEON_AUTH_URL);
const ADMIN_EMAIL = 'fabiangzz54@gmail.com';

function message(text) {
  const el = document.getElementById('adminAuthMessage');
  if (el) el.textContent = text || '';
}

function resetMessage(text) {
  const el = document.getElementById('adminResetMessage');
  if (el) el.textContent = text || '';
}

async function bearer() {
  const token = await authClient.getJWTToken?.();
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
    document.getElementById('adminReset')?.classList.add('hidden');
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
  const params = new URLSearchParams(location.search);
  if (params.get('token')) {
    document.getElementById('admin')?.classList.remove('hidden');
    document.getElementById('adminLogin')?.classList.add('hidden');
    document.getElementById('adminReset')?.classList.remove('hidden');
    document.getElementById('admin')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  const rows = await loadRequests();
  if (rows.length || document.getElementById('adminContent')?.classList.contains('hidden') === false) {
    await window.renderAdmin?.('all');
  }
}

async function signInGoogle() {
  message('Abriendo acceso seguro con Google…');
  try {
    await authClient.signIn.social({
      provider: 'google',
      callbackURL: location.origin + location.pathname
    });
  } catch (error) {
    console.error('BRavo Google sign-in:', error);
    message('No se pudo iniciar el acceso con Google.');
  }
}

async function signIn(email, password) {
  if (String(email).trim().toLowerCase() !== ADMIN_EMAIL) {
    message('Este acceso está reservado al administrador autorizado.');
    return;
  }
  message('Verificando…');
  const result = await authClient.signIn.email({ email: ADMIN_EMAIL, password });
  if (result?.error) {
    message(result.error.message || 'No se pudo iniciar sesión.');
    return;
  }
  message('');
  await window.renderAdmin?.('all');
}

async function requestPasswordReset() {
  message('La recuperación por correo está desactivada. Usa “Continuar con Google”.');
}

async function resetPassword(newPassword, confirmPassword) {
  resetMessage('');
  if (!newPassword || newPassword.length < 8) {
    resetMessage('Usa una contraseña de al menos 8 caracteres.');
    return;
  }
  if (newPassword !== confirmPassword) {
    resetMessage('Las contraseñas no coinciden.');
    return;
  }
  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  if (!token) {
    resetMessage('El enlace de recuperación no contiene un token válido.');
    return;
  }
  resetMessage('Guardando contraseña nueva…');
  const result = await authClient.resetPassword({ newPassword, token });
  if (result?.error) {
    resetMessage(result.error.message || 'No se pudo cambiar la contraseña. Solicita un enlace nuevo.');
    return;
  }
  history.replaceState({}, '', location.pathname);
  document.getElementById('adminReset')?.classList.add('hidden');
  document.getElementById('adminLogin')?.classList.remove('hidden');
  const email = document.getElementById('adminEmail');
  if (email) email.value = ADMIN_EMAIL;
  resetMessage('');
  message('Contraseña creada. Ya puedes entrar como Admin.');
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

window.bravoAuth = { refresh, signIn, signInGoogle, signOut, loadRequests, updateStatus, requestPasswordReset, resetPassword };

if (new URLSearchParams(location.search).get('token')) {
  window.addEventListener('DOMContentLoaded', () => refresh());
}
