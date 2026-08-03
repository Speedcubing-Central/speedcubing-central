import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { UNOFFICIAL_EVENTS, WCA_EVENTS, type WcaEvent } from '@scc/shared';
import { usePalette } from '../../store/settings';
import { Button, Label, Muted, Pill } from '../../components/ui';
import { Sheet, SheetScrollView } from '../../components/Sheet';
import { font, radius, space } from '../../theme';
import { BATTLE_ALG_SETS, BATTLE_EVENT_IDS } from './algSetOptions';

// The event and scramble-type picker, used both when creating a room and when
// the host changes one mid-session. Same pair of choices as the web's
// EventAndAlgSetSelect, and the same rule between them: picking a new event
// clears the algorithm set, because a set belongs to a puzzle.
//
// One sheet rather than two dropdowns. The web uses two `<select>`s because a
// desktop form row can hold them; on a phone the second only exists for 3x3 and
// 2x2, so a whole second screen for it would be mostly-empty most of the time.
// Here the scramble type sits above the event list as a row of pills and appears
// only when the selected event has any, which also makes the dependency between
// the two visible rather than something you discover by changing the event.
//
// Unlike the Timer's event picker this does NOT close on selection: there are
// two decisions to make and closing after the first would make the second
// unreachable without reopening.
export function BattleEventSheet({
  visible,
  eventId,
  algSetId,
  onClose,
  onApply,
  title = 'Event',
  note,
  applyLabel = 'Done',
}: {
  visible: boolean;
  eventId: string;
  algSetId: string | null;
  onClose: () => void;
  onApply: (eventId: string, algSetId: string | null) => void;
  title?: string;
  note?: string;
  applyLabel?: string;
}) {
  const p = usePalette();
  const [draftEvent, setDraftEvent] = useState(eventId);
  const [draftAlgSet, setDraftAlgSet] = useState<string | null>(algSetId);

  // Reopening shows what is currently set rather than whatever was last
  // half-chosen and abandoned.
  useEffect(() => {
    if (visible) {
      setDraftEvent(eventId);
      setDraftAlgSet(algSetId);
    }
  }, [visible, eventId, algSetId]);

  const algSetChoices = BATTLE_ALG_SETS.filter((s) => s.puzzle === draftEvent);
  const wcaEvents = WCA_EVENTS.filter((e) => BATTLE_EVENT_IDS.includes(e.id));

  const renderGroup = (label: string, events: WcaEvent[]) => (
    <View style={{ gap: space.xs }}>
      <Label style={{ marginTop: space.sm }}>{label}</Label>
      {events.map((e) => {
        const selected = e.id === draftEvent;
        return (
          <Pressable
            key={e.id}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              setDraftEvent(e.id);
              // A set belongs to a puzzle, so it cannot survive an event change.
              setDraftAlgSet(null);
            }}
            style={({ pressed }) => ({
              paddingVertical: 13,
              paddingHorizontal: space.md,
              borderRadius: radius.sm,
              backgroundColor: selected ? p.accent : pressed ? p.cardHover : 'transparent',
            })}
          >
            <Text
              style={{
                color: selected ? '#fff' : p.text,
                fontSize: 15,
                fontFamily: selected ? font.sansBold : font.sansMedium,
              }}
            >
              {e.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      fillHeight
      maxHeightRatio={0.82}
      headerRight={
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            onApply(draftEvent, draftAlgSet);
            onClose();
          }}
          hitSlop={10}
        >
          <Text style={{ color: p.accent, fontFamily: font.sansBold, fontSize: 15 }}>{applyLabel}</Text>
        </Pressable>
      }
    >
      <SheetScrollView>
        {note ? <Muted style={{ marginBottom: space.sm }}>{note}</Muted> : null}

        {algSetChoices.length > 0 && (
          <View style={{ gap: space.sm }}>
            <Label>Scramble type</Label>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              <Pill
                label="Standard"
                selected={draftAlgSet === null}
                onPress={() => setDraftAlgSet(null)}
              />
              {algSetChoices.map((s) => (
                <Pill
                  key={s.id}
                  label={s.label}
                  selected={draftAlgSet === s.id}
                  onPress={() => setDraftAlgSet(s.id)}
                />
              ))}
            </View>
            <Muted>
              An algorithm set draws one random case per round instead of a full scramble.
            </Muted>
          </View>
        )}

        {renderGroup('WCA events', wcaEvents)}
        {renderGroup('Unofficial events', UNOFFICIAL_EVENTS)}

        <Button
          label={applyLabel}
          variant="primary"
          style={{ marginTop: space.md }}
          onPress={() => {
            onApply(draftEvent, draftAlgSet);
            onClose();
          }}
        />
      </SheetScrollView>
    </Sheet>
  );
}
