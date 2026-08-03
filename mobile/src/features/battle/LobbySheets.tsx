import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { getEvent } from '@scc/shared';
import { api, apiError } from '../../lib/api';
import { useKeyboardHeight } from '../../lib/keyboard';
import { usePalette } from '../../store/settings';
import { useAuth } from '../../store/auth';
import { Button, Input, Label } from '../../components/ui';
import { SettingsRow, Toggle } from '../../components/settingsUi';
import { Sheet, SheetScrollView } from '../../components/Sheet';
import { Icon } from '../../components/Icon';
import { font, radius, space, stroke } from '../../theme';
import { BattleEventSheet } from './BattleEventSheet';
import { battleAlgSetLabel } from './algSetOptions';
import { setGuestName, useGuestName } from './guestName';

// Creating and joining a room. Every field the web lobby's two modals have, in
// the sheet vocabulary the rest of this app uses.
//
// Both sheets pad themselves by the keyboard's height. On iOS the keyboard is
// drawn over the app without moving anything, and a sheet is anchored to the
// bottom edge, so without this the field you are typing into is the one thing
// covered. See lib/keyboard.ts for why this is padding rather than a
// KeyboardAvoidingView.

/** The label a room's event and algorithm set read as together. */
export function battleEventLabel(eventId: string, algSetId: string | null): string {
  const set = battleAlgSetLabel(algSetId);
  if (set) return `${set} Battle`;
  return getEvent(eventId)?.name ?? eventId;
}

function EventRow({
  eventId,
  algSetId,
  onPress,
}: {
  eventId: string;
  algSetId: string | null;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <View style={{ gap: space.xs }}>
      <Label>Event</Label>
      <Button label={battleEventLabel(eventId, algSetId)} onPress={onPress} />
    </View>
  );
}

