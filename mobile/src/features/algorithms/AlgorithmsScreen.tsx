import { Alert, Pressable, Text, View } from 'react-native';
import { usePalette } from '../../store/settings';
import { useBeta } from '../../lib/beta';
import { Muted, Screen } from '../../components/ui';
import { font, radius, space } from '../../theme';

// Algorithm Trainer, puzzle picker.
//
// Mirrors client/src/features/alg-trainer/AlgTrainerPage.tsx's PUZZLES list and
// its availability flags:
//
//   3×3, 2×2                    always available
//   Square-1                    beta-only  (web: `available: IS_BETA_SITE`)
//   Megaminx, Pyraminx, Skewb   not implemented on either platform yet
//
// Square-1 is gated exactly as the web client gates it, resolved through
// lib/beta.ts: hidden unless the server is the beta deployment AND the account has
// betaAccess. The same set of users who can see it on web, since
// RequireBetaAccess blocks everyone else from the beta site outright. Every other
// puzzle and every other set stays fully available to everyone, as on web. Note
// the gate is per-*set-group* the same way web's is: on Square-1 it's the whole
// puzzle, and specifically its Cube Shape / CO / EO / CP / EP sets, that appears
// or doesn't.
//
// Set case counts are duplicated here rather than imported because the case data
// genuinely isn't shared yet: shared/src/algData.generated.ts only indexes the
// 3×3 and 2×2 sets (its AlgSetInfo.puzzle is typed '333' | '222'), while every
// Square-1 set lives in client/src/data/sq1*.ts. Pulling that data into shared/
// is the right move when the trainer itself is built for mobile. It is not
// something to do as a side effect of this scaffold, so for now these are labels
// on a picker, not a second source of truth for any algorithm.
interface AlgSetCard {
  id: string;
  label: string;
  description: string;
  count: number;
}

interface Puzzle {
  id: string;
  label: string;
  available: boolean;
  betaOnly?: boolean;
  sets: AlgSetCard[];
}

const SETS_3X3: AlgSetCard[] = [
  { id: 'OLL', label: 'OLL', description: 'Orient the Last Layer', count: 57 },
  { id: 'PLL', label: 'PLL', description: 'Permute the Last Layer', count: 21 },
  { id: 'F2L', label: 'F2L', description: 'First Two Layers', count: 41 },
  { id: 'COLL', label: 'COLL', description: 'Corners of the Last Layer', count: 40 },
];

const SETS_2X2: AlgSetCard[] = [
  { id: 'OrtegaOLL', label: 'OLL', description: 'Ortega OLL', count: 7 },
  { id: 'OrtegaPBL', label: 'PBL', description: 'Ortega PBL', count: 6 },
  { id: 'CLL', label: 'CLL', description: 'Corners of the Last Layer', count: 42 },
  { id: 'EG1', label: 'EG-1', description: 'EG-1', count: 42 },
  { id: 'EG2', label: 'EG-2', description: 'EG-2', count: 42 },
];

// Beta-only, same as on web.
const SETS_SQ1: AlgSetCard[] = [
  { id: 'SQ1CubeShape', label: 'Cube Shape', description: 'Square-1 Cube Shape', count: 0 },
  { id: 'SQ1CO', label: 'CO', description: 'Corner Orientation', count: 0 },
  { id: 'SQ1EO', label: 'EO', description: 'Edge Orientation', count: 0 },
  { id: 'SQ1CP', label: 'CP', description: 'Corner Permutation', count: 0 },
  { id: 'SQ1EP', label: 'EP', description: 'Edge Permutation', count: 0 },
];

export default function AlgorithmsScreen() {
  const p = usePalette();
  const { betaFeaturesEnabled } = useBeta();

  const puzzles: Puzzle[] = [
    { id: '3x3', label: '3×3', available: true, sets: SETS_3X3 },
    { id: '2x2', label: '2×2', available: true, sets: SETS_2X2 },
    { id: 'sq1', label: 'Square-1', available: betaFeaturesEnabled, betaOnly: true, sets: SETS_SQ1 },
    { id: 'minx', label: 'Megaminx', available: false, sets: [] },
    { id: 'pyram', label: 'Pyraminx', available: false, sets: [] },
    { id: 'skewb', label: 'Skewb', available: false, sets: [] },
  ];

  return (
    <Screen scroll>
      <View>
        <Text style={{ color: p.text, fontSize: 22, fontFamily: font.sansBlack }}>Algorithms</Text>
        <Muted>Browse and drill algorithm sets.</Muted>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {puzzles
          // A beta-only puzzle is hidden entirely when the gate is closed rather
          // than shown as locked, matching web, where the Square-1 tile simply
          // isn't in the list on the main site.
          .filter((puzzle) => puzzle.available || !puzzle.betaOnly)
          .map((puzzle) => (
            <Pressable
              key={puzzle.id}
              accessibilityRole="button"
              accessibilityState={{ disabled: !puzzle.available }}
              onPress={() =>
                puzzle.available &&
                Alert.alert(
                  puzzle.label,
                  puzzle.sets.length
                    ? `${puzzle.sets
                        .map((s) => `${s.label}, ${s.description}${s.count ? ` (${s.count} cases)` : ''}`)
                        .join('\n')}\n\nDrilling and case diagrams are coming in a later pass.`
                    : 'No algorithm sets for this puzzle yet.',
                )
              }
              style={({ pressed }) => ({
                width: '48%',
                backgroundColor: puzzle.available && pressed ? p.cardHover : p.card,
                borderColor: p.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: space.lg,
                alignItems: 'center',
                gap: 6,
                opacity: puzzle.available ? 1 : 0.5,
              })}
            >
              <Text style={{ color: p.text, fontSize: 17, fontFamily: font.sansBold }}>{puzzle.label}</Text>
              <Muted>
                {puzzle.available ? `${puzzle.sets.length} set${puzzle.sets.length === 1 ? '' : 's'}` : 'Coming soon'}
              </Muted>
            </Pressable>
          ))}
      </View>

      <View style={{ borderWidth: 1, borderColor: p.border, borderRadius: radius.md, padding: space.md }}>
        <Muted>
          The trainer, the case library, and the 3D case diagrams are not in this build yet. The diagrams in
          particular use a cubing.js web component with no React Native equivalent, so they need a different
          rendering approach rather than a port. Spaced-repetition and per-case stats are stored server-side, so
          progress made on the web carries over once drilling lands here.
        </Muted>
      </View>
    </Screen>
  );
}
