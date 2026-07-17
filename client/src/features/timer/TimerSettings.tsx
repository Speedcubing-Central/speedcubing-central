import { Modal } from '../../components/Modal';
import { useSettings } from '../../store/settings';
import { Toggle, Segmented, Row, selectCls } from '../../components/settingsUi';

export function TimerSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();

  return (
    <Modal open={open} onClose={onClose} title="Timer Settings" size="md">
      <div className="space-y-0.5">
        <Row label="Inspection" hint="15-second WCA inspection before each solve">
          <Toggle checked={s.inspection} onChange={(v) => s.set({ inspection: v })} />
        </Row>

        <Row label="Inspection counting" hint="Count down from 15 or up from 0" disabled={!s.inspection}>
          <Segmented
            disabled={!s.inspection}
            value={s.inspectionDirection}
            onChange={(v) => s.set({ inspectionDirection: v })}
            options={[
              { value: 'down', label: 'Count down' },
              { value: 'up', label: 'Count up' },
            ]}
          />
        </Row>

        <Row label="Inspection voice alerts" hint='Speaks "8 seconds" and "12 seconds"' disabled={!s.inspection}>
          <Toggle checked={s.inspectionVoice} disabled={!s.inspection} onChange={(v) => s.set({ inspectionVoice: v })} />
        </Row>

        <Row label="Time entry" hint="Spacebar/touch timing or type your times">
          <Segmented
            value={s.entryMode}
            onChange={(v) => s.set({ entryMode: v })}
            options={[
              { value: 'keyboard', label: 'Timer' },
              { value: 'typing', label: 'Type in' },
            ]}
          />
        </Row>

        <Row label="Hold to start" hint="Require holding before the timer arms">
          <Toggle checked={s.holdToStart} onChange={(v) => s.set({ holdToStart: v })} />
        </Row>

        <Row label="Hold duration" hint="How long to hold before the timer turns green" disabled={!s.holdToStart}>
          <select
            className={selectCls}
            disabled={!s.holdToStart}
            value={s.holdDuration}
            onChange={(e) => s.set({ holdDuration: Number(e.target.value) })}
          >
            <option value={300}>0.3 s</option>
            <option value={550}>0.55 s</option>
            <option value={800}>0.8 s</option>
            <option value={1000}>1.0 s</option>
          </select>
        </Row>

        <Row label="Timer update" hint="Precision shown while the timer is running">
          <select className={selectCls} value={s.timerUpdate} onChange={(e) => s.set({ timerUpdate: e.target.value as never })}>
            <option value="centiseconds">0.00 (centiseconds)</option>
            <option value="deciseconds">0.0 (deciseconds)</option>
            <option value="seconds">0 (seconds)</option>
            <option value="hidden">Hidden while solving</option>
          </select>
        </Row>

        <Row label="Solve precision" hint="Decimals shown in the solves list & stats">
          <select className={selectCls} value={s.solvePrecision} onChange={(e) => s.set({ solvePrecision: Number(e.target.value) as 2 | 3 })}>
            <option value={2}>0.00</option>
            <option value={3}>0.000</option>
          </select>
        </Row>

        <Row label="Start sound" hint="Beep when the timer starts">
          <Toggle checked={s.startSound} onChange={(v) => s.set({ startSound: v })} />
        </Row>

        <Row label="PB celebration" hint="Confetti + animated text when you set a new personal best">
          <Toggle checked={s.celebratePBs} onChange={(v) => s.set({ celebratePBs: v })} />
        </Row>

        <div className="pt-3 mt-1">
          <div className="label">Stats table columns</div>
          <Row label="Show BPA" hint="Best possible average of the current in-progress average">
            <Toggle checked={s.showBPA} onChange={(v) => s.set({ showBPA: v })} />
          </Row>
          <Row label="Show WPA" hint="Worst possible average">
            <Toggle checked={s.showWPA} onChange={(v) => s.set({ showWPA: v })} />
          </Row>
          <Row label="Show session-best target" hint="Single needed to beat your session best">
            <Toggle checked={s.showTarget} onChange={(v) => s.set({ showTarget: v })} />
          </Row>
        </div>
      </div>
    </Modal>
  );
}
