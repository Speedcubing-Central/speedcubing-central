import './env.js';
import { createServer } from 'node:http';
import { createApp } from './app.js';
import { attachSocket } from './socket.js';
import { env } from './env.js';
import { warmUpScrambler } from './scramble.js';

const app = createApp();
const server = createServer(app);
attachSocket(server);

server.listen(env.PORT, () => {
  console.log(`\n  Speedcubing Central API listening on http://localhost:${env.PORT}`);
  console.log(`  CORS origin: ${env.FRONTEND_URL}`);
  console.log(`  WCA OAuth configured: ${env.WCA_CLIENT_ID ? 'yes' : 'no'}\n`);
  warmUpScrambler(); // fire-and-forget; initialises cubing.js before first request
});

// Never let a stray async error take the whole server down.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

// Graceful shutdown
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    console.log(`\n[server] ${sig} received, shutting down...`);
    server.close(() => process.exit(0));
  });
}
