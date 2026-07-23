process.env.PORT = process.env.SMOKE_PORT || '3199';
process.env.NODE_ENV = 'test';

const app = require('../server');
const db = require('../app/config/db');

const baseUrl = `http://127.0.0.1:${process.env.PORT}`;

async function run() {
  await new Promise(resolve => setTimeout(resolve, 700));

  const health = await fetch(`${baseUrl}/api/health`);
  const healthBody = await health.json();
  if (health.status !== 200 || healthBody.success !== true) {
    throw new Error(`Health check failed with status ${health.status}.`);
  }

  const login = await fetch(`${baseUrl}/login`, { redirect: 'manual' });
  if (login.status !== 200) {
    throw new Error(`Login page failed with status ${login.status}.`);
  }

  const protectedApi = await fetch(`${baseUrl}/api/dashboard`, { redirect: 'manual' });
  if (protectedApi.status !== 401) {
    throw new Error(`Protected API returned ${protectedApi.status} instead of 401.`);
  }

  const protectedPage = await fetch(`${baseUrl}/dashboard`, { redirect: 'manual' });
  if (![301, 302, 303, 307, 308].includes(protectedPage.status)) {
    throw new Error(`Protected page returned ${protectedPage.status} instead of a redirect.`);
  }

  console.log('Smoke test passed (database, health, login, and access control).');
}

run()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await new Promise(resolve => app.server.close(resolve));
    await db.end();
  });
