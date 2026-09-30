const http = require('http');
const { Server: SocketIOServer } = require('socket.io');

const app = require('./app');
const env = require('./config/env');
const { checkConnection } = require('./config/db');
const { verifyAccessToken } = require('./utils/tokens');
const playRepo = require('./modules/play/play.repository');

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

  // Live game: clients join a room per game session so play.controller.js can
  // broadcast board/turn/score updates to everyone watching that game. On
  // join we also send the current state directly to this one socket (not
  // the room) — otherwise a client that (re)connects gets nothing until the
  // next unrelated change happens to broadcast game:state, which is a real
  // gap on reconnect: any events sent while it was disconnected are lost.
  socket.on('game:join', async (sessionId) => {
    if (!sessionId) return;
    socket.join(`game:${sessionId}`);
    try {
      const detail = await playRepo.findSessionDetail(sessionId);
      if (detail) socket.emit('game:state', detail);
    } catch (err) {
      // Bad/unknown sessionId — the client just won't get an initial
      // snapshot; later broadcasts to the room still work as normal.
    }
  });
  socket.on('game:leave', (sessionId) => {
    if (sessionId) socket.leave(`game:${sessionId}`);
  });

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
