import { useSettings } from '../../store/settings';
import { Muted } from '../../components/ui';
import { OptionRow, SettingsRow, Toggle } from '../../components/settingsUi';
import { Sheet, SheetScrollView } from '../../components/Sheet';
import { space } from '../../theme';

// The same five settings the web's Battle Settings modal offers, reading and
// writing the same store keys the Timer's own settings screen does. That
// sharing is deliberate and matches web: inspection, hold-to-start and entry
// mode are how *you* solve, not properties of a room, so changing them here
// changes them everywhere, and a player who set up their timer once does not
// have to do it again to join a battle.
export function BattleSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const s = useSettings();

  return (
    <Sheet visible={visible} onClose={onClose} title="Battle settings" fillHeight maxHeightRatio={0.8}>
      <SheetScrollView>
        <SettingsRow label="Inspection" hint="15-second WCA inspection before each solve" inline>
          <Toggle value={s.inspection} onChange={(v) => s.set({ inspection: v })} />
        </SettingsRow>

        <SettingsRow label="Inspection counting" hint="Count down from 15 or up from 0" disabled={!s.inspection}>
          <OptionRow
            disabled={!s.inspection}
            value={s.inspectionDirection}
            onChange={(v) => s.set({ inspectionDirection: v })}
            options={[
              { value: 'down' as const, label: 'Count down' },
              { value: 'up' as const, label: 'Count up' },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Inspection voice alerts"
          hint='Speaks "8 seconds" and "12 seconds"'
          disabled={!s.inspection}
          inline
        >
          <Toggle
            value={s.inspectionVoice}
            disabled={!s.inspection}
            onChange={(v) => s.set({ inspectionVoice: v })}
          />
        </SettingsRow>

        <SettingsRow label="Time entry" hint="Touch timing, or type your time on a keypad">
          <OptionRow
            value={s.entryMode}
            onChange={(v) => s.set({ entryMode: v })}
            options={[
              { value: 'keyboard' as const, label: 'Timer' },
              { value: 'typing' as const, label: 'Type in' },
            ]}
          />
        </SettingsRow>

        <SettingsRow
          label="Hold to start"
          hint="Hold the timer before releasing to start"
          disabled={s.entryMode !== 'keyboard'}
          inline
        >
          <Toggle
            value={s.holdToStart}
            disabled={s.entryMode !== 'keyboard'}
            onChange={(v) => s.set({ holdToStart: v })}
          />
        </SettingsRow>

        <Muted style={{ marginTop: space.md }}>
          These are your timer settings, shared with the Timer tab and with the website. Everything about the room
          itself (its event, and when a round starts) belongs to the host.
        </Muted>
      </SheetScrollView>
    </Sheet>
  );
}
