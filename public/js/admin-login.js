document.getElementById('admin-login-form')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  const error = document.getElementById('admin-login-error');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = 'Signing in';
  error.textContent = '';
  try {
    const response = await fetch('/api/admin/auth/login', { method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ email: document.getElementById('admin-email').value, password: document.getElementById('admin-password').value }) });
    let data = {};
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok || !data.success) throw new Error(data.message || 'Sign in failed.');
    try { sessionStorage.setItem('regen_admin_csrf', data.csrfToken || ''); } catch {}
    window.location.replace('/admin');
  } catch (err) {
    error.textContent = err.message || 'Unable to sign in.';
    button.disabled = false;
    button.textContent = originalLabel;
  }
});
