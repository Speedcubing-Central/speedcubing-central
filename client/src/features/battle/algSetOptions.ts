// Small, hand-maintained list of algorithm sets selectable when creating a
// Battle room. Deliberately not sourced from client/src/data/algSets.ts
// (ALG_SETS) — every AlgCase there inlines its full `alts` array, so
// importing it here just to read id/label would pull all ~294 cases' move
// data into this route's bundle chunk for no benefit.
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
