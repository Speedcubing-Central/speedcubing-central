import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { usePalette } from '../../store/settings';
import { validateScramble } from '../../lib/cubingSvg';
import { Button, MONO, Muted } from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { font, radius, space } from '../../theme';

// Enter a scramble by hand, the mobile counterpart of the web ScramblePanel's
// pencil action.
//
// Validated before it is allowed to become the active scramble, because a
// scramble that doesn't apply would silently desync the cube from the image and
// from whatever the solve is recorded against. validateScramble catches both
// failure modes (notation that doesn't parse, and notation that parses but is
// illegal for this puzzle) using cubing.js itself, so the answer matches what
// the web client would say about the same input.
export function EditScrambleSheet({
  visible,
  eventId,
  current,
  onApply,
  onClose,
}: {
  visible: boolean;
  eventId: string;
  current: string;
  onApply: (scramble: string) => void;
  onClose: () => void;
}) {
  const p = usePalette();
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    setChecking(true);
    setError(null);
    try {
      const result = await validateScramble(eventId, draft);
      if (!result.ok) {
        setError(result.error ?? 'That scramble is not valid');
        return;
      }
      onApply(result.scramble);
      onClose();
    } finally {
      setChecking(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Custom scramble">
      <View style={{ gap: space.md, paddingBottom: space.md }}>
        <TextInput
          value={draft}
          onChangeText={(t) => {
            setDraft(t);
            // Clears as soon as they start fixing it, rather than leaving a
            // stale complaint about text that is no longer there.
            if (error) setError(null);
          }}
          multiline
          autoCapitalize="characters"
          autoCorrect={false}
          // Turned off deliberately: iOS would otherwise "correct" R U R' into
          // prose, and a scramble is not prose.
          spellCheck={false}
          placeholder="R U R' U'"
          placeholderTextColor={p.textMuted}
          style={{
            color: p.text,
            fontFamily: MONO,
            fontSize: 15,
            lineHeight: 22,
            minHeight: 96,
            textAlignVertical: 'top',
            padding: space.md,
            borderRadius: radius.sm,
            // Inset, darker than the sheet, the same relationship the web
            // client's inputs have to the card they sit in.
            backgroundColor: p.bg,
            borderWidth: 1,
            borderColor: error ? p.red : p.border,
          }}
        />

        {error ? (
          <Text style={{ color: p.red, fontFamily: font.sans, fontSize: 13 }}>{error}</Text>
        ) : (
          <Muted>Applies to the current attempt only. The next scramble is generated as usual.</Muted>
        )}

        <Button
          label={checking ? 'Checking…' : 'Use this scramble'}
          variant="primary"
          onPress={submit}
          disabled={checking || !draft.trim()}
        />
      </View>
    </Sheet>
  );
}
