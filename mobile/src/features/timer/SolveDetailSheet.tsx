import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import {
  averagesForSolve,
  formatSolveCopy,
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
import { scrambleImageHeight } from '../../lib/scramble';
import { useScreenScale } from '../../lib/scale';
import {
  Button,
  ColumnLabel,
  CopyButton,
  EMPTY,
  Input,
  MONO,
  MONO_BOLD,
  Muted,
  Surface,
} from '../../components/ui';
import { Sheet } from '../../components/Sheet';
import { ScrambleNet, hasScrambleNet } from '../../components/ScrambleNet';
import { PenaltyRow } from './PenaltyRow';
import { space } from '../../theme';

// One solve, in detail. The mobile equivalent of the web SolveDetail modal:
// penalty editing, time correction, a comment, deletion, and the averages that
// were current at the moment this solve completed (averagesForSolve, straight
// from @scc/shared, so the values match web exactly).
export function SolveDetailSheet({
  solves,
  index,
  event,
  visible,
  onClose,
  onUpdatePenalty,
  onUpdateTime,
  onUpdateComment,
  onDelete,
  onOpenAverage,
}: {
  solves: SolveDTO[];
  /** Null before anything has been opened, and again while the sheet exits. */
  index: number | null;
  event: string;
  visible: boolean;
  onClose: () => void;
  onUpdatePenalty: (id: string, penalty: Penalty, plusTwoCount: number) => void;
  onUpdateTime: (id: string, time: number) => void;
  onUpdateComment: (id: string, comment: string) => void;
  onDelete: (id: string) => void;
  onOpenAverage: (view: SolveAverage) => void;
}) {
  const p = usePalette();
  const { s: sc } = useScreenScale();
  const solvePrecision = useSettings((s) => s.solvePrecision);
  const isFmc = TIMER_ONLY_EVENT_IDS.includes(event);
  // 'comfortable' unconditionally: this sheet scrolls, so it has no height
  // budget to trade against and there is nothing to be gained by shrinking.
  const netH = scrambleImageHeight(event, 'comfortable', sc);

  // The sheet stays mounted so it can play its exit animation, so `index` goes
  // null while it is still on screen. Hold the last real one so the content
  // stays put on the way out instead of the sheet flashing empty.
  const lastIndexRef = useRef<number | null>(null);
  if (index !== null) lastIndexRef.current = index;
  const shownIndex = index ?? lastIndexRef.current;
  const solve = shownIndex === null ? undefined : solves[shownIndex];

  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState('');
  const [comment, setComment] = useState('');

  // Now that the sheet outlives one solve, its draft state has to follow the
  // subject. Previously the component remounted per solve and useState's
  // initial value was enough; keeping that would show the previous solve's
  // comment against the next one, which would then be saved on blur.
  useEffect(() => {
    setComment(solve?.comment ?? '');
    setEditingTime(false);
    setTimeDraft('');
  }, [solve?.id]);

  if (!solve) return null;

  const averages = averagesForSolve(solves, shownIndex!);

  const display = isFmc
    ? formatMoveCount(solve.time, solve.penalty, 0, solve.plusTwoCount)
    : formatTime(solve.time, solve.penalty, solvePrecision, solve.plusTwoCount);

  function saveTime() {
    const parsed = parseTimeInput(timeDraft, solvePrecision);
    if (!parsed) {
      Alert.alert('Invalid time', 'Enter a time like 12.34, 1:02.50, or a plain move count for FMC.');
      return;
    }
    onUpdateTime(solve!.id, parsed.time);
    setEditingTime(false);
  }

  function confirmDelete() {
    Alert.alert('Delete solve?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          onDelete(solve!.id);
          onClose();
        },
      },
    ]);
  }

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Solve"
      headerRight={
        // Moved up here from under the Scramble heading. Copying is an action on
        // the solve, so it belongs beside the solve's own title rather than
        // filed under one of its properties.
        <CopyButton
          getText={() => formatSolveCopy(solve!, event, solvePrecision)}
          label="Copy solve"
          accessibilityLabel="Copy this solve"
        />
      }
    >
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.lg }}>
        {/* Result */}
        <View style={{ alignItems: 'center', gap: 4 }}>
          {editingTime ? (
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Input
                value={timeDraft}
                onChangeText={setTimeDraft}
                autoFocus
                mono
                align="center"
                keyboardType="numbers-and-punctuation"
                placeholder={display}
                onSubmitEditing={saveTime}
                style={{ fontSize: 24, minWidth: 140 }}
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
              <Text
                style={{
                  color: solve.penalty === 'DNF' ? p.red : p.text,
                  fontFamily: MONO_BOLD,
                  fontSize: 40,
                  fontVariant: ['tabular-nums'],
                }}
              >
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

        {/* Scramble, with the image beside it. The Timer shows one for the
            upcoming scramble, and this is the same question asked about a solve
            already done, so it belongs here too. */}
        <View>
          <Muted style={{ marginBottom: 4 }}>Scramble</Muted>
          <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
            <Text style={{ color: p.text, fontFamily: MONO, fontSize: 12, lineHeight: 19, flex: 1 }}>
              {normalizeScramble(solve.scramble) || EMPTY}
            </Text>
            {hasScrambleNet(event) && solve.scramble ? (
              // Same per-puzzle sizing the Timer uses. A 7x7's scramble was
              // exactly as unreadable at a flat 104 here as it was in the old
              // 50pt strip box, and this sheet scrolls, so there is no column
              // budget to protect.
              <ScrambleNet
                eventId={event}
                scramble={solve.scramble}
                size={netH}
                maxHeight={netH}
              />
            ) : null}
          </View>
        </View>

        {/* Averages current at this solve */}
        {averages.length > 0 && (
          <View>
            <Muted style={{ marginBottom: 6 }}>Averages ending on this solve</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {averages.map((a) => (
                <Surface
                  key={a.size}
                  padding="none"
                  onPress={() => onOpenAverage(a)}
                  accessibilityLabel={`Open the ${a.size === 3 ? 'mo3' : `ao${a.size}`} ending on this solve`}
                  style={{ paddingVertical: 8, paddingHorizontal: space.md }}
                >
                  <ColumnLabel>{a.size === 3 ? 'mo3' : `ao${a.size}`}</ColumnLabel>
                  <Text
                    style={{
                      color: p.text,
                      fontFamily: MONO_BOLD,
                      fontSize: 15,
                      fontVariant: ['tabular-nums'],
                    }}
                  >
                    {a.value === null
                      ? EMPTY
                      : !isFinite(a.value)
                        ? 'DNF'
                        : isFmc
                          ? formatMoveCount(a.value, 'NONE', 2)
                          : formatTime(Math.round(a.value), 'NONE', solvePrecision)}
                  </Text>
                </Surface>
              ))}
            </View>
          </View>
        )}

        {/* Comment */}
        <View>
          <Muted style={{ marginBottom: 4 }}>Comment</Muted>
          <Input
            value={comment}
            onChangeText={setComment}
            onBlur={() => {
              if ((solve.comment ?? '') !== comment) onUpdateComment(solve.id, comment);
            }}
            placeholder="Add a note about this solve"
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top', fontSize: 14 }}
          />
        </View>

        <Button label="Delete solve" variant="danger" onPress={confirmDelete} />
      </ScrollView>
    </Sheet>
  );
}
