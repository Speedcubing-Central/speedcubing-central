import { Modal } from '../../components/Modal';
import { useSettings } from '../../store/settings';
import { Toggle, Segmented, Row, selectCls } from '../../components/settingsUi';

export function TrainerSettings({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();

  return (
    <Modal open={open} onClose={onClose} title="Trainer Settings" size="md">
      <div className="space-y-0.5">
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

        <Row label="Timer update" hint="Precision shown while the timer is running">
          <select className={selectCls} value={s.timerUpdate} onChange={(e) => s.set({ timerUpdate: e.target.value as never })}>
            <option value="centiseconds">0.00 (centiseconds)</option>
            <option value="deciseconds">0.0 (deciseconds)</option>
            <option value="seconds">0 (seconds)</option>
            <option value="hidden">Hidden while solving</option>
          </select>
        </Row>

        <Row label="Solve precision" hint="Decimals shown for saved times & stats">
          <select className={selectCls} value={s.solvePrecision} onChange={(e) => s.set({ solvePrecision: Number(e.target.value) as 2 | 3 })}>
            <option value={2}>0.00</option>
            <option value={3}>0.000</option>
          </select>
        </Row>

        <Row label="Show case name" hint="Reveal the case's name/group after you stop">
          <Toggle checked={s.trainerShowCaseName} onChange={(v) => s.set({ trainerShowCaseName: v })} />
        </Row>

        <Row label="Random AUF" hint="Rotate the scramble's top layer randomly so the same case doesn't always look identical">
          <Toggle checked={s.trainerRandomAUF} onChange={(v) => s.set({ trainerRandomAUF: v })} />
        </Row>
      </div>
    </Modal>
  );
}
