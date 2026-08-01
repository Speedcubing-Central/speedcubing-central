import { Pressable, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { usePalette } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import { Icon } from '../../components/Icon';
import { MONO_BOLD } from '../../components/ui';
import { radius, space } from '../../theme';

// ── The manual entry keypad ───────────────────────────────────────────────
//
// Manual entry used a TextInput, which meant the OS keyboard, which on a screen
// that cannot scroll meant the field was drawn behind it (HANDOFF trap: "The
// keyboard covers the Timer column"). Every fix for that is a workaround for
// having asked for the keyboard in the first place: the app owns this screen's
// whole height, so it can own the keys too.
//
// What it buys beyond the obvious:
//
//  * The layout stops moving. Nothing appears over the column, so the readout,
//    the cube and the panel stay exactly where they are between entries.
//  * The keys are the ones this job needs. The system numeric pad ships a
//    decimal point, a minus sign and locale punctuation, none of which mean
//    anything here, and no submit key.
//  * It is the same on both platforms, which the system keyboards are not.
//
// Digits only, and they shift in from the right, the way cstimer and every
// other phone timer take a time: 1,2,3,4 is 12.34 and 1,0,0,0,0 is 1:00.00.
// That is not a new rule invented here. It is exactly how `parseTimeInput`
// already reads a run of digits (see its `precision` handling), which is the
// same function the web client parses typed times with, so a keypad entry and a
// typed one cannot disagree. Nothing here converts anything: the keypad appends
// digits to the same string the TextInput used to hold.
//
// No +2 or DNF key. A penalty is a property of a solve that already exists, and
// the stats panel puts OK / +2 / DNF against the last one the moment it lands,
// which is one tap away and is where you would look to fix an older solve
// anyway.

// 3 x 4, the phone dialpad everyone already knows: digits reading left to
// right and top to bottom, then delete, zero and submit along the bottom. A
// 4 x 3 arrangement fits a short screen more easily and was tried on paper for
// that reason, but it has to put 0 somewhere that is not under the 8, and no
// amount of height is worth breaking the one piece of muscle memory a keypad
// gets for free.
const COLUMNS = 3;
export const KEYPAD_ROWS = 4;
// 44pt is Apple's minimum target and this is the floor, not the size: on a
// short screen the keys stay hittable and the readout above gives way instead.
export const KEY_MIN_H = 44;
// A ceiling as well, because past a point a key stops reading as generous and
// starts reading as a mistake. 76 is roughly the iOS calculator's key, and it
// is set where it is because it is what stops a tall phone leaving a band of
// air between the keypad and the panel: at 66 a Pixel 7 on a 3x3 had 90pt
// spare, which is the same dead space this screen keeps being asked to close.
export const KEY_MAX_H = 76;
export const KEY_GAP = space.sm;
// What the keypad cannot go below. The Timer's tile takes this as its floor in
// manual entry (see TimerScreen), so when the column is tight it is the cube
// and the readout that give way, not the keys: a number too small to read is a
// nuisance, a key too small to hit is a wrong solve.
export const KEYPAD_MIN_H = KEYPAD_ROWS * KEY_MIN_H + KEY_GAP * (KEYPAD_ROWS - 1);
// Tablets: `supportsTablet` is on, and a keypad stretched across an iPad is
// both ugly and unreachable. Phones are all narrower than this, so it has no
// effect there.
const MAX_WIDTH = 420;

type Key = { kind: 'digit'; value: string } | { kind: 'backspace' } | { kind: 'submit' };

const KEYS: Key[] = [
  { kind: 'digit', value: '1' },
  { kind: 'digit', value: '2' },
  { kind: 'digit', value: '3' },
  { kind: 'digit', value: '4' },
  { kind: 'digit', value: '5' },
  { kind: 'digit', value: '6' },
  { kind: 'digit', value: '7' },
  { kind: 'digit', value: '8' },
  { kind: 'digit', value: '9' },
  { kind: 'backspace' },
  { kind: 'digit', value: '0' },
  { kind: 'submit' },
];

const DIGIT_NAME: Record<string, string> = {
  '0': 'Zero',
  '1': 'One',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
};

export interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Long press on delete. Clears the whole entry rather than one digit. */
  onClear: () => void;
  onSubmit: () => void;
  /** Nothing typed yet: delete and submit have no subject. */
  empty: boolean;
  /** A solve or a scramble is still in flight, same gate as the touch timer. */
  disabled?: boolean;
}

export function Keypad({ onDigit, onBackspace, onClear, onSubmit, empty, disabled }: KeypadProps) {
  const { s: sc } = useScreenScale();

  return (
    // flex: 1 is safe here and only here: this sits inside the timer tile,
    // which is a flex child of the column with a resolved height, so there is
    // real free space to divide (trap 2 is about the opposite case, a flex
    // child of a parent that sizes to its content).
    <View style={{ flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: KEY_GAP }}>
      {Array.from({ length: KEYPAD_ROWS }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', flex: 1, gap: KEY_GAP }}>
          {KEYS.slice(row * COLUMNS, row * COLUMNS + COLUMNS).map((key, col) => (
            <KeypadKey
              key={key.kind === 'digit' ? key.value : key.kind}
              spec={key}
              sc={sc}
              disabled={disabled || ((key.kind === 'backspace' || key.kind === 'submit') && empty)}
              onPress={() => {
                if (key.kind === 'digit') onDigit(key.value);
                else if (key.kind === 'backspace') onBackspace();
                else onSubmit();
              }}
              onLongPress={key.kind === 'backspace' ? onClear : undefined}
              accessibilityPosition={`row ${row + 1}, column ${col + 1}`}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function KeypadKey({
  spec,
  sc,
  disabled,
  onPress,
  onLongPress,
  accessibilityPosition,
}: {
  spec: Key;
  sc: (n: number) => number;
  disabled?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityPosition: string;
}) {
  const p = usePalette();
  const isSubmit = spec.kind === 'submit';

  const label =
    spec.kind === 'digit'
      ? DIGIT_NAME[spec.value]
      : spec.kind === 'backspace'
        ? 'Delete the last digit'
        : 'Add this solve';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={spec.kind === 'backspace' ? 'Hold to clear the whole entry' : undefined}
      accessibilityValue={{ text: accessibilityPosition }}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        // Fire and forget, exactly as the timer's start cue is: a key that
        // waits for its own haptic is a key that feels late. A phone keyboard
        // ticks, so one built in the app has to as well or it reads as dead.
        Haptics.selectionAsync().catch(() => undefined);
        onPress();
      }}
      onLongPress={
        onLongPress
          ? () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
              onLongPress();
            }
          : undefined
      }
      style={({ pressed }) => ({
        flex: 1,
        minHeight: KEY_MIN_H,
        maxHeight: KEY_MAX_H,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.md,
        backgroundColor: isSubmit ? p.accent : p.cardHover,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      {spec.kind === 'digit' ? (
        <Text
          // Sized against the key, not the OS text setting: the key cannot
          // grow, so a scaled glyph would only be a clipped one (trap 4).
          allowFontScaling={false}
          style={{
            color: p.text,
            fontFamily: MONO_BOLD,
            fontSize: sc(24),
            fontVariant: ['tabular-nums'],
          }}
        >
          {spec.value}
        </Text>
      ) : (
        <Icon name={isSubmit ? 'check' : 'backspace'} size={sc(22)} color={isSubmit ? '#fff' : p.text} />
      )}
    </Pressable>
  );
}
