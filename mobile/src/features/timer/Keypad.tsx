import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { usePalette } from '../../store/settings';
import { useScreenScale } from '../../lib/scale';
import { Icon } from '../../components/Icon';
import { MONO_BOLD, Muted } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { radius, space } from '../../theme';

// ── The manual entry keypad ───────────────────────────────────────────────
//
// Manual entry used a TextInput, which meant the OS keyboard, which on a column
// that cannot scroll meant the field was drawn behind it (HANDOFF: "The Timer
// column cannot host a text input"). Every fix for that is a workaround for
// having asked for the keyboard in the first place: the app owns this screen, so
// it owns the keys too.
//
// It arrives the way a keyboard does, from the bottom, when you tap the time.
// Its first shape was a keypad living permanently in the timer tile, which
// solved the covering problem and created a smaller one: 12 targets is a lot of
// column to spend on a control you touch for a few seconds per solve, and it
// squeezed the cube on a short screen to make room. As a sheet it costs the
// column nothing, and the timer readout goes back to looking like the timer.
//
// What it buys beyond not being covered:
//
//  * The keys are the ones this job needs. The system numeric pad ships a
//    decimal point, a minus sign and locale punctuation, none of which mean
//    anything here, and no submit key.
//  * It is the same on both platforms, which the system keyboards are not.
//  * The value being entered is drawn inside the sheet, so nothing depends on
//    what the sheet does or does not cover. It closes once the solve is added,
//    which puts the stats panel and its penalty buttons back in front of you.
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
// which is where you would go to fix an older solve anyway.

// 3 x 4, the phone dialpad everyone already knows: digits reading left to
// right and top to bottom, then delete, zero and submit along the bottom. A
// 4 x 3 arrangement fits a short screen more easily and was tried on paper for
// that reason, but it has to put 0 somewhere that is not under the 8, and no
// amount of height is worth breaking the one piece of muscle memory a keypad
// gets for free.
const COLUMNS = 3;
const ROWS = 4;
const KEY_GAP = space.sm;
// The key, scaled to the screen and then bounded. 44pt is Apple's minimum
// target; the ceiling is roughly the iOS calculator's key, past which a key
// stops reading as generous and starts reading as a mistake.
const KEY_BASE_H = 60;
const KEY_MIN_H = 46;
const KEY_MAX_H = 72;
// Tablets: `supportsTablet` is on, and a keypad stretched across an iPad is
// both ugly and unreachable. Phones are all narrower than this.
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

export interface KeypadSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The entry as it will be recorded, already formatted by the caller. */
  display: string;
  /** Nothing typed yet: delete and submit have no subject. */
  empty: boolean;
  /** A solve or a scramble is in flight, same gate the touch timer uses. */
  disabled?: boolean;
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  /** Long press on delete. Clears the whole entry rather than one digit. */
  onClear: () => void;
  onSubmit: () => void;
}

export function KeypadSheet({
  visible,
  onClose,
  display,
  empty,
  disabled,
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
}: KeypadSheetProps) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const insets = useSafeAreaInsets();

  const keyHeight = Math.max(KEY_MIN_H, Math.min(KEY_MAX_H, sc(KEY_BASE_H)));
  // Sheet ends in a flat 24pt. That clears a home indicator only just, and the
  // bottom row of a keypad is the row you press hardest against.
  const extraBottom = Math.max(0, insets.bottom - space.xl);

  return (
    // No title. The sheet is a keyboard, and a keyboard does not introduce
    // itself; the value it is editing is the heading, drawn below.
    <Sheet visible={visible} onClose={onClose}>
      <View style={{ gap: space.md, paddingBottom: extraBottom }}>
        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text
            adjustsFontSizeToFit
            numberOfLines={1}
            allowFontScaling={false}
            style={{
              color: empty ? p.textMuted : p.text,
              fontFamily: MONO_BOLD,
              fontSize: sc(40),
              fontVariant: ['tabular-nums'],
            }}
          >
            {display}
          </Text>
          <Muted>{empty ? 'Type a time, then press the tick' : 'Press the tick to add it'}</Muted>
        </View>

        <Keypad
          keyHeight={keyHeight}
          empty={empty}
          disabled={disabled}
          onDigit={onDigit}
          onBackspace={onBackspace}
          onClear={onClear}
          onSubmit={onSubmit}
        />
      </View>
    </Sheet>
  );
}

function Keypad({
  keyHeight,
  empty,
  disabled,
  onDigit,
  onBackspace,
  onClear,
  onSubmit,
}: {
  keyHeight: number;
} & Omit<KeypadSheetProps, 'visible' | 'onClose' | 'display'>) {
  const { s: sc } = useScreenScale();
  return (
    // An explicit key height rather than flex shares: the sheet sizes itself to
    // its content, and a flex child of a content-sized parent resolves to zero
    // (HANDOFF trap 2). The keypad decides how tall it is; the sheet follows.
    <View style={{ width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: KEY_GAP }}>
      {Array.from({ length: ROWS }, (_, row) => (
        <View key={row} style={{ flexDirection: 'row', gap: KEY_GAP }}>
          {KEYS.slice(row * COLUMNS, row * COLUMNS + COLUMNS).map((key, col) => (
            <KeypadKey
              key={key.kind === 'digit' ? key.value : key.kind}
              spec={key}
              sc={sc}
              height={keyHeight}
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
  height,
  disabled,
  onPress,
  onLongPress,
  accessibilityPosition,
}: {
  spec: Key;
  sc: (n: number) => number;
  height: number;
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
        height,
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
