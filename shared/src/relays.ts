// Relay definitions, DTOs, and socket payload types shared by the client and server.

export interface RelayPreset {
  id: string;
  name: string;
  // Flat ordered event ids — presets are always 1x each event (quantities
  // are a custom-relay-only concept).
  events: string[];
}

const MINI_GUILDFORD_EVENTS = ['222', '333', '444', '555', '333oh', 'pyram', 'minx', 'skewb', 'sq1'];

export const RELAY_PRESETS: RelayPreset[] = [
  { id: '2-4', name: '2-4 Relay', events: ['222', '333', '444'] },
  { id: '2-5', name: '2-5 Relay', events: ['222', '333', '444', '555'] },
  { id: '2-6', name: '2-6 Relay', events: ['222', '333', '444', '555', '666'] },
  { id: '2-7', name: '2-7 Relay', events: ['222', '333', '444', '555', '666', '777'] },
  { id: 'mini-guildford', name: 'Mini Guildford', events: [...MINI_GUILDFORD_EVENTS, 'clock'] },
  {
    id: 'guildford',
    name: 'Guildford',
    events: [...MINI_GUILDFORD_EVENTS, '666', '777', 'clock'],
  },
  { id: 'mini-guildford-ns', name: 'New-Style Mini Guildford', events: [...MINI_GUILDFORD_EVENTS, 'fto'] },
  {
    id: 'guildford-ns',
    name: 'New-Style Guildford',
    events: [...MINI_GUILDFORD_EVENTS, '666', '777', 'fto'],
  },
];

export function getRelayPreset(id: string): RelayPreset | undefined {
  return RELAY_PRESETS.find((p) => p.id === id);
}

export interface CustomRelayEventEntry {
  eventId: string;
  quantity: number;
}

// Normalizes either a preset's flat event list or a custom relay's
// {eventId, quantity}[] into the same flat ordered leg list. One code path
// feeds scramble generation, room-leg creation, and attempt recording
// regardless of preset vs. custom.
export function expandToLegs(events: CustomRelayEventEntry[]): string[] {
  const legs: string[] = [];
  for (const { eventId, quantity } of events) {
    for (let i = 0; i < quantity; i++) legs.push(eventId);
  }
  return legs;
}

export function presetToLegs(preset: RelayPreset): string[] {
  return [...preset.events];
}

// ---- DTOs ----

export interface CustomRelayDTO {
  id: string;
  userId: string;
  name: string;
  events: CustomRelayEventEntry[];
  createdAt: string;
}

export interface RelayAttemptLegDTO {
  id: string;
  eventId: string;
  order: number;
  scramble: string;
  splitMs: number | null;
}

export interface RelayAttemptDTO {
  id: string;
  userId: string;
  relayName: string;
  totalTimeMs: number;
  createdAt: string;
  legs: RelayAttemptLegDTO[];
}

export type RelayRoomStatus = 'LOBBY' | 'ASSIGNING' | 'ACTIVE' | 'FINISHED';

export interface RelayParticipantDTO {
  id: string;
  userId?: string | null;
  name: string;
  isReady: boolean;
  isDone: boolean;
  isHost: boolean;
}

export interface RelayRoomLegDTO {
  id: string;
  eventId: string;
  order: number;
  // Only populated for the assignee once the room is ACTIVE — other
  // participants never receive someone else's scramble.
  scramble: string;
  assignedToId: string | null;
  splitMs: number | null;
}

export interface RelayRoomDTO {
  id: string;
  code: string;
  name: string;
  isPublic: boolean;
  presetId: string | null;
  customRelayId: string | null;
  relayName: string;
  status: RelayRoomStatus;
  startedAt: string | null;
  finishedAt: string | null;
  participants: RelayParticipantDTO[];
  legs: RelayRoomLegDTO[];
}

export interface RelayPublicRoomDTO {
  code: string;
  name: string;
  relayName: string;
  participantCount: number;
  status: RelayRoomStatus;
}

export interface RelayCompletedResult {
  totalTimeMs: number;
  legs: { eventId: string; order: number; assignedToId: string | null; splitMs: number | null }[];
}

// ---- Socket.io event payloads (merged into shared/src/index.ts's
// ServerToClientEvents / ClientToServerEvents) ----

export interface RelayServerToClientEvents {
  relay_room_state: (room: RelayRoomDTO) => void;
  // Current set of participantIds holding spacebar during the hold-to-start phase.
  relay_hold_state: (payload: { holding: string[] }) => void;
  relay_started: (payload: { startedAt: string }) => void;
  relay_completed: (payload: RelayCompletedResult) => void;
}

export interface RelayClientToServerEvents {
  join_relay_room: (payload: { code: string; name: string; password?: string }) => void;
  leave_relay_room: (payload: { code: string }) => void;
  relay_start_room: (payload: { code: string }) => void; // host-only: LOBBY -> ASSIGNING
  relay_assign_event: (payload: { code: string; legId: string; participantId: string | null }) => void;
  relay_toggle_ready: (payload: { code: string; isReady: boolean }) => void;
  relay_press: (payload: { code: string }) => void;
  relay_release: (payload: { code: string }) => void;
  relay_mark_done: (payload: { code: string }) => void;
}
