import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getEvent, SUBSET_EVENTS } from '@scc/shared';
import { apiError } from '../../lib/api';
import { usePalette, useSettings } from '../../store/settings';
import { Button, EmptyState, Muted } from '../../components/ui';
import { useTimerDataContext } from './TimerDataContext';
import { radius, space } from '../../theme';

// Session management for the current event. The mobile equivalent of the web
// SessionManager modal: pick, create, rename, delete. Same server endpoints, so
// a session created on a phone shows up in the web client's dropdown and vice
// versa.
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

  const canSubset = event === '333';

  async function create() {
    const name = newName.trim() || `${getEvent(event)?.name ?? event} Session`;
    try {
      await data.createSession(name, subset ?? undefined);
      setNewName('');
      setSubset(null);
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
        <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>
          {getEvent(event)?.name ?? event} sessions
        </Text>

        {data.sessions.length === 0 ? (
          <EmptyState title="No sessions for this event yet" body="Create one below, or just start solving. A session is created automatically." />
        ) : (
          <View style={{ gap: space.sm }}>
            {data.sessions.map((s) => {
              const active = s.id === data.currentId;
              const isRenaming = renamingId === s.id;
              return (
                <View
                  key={s.id}
                  style={{
                    borderWidth: 1,
                    borderColor: active ? p.accent : p.border,
                    backgroundColor: p.card,
                    borderRadius: radius.sm,
                    padding: space.md,
                    gap: space.sm,
                  }}
                >
                  {isRenaming ? (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      <TextInput
                        value={renameDraft}
                        onChangeText={setRenameDraft}
                        autoFocus
                        style={{
                          flex: 1,
                          color: p.text,
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
                  ) : (
                    <Pressable accessibilityRole="button" onPress={() => data.setCurrentId(s.id)}>
                      <Text style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
                        {s.name}
                        {s.subset ? ` (${SUBSET_EVENTS.find((e) => e.id === s.subset)?.name ?? s.subset})` : ''}
                      </Text>
                      <Muted>
                        {s.solveCount ?? 0} solve{(s.solveCount ?? 0) === 1 ? '' : 's'}
                        {active ? ' · current' : ''}
                      </Muted>
                    </Pressable>
                  )}

                  {!isRenaming && (
                    <View style={{ flexDirection: 'row', gap: space.sm }}>
                      {!active && (
                        <Button label="Use" variant="primary" onPress={() => data.setCurrentId(s.id)} style={{ flex: 1 }} />
                      )}
                      <Button
                        label="Rename"
                        onPress={() => {
                          setRenamingId(s.id);
                          setRenameDraft(s.name);
                        }}
                        style={{ flex: 1 }}
                      />
                      <Button label="Delete" variant="danger" onPress={() => confirmDelete(s.id, s.name)} style={{ flex: 1 }} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* New session */}
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
          <Text style={{ color: p.text, fontWeight: '700', fontSize: 15 }}>New session</Text>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder={`${getEvent(event)?.name ?? event} Session`}
            placeholderTextColor={p.textMuted}
            style={{
              color: p.text,
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
                  <SubsetChip
                    key={e.id}
                    label={e.name}
                    active={subset === e.id}
                    onPress={() => setSubset(e.id)}
                  />
                ))}
              </View>
            </View>
          )}
          <Button label="Create session" variant="primary" onPress={create} />
        </View>
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
      <Text style={{ color: active ? '#fff' : p.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}
