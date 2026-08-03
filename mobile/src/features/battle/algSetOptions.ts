// The algorithm sets a Battle room can be scoped to, mirroring
// client/src/features/battle/algSetOptions.ts exactly: same ids, same labels,
// same puzzles, so a room created on either platform offers the same choices and
// the server sees the same `algSetId` either way.
//
// Hand-maintained rather than derived from the trainer's own data for the same
// reason the web copy gives: every case there inlines its full alternatives, so
// importing that just to read ids and labels would pull a few hundred cases of
// move data into this screen.
export interface BattleAlgSetOption {
  id: string;
  label: string;
  puzzle: '333' | '222';
}

export const BATTLE_ALG_SETS: BattleAlgSetOption[] = [
  { id: 'OLL', label: 'OLL', puzzle: '333' },
  { id: 'PLL', label: 'PLL', puzzle: '333' },
  { id: 'F2L', label: 'F2L', puzzle: '333' },
  { id: 'COLL', label: 'COLL', puzzle: '333' },
  { id: 'OrtegaOLL', label: 'Ortega OLL', puzzle: '222' },
  { id: 'OrtegaPBL', label: 'Ortega PBL', puzzle: '222' },
  { id: 'CLL', label: 'CLL', puzzle: '222' },
  { id: 'EG1', label: 'EG-1', puzzle: '222' },
  { id: 'EG2', label: 'EG-2', puzzle: '222' },
];

export function battleAlgSetLabel(algSetId: string | null | undefined): string | undefined {
  return algSetId ? BATTLE_ALG_SETS.find((s) => s.id === algSetId)?.label : undefined;
}

// The events a Battle room can use. Same list as the web EventPicker's
// WCA_EVENT_OPTIONS, which is deliberately narrower than the full event list:
// these are the ones a race between players actually makes sense for.
export const BATTLE_EVENT_IDS = [
  '333',
  '222',
  '444',
  '555',
  '666',
  '777',
  '333oh',
  '333bf',
  '444bf',
  '555bf',
  'minx',
  'pyram',
  'clock',
  'skewb',
  'sq1',
];
