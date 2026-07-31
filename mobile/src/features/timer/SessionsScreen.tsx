import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { getEvent, SUBSET_EVENTS } from '@scc/shared';
import { apiError } from '../../lib/api';
import { usePalette, useSettings } from '../../store/settings';
import {
  Button,
  EmptyState,
  IconButton,
  Input,
  Muted,
  Pill,
  Screen,
  ScreenTitle,
  Surface,
} from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useTimerDataContext } from './TimerDataContext';
import { font, space, stroke } from '../../theme';

// Session management for the current event. The mobile equivalent of the web
// SessionManager modal: pick, create, rename, delete. Same server endpoints, so
// a session created on a phone shows up in the web client's dropdown and vice
// versa.
//
// Each session is a single tappable row: tap anywhere to make it current, with
// rename and delete as icon affordances on the right. The previous version gave
// every session three full-width buttons (Use / Rename / Delete), which made a
// list of four sessions into a wall of twelve buttons and buried the thing you
// actually came here to do. Selection is now the row itself and the current
// session is marked with a check rather than by inference from a missing button.
//
// Subsets (LSLL / LL / CLS) are offered at creation time, matching web: the
// session's eventId stays '333' and only its scramble source changes.
export default function SessionsScreen() {
  const p = usePalette();
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);

  const [newName, setNewName] = useState('');
  const [subset, setSubset] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [creating, setCreating] = useState(false);

  const canSubset = event === '333';
  const eventName = getEvent(event)?.name ?? event;

  async function create() {
    const name = newName.trim() || `${eventName} Session`;
    try {
      await data.createSession(name, subset ?? undefined);
      setNewName('');
      setSubset(null);
      setCreating(false);
    } catch (e) {
      Alert.alert('Could not create session', apiError(e));
    }
  }

  function confirmDelete(id: string, name: string) {
    Alert.alert(`Delete "${name}"?`, 'Every solve in this session will be deleted. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await data.deleteSession(id);
          } catch (e) {
            Alert.alert('Could not delete session', apiError(e));
          }
        },
      },
    ]);
  }

  return (
    <Screen scroll edges={[]}>
      {/* "3x3 Sessions", not "3x3 sessions". It's the name of the collection. */}
      <ScreenTitle>{eventName} Sessions</ScreenTitle>

        {data.sessions.length === 0 ? (
          <EmptyState
            title="No sessions for this event yet"
            body="Create one below, or just start solving. A session is created automatically."
          />
        ) : (
          <Surface padding="none" style={{ overflow: 'hidden' }}>
            {data.sessions.map((s, i) => {
              const active = s.id === data.currentId;
              const isRenaming = renamingId === s.id;
              const subsetName = s.subset
                ? SUBSET_EVENTS.find((e) => e.id === s.subset)?.name ?? s.subset
                : null;
              const count = s.solveCount ?? 0;

              if (isRenaming) {
                return (
                  <View
                    key={s.id}
                    style={{
                      flexDirection: 'row',
                      gap: space.sm,
                      padding: space.md,
                      borderTopWidth: i === 0 ? 0 : stroke.hairline,
                      borderTopColor: p.border,
                    }}
                  >
                    <Input
                      value={renameDraft}
                      onChangeText={setRenameDraft}
                      autoFocus
                      selectTextOnFocus
                      onSubmitEditing={async () => {
                        const name = renameDraft.trim();
                        if (name) await data.renameSession(s.id, name);
                        setRenamingId(null);
                      }}
                      style={{ flex: 1 }}
                    />
                    <Button
                      label="Save"
                      variant="primary"
                      onPress={async () => {
                        const name = renameDraft.trim();
                        if (name) await data.renameSession(s.id, name);
                        setRenamingId(null);
                      }}
                    />
                  </View>
                );
              }

              return (
                <Pressable
                  key={s.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => data.setCurrentId(s.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingHorizontal: space.md,
                    paddingVertical: 12,
                    backgroundColor: pressed ? p.cardHover : 'transparent',
                    borderTopWidth: i === 0 ? 0 : stroke.hairline,
                    borderTopColor: p.border,
                  })}
                >
                  {/* Fixed-width slot so names line up whether or not a row is current. */}
                  <View style={{ width: 20, alignItems: 'center' }}>
                    {active && <Icon name="check" size={17} color={p.accent} />}
                  </View>

                  <View style={{ flex: 1, gap: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: active ? p.accent : p.text,
                        fontSize: 15,
                        fontFamily: active ? font.sansBold : font.sansMedium,
                      }}
                    >
                      {s.name}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      {count} solve{count === 1 ? '' : 's'}
                      {subsetName ? ` · ${subsetName}` : ''}
                    </Muted>
                  </View>

                  <IconButton
                    name="pencil"
                    size={17}
                    accessibilityLabel={`Rename ${s.name}`}
                    color={p.textMuted}
                    onPress={() => {
                      setRenamingId(s.id);
                      setRenameDraft(s.name);
                    }}
                  />
                  <IconButton
                    name="trash"
                    size={17}
                    accessibilityLabel={`Delete ${s.name}`}
                    color={p.red}
                    onPress={() => confirmDelete(s.id, s.name)}
                  />
                </Pressable>
              );
            })}
          </Surface>
        )}

        {/* New session. Collapsed to a single button until wanted, so the list
            of existing sessions isn't pushed off screen by a form nobody asked
            for yet. */}
        {creating ? (
          <Surface style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: p.text, fontFamily: font.sansBold, fontSize: 15, flex: 1 }}>New session</Text>
              <IconButton
                name="x"
                size={18}
                accessibilityLabel="Cancel new session"
                color={p.textMuted}
                onPress={() => {
                  setCreating(false);
                  setNewName('');
                  setSubset(null);
                }}
              />
            </View>
            <Input
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder={`${eventName} Session`}
              onSubmitEditing={create}
            />
            {canSubset && (
              <View style={{ gap: space.xs }}>
                <Muted>Scramble subset (optional)</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  <Pill label="Full 3x3" selected={subset === null} onPress={() => setSubset(null)} />
                  {SUBSET_EVENTS.map((e) => (
                    <Pill key={e.id} label={e.name} selected={subset === e.id} onPress={() => setSubset(e.id)} />
                  ))}
                </View>
              </View>
            )}
            <Button label="Create session" variant="primary" onPress={create} />
          </Surface>
        ) : (
          <Button label="New session" onPress={() => setCreating(true)} />
        )}
    </Screen>
  );
}
