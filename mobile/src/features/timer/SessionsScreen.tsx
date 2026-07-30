import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEvent, SUBSET_EVENTS } from '@scc/shared';
import { apiError } from '../../lib/api';
import { usePalette, useSettings } from '../../store/settings';
import { Button, EmptyState, IconButton, Muted } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { useTimerDataContext } from './TimerDataContext';
import { font, radius, space } from '../../theme';

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
    <SafeAreaView edges={[]} style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md, paddingBottom: space.xl }}>
        {/* "3x3 Sessions", not "3x3 sessions". It's the name of the collection. */}
        <Text style={{ color: p.text, fontSize: 20, fontFamily: font.sansBlack }}>{eventName} Sessions</Text>

        {data.sessions.length === 0 ? (
          <EmptyState
            title="No sessions for this event yet"
            body="Create one below, or just start solving. A session is created automatically."
          />
        ) : (
          <View
            style={{
              backgroundColor: p.card,
              borderColor: p.border,
              borderWidth: 1,
              borderRadius: radius.md,
              overflow: 'hidden',
            }}
          >
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
                      borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                      borderTopColor: p.border,
                    }}
                  >
                    <TextInput
                      value={renameDraft}
                      onChangeText={setRenameDraft}
                      autoFocus
                      selectTextOnFocus
                      onSubmitEditing={async () => {
                        const name = renameDraft.trim();
                        if (name) await data.renameSession(s.id, name);
                        setRenamingId(null);
                      }}
                      style={{
                        flex: 1,
                        color: p.text,
                        fontFamily: font.sansMedium,
                        backgroundColor: p.cardHover,
                        borderRadius: radius.sm,
                        paddingHorizontal: space.md,
                        paddingVertical: 9,
                      }}
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
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
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
          </View>
        )}

        {/* New session. Collapsed to a single button until wanted, so the list
            of existing sessions isn't pushed off screen by a form nobody asked
            for yet. */}
        {creating ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.card,
              borderRadius: radius.md,
              padding: space.md,
              gap: space.sm,
            }}
          >
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
            <TextInput
              value={newName}
              onChangeText={setNewName}
              autoFocus
              placeholder={`${eventName} Session`}
              placeholderTextColor={p.textMuted}
              onSubmitEditing={create}
              style={{
                color: p.text,
                fontFamily: font.sansMedium,
                backgroundColor: p.cardHover,
                borderRadius: radius.sm,
                paddingHorizontal: space.md,
                paddingVertical: 11,
              }}
            />
            {canSubset && (
              <View style={{ gap: space.xs }}>
                <Muted>Scramble subset (optional)</Muted>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                  <SubsetChip label="Full 3x3" active={subset === null} onPress={() => setSubset(null)} />
                  {SUBSET_EVENTS.map((e) => (
                    <SubsetChip key={e.id} label={e.name} active={subset === e.id} onPress={() => setSubset(e.id)} />
                  ))}
                </View>
              </View>
            )}
            <Button label="Create session" variant="primary" onPress={create} />
          </View>
        ) : (
          <Button label="New session" onPress={() => setCreating(true)} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SubsetChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        backgroundColor: active ? p.accent : p.cardHover,
        borderRadius: radius.pill,
        paddingVertical: 7,
        paddingHorizontal: 13,
      }}
    >
      <Text style={{ color: active ? '#fff' : p.text, fontSize: 12, fontFamily: font.sansSemi }}>{label}</Text>
    </Pressable>
  );
}
