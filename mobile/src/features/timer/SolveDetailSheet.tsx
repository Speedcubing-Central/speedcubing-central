import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import {
  averagesForSolve,
  formatMoveCount,
  formatTime,
  normalizeScramble,
  TIMER_ONLY_EVENT_IDS,
  type Penalty,
  type SolveAverage,
  type SolveDTO,
} from '@scc/shared';
import { usePalette, useSettings } from '../../store/settings';
import { parseTimeInput } from '../../lib/timeInput';
import { Button, MONO, Muted } from '../../components/ui';
import { PenaltyRow } from './PenaltyRow';
import { radius, space } from '../../theme';

// One solve, in detail. The mobile equivalent of the web SolveDetail modal:
// penalty editing, time correction, a comment, deletion, and the averages that
// were current at the moment this solve completed (averagesForSolve, straight
// from @scc/shared, so the values match web exactly).
export function SolveDetailSheet({
  solves,
  index,
  event,
  onClose,
  onUpdatePenalty,
  onUpdateTime,
  onUpdateComment,
  onDelete,
  onOpenAverage,
}: {
  solves: SolveDTO[];
  index: number;
  event: string;
  onClose: () => void;
  onUpdatePenalty: (id: string, penalty: Penalty, plusTwoCount: number) => void;
  onUpdateTime: (id: string, time: number) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onDelete: (id: string) => void;
  onOpenAverage: (view: SolveAverage) => void;
}) {
  const p = usePalette();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  const solve = solves[index];

  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState('');
  const [comment, setComment] = useState(solve?.comment ?? '');

  if (!solve) return null;

  const averages = averagesForSolve(solves, index);

  const display = isFmc
    ? formatMoveCount(solve.time, solve.penalty, 0, solve.plusTwoCount)
    : formatTime(solve.time, solve.penalty, solvePrecision, solve.plusTwoCount);

  function saveTime() {
    const parsed = parseTimeInput(timeDraft, solvePrecision);
    if (!parsed) {
      Alert.alert('Invalid time', 'Enter a time like 12.34, 1:02.50, or a plain move count for FMC.');
      return;
    }
    onUpdateTime(solve.id, parsed.time);
    setEditingTime(false);
  }

  function confirmDelete() {
    Alert.alert('Delete solve?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(solve.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#0008' }} onPress={onClose} />
      <View
        style={{
          maxHeight: '85%',
          backgroundColor: p.card,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          borderTopWidth: 1,
          borderColor: p.border,
          paddingHorizontal: space.md,
          paddingBottom: space.xl,
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: space.md }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: p.border }} />
        </View>

        <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}>
          {/* Result */}
          <View style={{ alignItems: 'center', gap: 4 }}>
            {editingTime ? (
              <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                <TextInput
                  value={timeDraft}
                  onChangeText={setTimeDraft}
                  autoFocus
                  keyboardType="numbers-and-punctuation"
                  placeholder={display}
                  placeholderTextColor={p.textMuted}
                  onSubmitEditing={saveTime}
                  style={{
                    color: p.text,
                    fontFamily: MONO,
                    fontSize: 24,
                    backgroundColor: p.cardHover,
                    borderRadius: radius.sm,
                    paddingHorizontal: space.md,
                    paddingVertical: 8,
                    minWidth: 140,
                    textAlign: 'center',
                  }}
                />
                <Button label="Save" variant="primary" onPress={saveTime} />
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Edit time"
                onPress={() => {
                  setTimeDraft('');
                  setEditingTime(true);
                }}
              >
                <Text style={{ color: p.text, fontFamily: MONO, fontSize: 40, fontWeight: '700' }}>
                  {display}
                </Text>
              </Pressable>
            )}
            <Muted>{new Date(solve.createdAt).toLocaleString()}</Muted>
            {!editingTime && <Muted>Tap the time to correct it</Muted>}
          </View>

          <PenaltyRow
            penalty={solve.penalty}
            plusTwoCount={solve.plusTwoCount}
            onChange={(pen, count) => onUpdatePenalty(solve.id, pen, count)}
            hidePlusTwo={isFmc}
          />

          {/* Scramble */}
          <View>
            <Muted style={{ marginBottom: 4 }}>Scramble</Muted>
            <Text style={{ color: p.text, fontFamily: MONO, fontSize: 12, lineHeight: 19 }}>
              {normalizeScramble(solve.scramble) || '—'}
            </Text>
          </View>

          {/* Averages current at this solve */}
          {averages.length > 0 && (
            <View>
              <Muted style={{ marginBottom: 6 }}>Averages ending on this solve</Muted>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {averages.map((a) => (
                  <Pressable
                    key={a.size}
                    accessibilityRole="button"
                    onPress={() => onOpenAverage(a)}
                    style={{
                      backgroundColor: p.cardHover,
                      borderRadius: radius.sm,
                      paddingVertical: 8,
                      paddingHorizontal: space.md,
                    }}
                  >
                    <Text style={{ color: p.textMuted, fontSize: 10, textTransform: 'uppercase' }}>
                      {a.size === 3 ? 'mo3' : `ao${a.size}`}
                    </Text>
                    <Text style={{ color: p.text, fontFamily: MONO, fontSize: 15, fontWeight: '700' }}>
                      {a.value === null
                        ? '—'
                        : !isFinite(a.value)
                          ? 'DNF'
                          : isFmc
                            ? formatMoveCount(a.value, 'NONE', 2)
                            : formatTime(Math.round(a.value), 'NONE', solvePrecision)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Comment */}
          <View>
            <Muted style={{ marginBottom: 4 }}>Comment</Muted>
            <TextInput
              value={comment}
              onChangeText={setComment}
              onBlur={() => {
                if ((solve.comment ?? '') !== comment) onUpdateComment(solve.id, comment);
              }}
              placeholder="Add a note about this solve"
              placeholderTextColor={p.textMuted}
              multiline
              style={{
                color: p.text,
                backgroundColor: p.cardHover,
                borderRadius: radius.sm,
                padding: space.md,
                minHeight: 72,
                textAlignVertical: 'top',
                fontSize: 14,
              }}
            />
          </View>

          <Button label="Delete solve" variant="danger" onPress={confirmDelete} />
        </ScrollView>
      </View>
    </Modal>
  );
}
