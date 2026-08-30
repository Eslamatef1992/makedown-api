const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const app = require('./app');
const env = require('./config/env');
const { checkConnection } = require('./config/db');

const server = http.createServer(app);

// Socket.io is initialized here so future modules (live game, chat) can
// attach namespaces/handlers without touching server bootstrap again.
const io = new SocketIOServer(server, {
  cors: { origin: env.corsOrigins.length ? env.corsOrigins : true, credentials: true },
});
app.set('io', io);

io.on('connection', (socket) => {
  // Placeholder — game and chat namespaces/handlers land here as those
  // modules are built (see docs/PROJECT_PLAN.md).
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
    console.log(`[server] Swagger docs: ${env.apiBaseUrl}/api-docs`);
  });
}

start();
