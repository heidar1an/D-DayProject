import { findUserByPhone, publicUser, saveUser, verifyUser } from './usersStore.js';

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);

  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(body);
}

function readBody(request) {
  return new Promise((resolvePromise, rejectPromise) => {
    let raw = '';

    request.on('data', (chunk) => {
      raw += chunk;

      if (raw.length > 1e6) {
        request.destroy();
        rejectPromise(new Error('payload-too-large'));
      }
    });
    request.on('end', () => {
      try {
        resolvePromise(raw ? JSON.parse(raw) : {});
      } catch {
        rejectPromise(new Error('invalid-json'));
      }
    });
    request.on('error', rejectPromise);
  });
}

export default function usersApiPlugin() {
  return {
    name: 'tapesh-users-api',
    configureServer(server) {
      server.middlewares.use('/api/users', async (request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        const path = url.pathname.replace(/\/$/, '');

        try {
          if (request.method === 'GET' && (path === '' || path === '/lookup')) {
            const user = findUserByPhone(url.searchParams.get('phone'));
            sendJson(response, 200, { user: publicUser(user) });
            return;
          }

          if (request.method === 'POST' && (path === '' || path === '/register')) {
            const payload = await readBody(request);
            const user = saveUser(payload);
            sendJson(response, 201, { user: publicUser(user) });
            return;
          }

          if (request.method === 'POST' && path === '/login') {
            const payload = await readBody(request);
            const user = verifyUser(payload);

            if (!user) {
              sendJson(response, 401, { error: 'invalid-credentials' });
              return;
            }

            sendJson(response, 200, { user: publicUser(user) });
            return;
          }

          next();
        } catch (error) {
          sendJson(response, 400, { error: error.message || 'bad-request' });
        }
      });
    },
  };
}
