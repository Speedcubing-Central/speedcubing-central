import { io, type Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@scc/shared';
import { SERVER_ORIGIN } from './config';
import { getAccessToken } from './tokens';

export type SccSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Connects to the same Socket.io server the web client uses, for the same
// rooms. A Battle room is identified by its code in the database, so a room
// created from web and joined from mobile is literally the same row and the
// same Socket.io room. Nothing about the room is platform-specific.
//
// Identity is the one part that needed server work. The web client's
// connection carries the httpOnly access_token cookie automatically; a native
// client has no cookie jar, so the token goes in the handshake auth payload
// instead, which the server verifies with the same verifyAccessToken call (see
// the io.use() middleware in server/src/socket.ts). Without this the server
// would see every mobile connection as a guest, and a logged-in mobile user
// wouldn't be matched to their own participant row on reconnect.
//
// `auth` is a callback rather than a plain object on purpose: socket.io-client
// re-invokes it before every (re)connection attempt, so a reconnect after the
// access token has been refreshed sends the *current* token instead of the one
// that happened to be in memory when connect() was first called.
export function createSocket(): SccSocket {
  return io(SERVER_ORIGIN, {
    // React Native has no meaningful long-polling advantage and the upgrade
    // dance just adds a round-trip, so go straight to websockets.
    transports: ['websocket'],
    autoConnect: false,
    auth: (cb) => cb({ token: getAccessToken() ?? undefined }),
  });
}