export function CreateRoomSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called with the new room's code once the server has made it. */
  onCreated: (code: string, displayName: string, password?: string) => void;
}) {
  const { user } = useAuth();
  const stored = useGuestName();
  const keyboard = useKeyboardHeight();

  const [name, setName] = useState('');
  const [guest, setGuest] = useState('');
  const [eventId, setEventId] = useState('333');
  const [algSetId, setAlgSetId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [showEvents, setShowEvents] = useState(false);

  // Seeded from storage once it has loaded, so a returning guest keeps the name
  // their old participant row is filed under (see guestName.ts).
  useEffect(() => {
    if (stored.ready && !guest) setGuest(stored.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.ready]);

  async function create() {
    const displayName = user?.displayName ?? guest.trim();
    if (!displayName) {
      setProblem('Enter a display name');
      return;
    }
    if (!name.trim()) {
      setProblem('Enter a room name');
      return;
    }
    if (!isPublic && !password) {
      setProblem('Private rooms need a password');
      return;
    }
    if (!user) setGuestName(displayName);
    setProblem(null);
    setBusy(true);
    try {
      const { data } = await api.post<{ code: string }>('/battle', {
        name: name.trim(),
        eventId,
        algSetId: algSetId ?? undefined,
        isPublic,
        password: isPublic ? undefined : password,
      });
      onCreated(data.code, displayName, isPublic ? undefined : password);
      // Left clean for next time, but only once the room actually exists: a
      // failed create keeps everything typed.
      setName('');
      setPassword('');
      onClose();
    } catch (e) {
      setProblem(apiError(e, 'Failed to create room'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Sheet visible={visible} onClose={onClose} title="Create a room" fillHeight maxHeightRatio={0.85}>
        <SheetScrollView>
          <View style={{ gap: space.md, paddingBottom: keyboard }}>
            {!user && (
              <View style={{ gap: space.xs }}>
                <Label>Your display name</Label>
                <Input
                  value={guest}
                  onChangeText={setGuest}
                  placeholder="e.g. SpeedyCuber99"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={40}
                />
              </View>
            )}

            <View style={{ gap: space.xs }}>
              <Label>Room name</Label>
              <Input
                value={name}
                onChangeText={setName}
                placeholder="e.g. Friday night 3x3"
                maxLength={40}
              />
            </View>

            <EventRow eventId={eventId} algSetId={algSetId} onPress={() => setShowEvents(true)} />

            <SettingsRow label="Public room" hint="Listed for anyone to join" inline>
              <Toggle value={isPublic} onChange={setIsPublic} />
            </SettingsRow>

            {!isPublic && (
              <View style={{ gap: space.xs }}>
                <Label>Room password</Label>
                <Input
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Joiners will need this"
                  secureTextEntry
                  autoCapitalize="none"
                  maxLength={64}
                />
              </View>
            )}

            {problem ? <ProblemNote text={problem} /> : null}

            <Button
              label={busy ? 'Creating…' : 'Create room'}
              variant="primary"
              onPress={create}
              disabled={busy}
            />
          </View>
        </SheetScrollView>
      </Sheet>

      <BattleEventSheet
        visible={showEvents}
        eventId={eventId}
        algSetId={algSetId}
        onClose={() => setShowEvents(false)}
        onApply={(e, s) => {
          setEventId(e);
          setAlgSetId(s);
        }}
      />
    </>
  );
}

export function JoinRoomSheet({
  visible,
  onClose,
  onJoin,
  /** Prefilled when coming from a room in the public list. */
  initialCode = '',
}: {
  visible: boolean;
  onClose: () => void;
  onJoin: (code: string, displayName: string, password?: string) => void;
  initialCode?: string;
}) {
  const { user } = useAuth();
  const stored = useGuestName();
  const keyboard = useKeyboardHeight();

  const [code, setCode] = useState(initialCode);
  const [guest, setGuest] = useState('');
  const [password, setPassword] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCode(initialCode);
      setProblem(null);
    }
  }, [visible, initialCode]);

  useEffect(() => {
    if (stored.ready && !guest) setGuest(stored.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.ready]);

  function join() {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setProblem('Enter a room code');
      return;
    }
    const displayName = user?.displayName ?? guest.trim();
    if (!displayName) {
      setProblem('Enter a display name');
      return;
    }
    if (!user) setGuestName(displayName);
    onJoin(trimmed, displayName, password || undefined);
    setPassword('');
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Join a room" fillHeight maxHeightRatio={0.85}>
      <SheetScrollView>
        <View style={{ gap: space.md, paddingBottom: keyboard }}>
          {!user && (
            <View style={{ gap: space.xs }}>
              <Label>Your display name</Label>
              <Input
                value={guest}
                onChangeText={setGuest}
                placeholder="e.g. SpeedyCuber99"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={40}
              />
            </View>
          )}

          <View style={{ gap: space.xs }}>
            <Label>Room code</Label>
            <Input
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="ABCD12"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              mono
              align="center"
              style={{ fontSize: 22, letterSpacing: 4, paddingVertical: 14 }}
              onSubmitEditing={join}
            />
          </View>

          <View style={{ gap: space.xs }}>
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder="Only for private rooms"
              secureTextEntry
              autoCapitalize="none"
              maxLength={64}
              onSubmitEditing={join}
            />
          </View>

          {problem ? <ProblemNote text={problem} /> : null}

          <Button label="Join room" variant="primary" onPress={join} />
        </View>
      </SheetScrollView>
    </Sheet>
  );
}

/**
 * A validation failure, shown in the sheet rather than as an alert.
 *
 * The web lobby uses toasts for these. A modal alert over a form you are still
 * filling in is the wrong shape on a phone: it covers the field it is talking
 * about and has to be dismissed before you can act on it.
 */
function ProblemNote({ text }: { text: string }) {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        borderWidth: stroke.thin,
        borderColor: p.red,
        borderRadius: radius.sm,
        paddingVertical: space.sm,
        paddingHorizontal: space.md,
      }}
    >
      <Icon name="info" size={16} color={p.red} />
      <Text style={{ color: p.red, fontSize: 13, fontFamily: font.sansMedium, flex: 1 }}>{text}</Text>
    </View>
  );
}
