process.env.PORT = process.env.REGISTRATION_SMOKE_PORT || '3201';
process.env.NODE_ENV = 'test';

const app = require('../server');
const db = require('../app/config/db');

const baseUrl = `http://127.0.0.1:${process.env.PORT}`;
const email = `regen-registration-test-${Date.now()}@example.com`;

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: {
      Connection: 'close',
      ...(options.headers || {}),
    },
  });
}

async function run() {
  await new Promise(resolve => setTimeout(resolve, 700));

  const register = await request(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      firstName: 'Registration',
      lastName: 'Test',
      email,
      phone: '0123456789',
      address: '40000, Selangor, Malaysia',
      password: 'Valid-Test-Password-2026!',
      confirmPassword: 'Valid-Test-Password-2026!',
    }),
  });
  const registerBody = await register.json();
  if (register.status !== 201 || registerBody.success !== true) {
    throw new Error(`Registration failed with ${register.status}: ${registerBody.message || 'Unknown error'}`);
  }

  const cookie = register.headers.get('set-cookie')?.split(';')[0];
  if (!cookie?.startsWith('regen.sid=')) {
    throw new Error('Registration did not return a ReGen session cookie.');
  }

  const me = await request(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie },
  });
  const meBody = await me.json();
  if (me.status !== 200 || meBody.user?.email !== email) {
    throw new Error(`Registered session check failed with status ${me.status}.`);
  }

  console.log('Registration smoke test passed (account creation and authenticated session).');
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.execute('DELETE FROM users WHERE email = ?', [email]).catch(() => {});
    await new Promise(resolve => app.server.close(resolve));
    await db.end();
  });
