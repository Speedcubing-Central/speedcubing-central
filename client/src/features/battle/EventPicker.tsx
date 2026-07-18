import { WCA_EVENTS, UNOFFICIAL_EVENTS } from '@scc/shared';
import { BATTLE_ALG_SETS } from './algSetOptions';

// Shared between room creation (BattleLobby's CreateRoomModal) and the
// host's mid-room event change (BattleRoom's ChangeEventModal) so both stay
// in sync with exactly the same set of selectable events.
export const WCA_EVENT_OPTIONS = WCA_EVENTS.filter((e) =>
  ['333', '222', '444', '555', '666', '777', '333oh', '333bf', '444bf', '555bf', 'minx', 'pyram', 'clock', 'skewb', 'sq1'].includes(e.id),
);
export const UNOFFICIAL_EVENT_OPTIONS = UNOFFICIAL_EVENTS;

export function EventAndAlgSetSelect({
  eventId,
  algSetId,
  onEventChange,
  onAlgSetChange,
}: {
  eventId: string;
  algSetId: string | null;
  onEventChange: (eventId: string) => void;
  onAlgSetChange: (algSetId: string | null) => void;
}) {
  const algSetChoices = BATTLE_ALG_SETS.filter((s) => s.puzzle === eventId);

  return (
    <>
      <div>
        <label className="label mb-1 block">Event</label>
        <select
          className="input w-full"
          value={eventId}
          onChange={(e) => {
            onEventChange(e.target.value);
            onAlgSetChange(null);
          }}
        >
          <optgroup label="WCA Events">
            {WCA_EVENT_OPTIONS.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </optgroup>
          <optgroup label="Unofficial Events">
            {UNOFFICIAL_EVENT_OPTIONS.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </optgroup>
        </select>
      </div>
      {algSetChoices.length > 0 && (
        <div>
          <label className="label mb-1 block">Scramble Type</label>
          <select className="input w-full" value={algSetId ?? ''} onChange={(e) => onAlgSetChange(e.target.value || null)}>
            <option value="">Standard (full scramble)</option>
            {algSetChoices.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
