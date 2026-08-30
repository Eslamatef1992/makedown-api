const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const app = require('./app');
const env = require('./config/env');
const { checkConnection } = require('./config/db');
const { verifyAccessToken } = require('./utils/tokens');

const server = http.createServer(app);

// Socket.io is initialized here so future modules (live game, chat) can
// attach namespaces/handlers without touching server bootstrap again.
const io = new SocketIOServer(server, {
  cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true },
});
app.set('io', io);

io.on('connection', (socket) => {
  // Chat: the client emits "auth" with its access token right after
  // connecting; once verified we join a room named "user:<id>" so
  // chat.controller.js can push a "chat:message" event straight to that
  // user's open tabs/devices without anyone polling.
  socket.on('auth', (token) => {
    try {
      const payload = verifyAccessToken(token);
      socket.join(`user:${payload.sub}`);
      socket.emit('auth:ok');
    } catch {
      socket.emit('auth:error', 'Invalid or expired token');
    }
  });

  // Placeholder — live game namespaces/handlers land here (see docs/PROJECT_PLAN.md).
  socket.on('disconnect', () => {});
});

async function start() {
  try {
    await checkConnection();
    console.log('[db] MySQL connection OK');
  } catch (err) {
    console.error('[db] Could not connect to MySQL:', err.message);
    console.error('[db] Check your .env DB_* values and that the schema in sql/schema.sql has been imported.');
  }

  server.listen(env.port, () => {
    console.log(`[server] Make Down API listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[server] Swagger docs: ${env.apiBaseUrl}/swagger`);
  });
}

start();
