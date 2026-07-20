// Persists a guest's last-used display name across a page refresh — without
// this, refreshing mid-room lost `location.state` (React Router navigation
// state doesn't survive a hard reload), forcing the name prompt to
// reappear; if the guest then typed anything other than their exact
// previous name, the server's guestName-based reconnect match (see
// server/src/socket.ts's join_room) would miss and create a second,
// orphaned participant instead of resuming the original one.
const KEY = 'scc-guest-display-name';

export function getGuestName(): string {
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setGuestName(name: string) {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    /* private browsing / storage disabled */
  }
}
