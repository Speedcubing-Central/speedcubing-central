import { useSettings } from '../../store/settings';
import { Muted, Screen } from '../../components/ui';
import { OptionRow, SettingsGroup, SettingsRow, Toggle } from '../../components/settingsUi';
import { space } from '../../theme';

// Same timer settings as the web TimerSettings modal, with the same labels,
// hints, options and defaults. These all feed the shared engine/stats logic, so
// a phone configured the same way behaves the same way.
export default function TimerSettingsScreen() {
  const s = useSettings();

  return (
    <Screen scroll edges={[]} gap={0}>
        <SettingsGroup title="Inspection">
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
        </SettingsGroup>

        <SettingsGroup title="Timing">
          <SettingsRow label="Time entry" hint="Touch timing or type your times in">
            <OptionRow
              value={s.entryMode}
              onChange={(v) => s.set({ entryMode: v })}
              options={[
                { value: 'keyboard' as const, label: 'Timer' },
                { value: 'typing' as const, label: 'Type in' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Hold to start" hint="Require holding before the timer arms" inline>
            <Toggle value={s.holdToStart} onChange={(v) => s.set({ holdToStart: v })} />
          </SettingsRow>
          <SettingsRow
            label="Hold duration"
            hint="How long to hold before the timer turns green"
            disabled={!s.holdToStart}
          >
            <OptionRow
              disabled={!s.holdToStart}
              value={s.holdDuration}
              onChange={(v) => s.set({ holdDuration: v })}
              options={[
                { value: 300, label: '0.3 s' },
                { value: 550, label: '0.55 s' },
                { value: 800, label: '0.8 s' },
                { value: 1000, label: '1.0 s' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Timer update" hint="Precision shown while the timer is running">
            <OptionRow
              value={s.timerUpdate}
              onChange={(v) => s.set({ timerUpdate: v })}
              options={[
                { value: 'centiseconds' as const, label: '0.00' },
                { value: 'deciseconds' as const, label: '0.0' },
                { value: 'seconds' as const, label: '0' },
                { value: 'hidden' as const, label: 'Hidden' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Solve precision" hint="Decimals shown in the solves list and stats">
            <OptionRow
              value={s.solvePrecision}
              onChange={(v) => s.set({ solvePrecision: v })}
              options={[
                { value: 2 as const, label: '0.00' },
                { value: 3 as const, label: '0.000' },
              ]}
            />
          </SettingsRow>
          <SettingsRow label="Start cue" hint="Haptic tick when the timer starts" inline>
            <Toggle value={s.startSound} onChange={(v) => s.set({ startSound: v })} />
          </SettingsRow>
          <SettingsRow label="PB celebration" hint="Highlight a new personal best after a solve" inline>
            <Toggle value={s.celebratePBs} onChange={(v) => s.set({ celebratePBs: v })} />
          </SettingsRow>
          <SettingsRow
            label="Megaminx carrot notation"
            hint="Show megaminx scrambles as carrot notation (+/-) instead of WCA moves"
            inline
          >
            <Toggle value={s.carrotNotation} onChange={(v) => s.set({ carrotNotation: v })} />
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Statistics columns">
          <SettingsRow label="Show BPA" hint="Best possible average of the current in-progress average" inline>
            <Toggle value={s.showBPA} onChange={(v) => s.set({ showBPA: v })} />
          </SettingsRow>
          <SettingsRow label="Show WPA" hint="Worst possible average" inline>
            <Toggle value={s.showWPA} onChange={(v) => s.set({ showWPA: v })} />
          </SettingsRow>
          <SettingsRow label="Show session-best target" hint="Single needed to beat your session best" inline>
            <Toggle value={s.showTarget} onChange={(v) => s.set({ showTarget: v })} />
          </SettingsRow>
        </SettingsGroup>

        <Muted style={{ marginTop: space.lg }}>
          These preferences are stored on this device, the same way the web client stores them per browser. Your
          solves and sessions live on the server and are shared across both.
        </Muted>
    </Screen>
  );
}
