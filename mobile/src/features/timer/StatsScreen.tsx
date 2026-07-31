import { useState } from 'react';
import { View } from 'react-native';
import { singleStats, type SolveAverage } from '@scc/shared';
import { useSettings } from '../../store/settings';
import { Muted, Screen, ScreenTitle } from '../../components/ui';
import { AverageDetailSheet } from './AverageDetailSheet';
import { SolveDetailSheet } from './SolveDetailSheet';
import { StatRows } from './StatRows';
import { useTimerDataContext } from './TimerDataContext';
import { space } from '../../theme';

// The Timer's detailed statistics, on their own screen.
//
// This is now mostly a frame: the rows themselves live in StatRows.tsx because
// the Timer's draggable panel renders exactly the same component. Two
// implementations of the same numbers is what this redesign exists to end, so
// the only difference between here and there is `compact` and the chrome
// around it: this screen has the full height, the title, and the footnote.
export default function StatsScreen() {
  const data = useTimerDataContext();
  const event = useSettings((s) => s.currentEvent);
  const { showBPA, showWPA, showTarget } = useSettings();
  const [avgView, setAvgView] = useState<SolveAverage | null>(null);
  const [detailIndex, setDetailIndex] = useState<number | null>(null);

  const solves = data.solves;
  const count = singleStats(solves).count;
  const anyProjections = showBPA || showWPA || showTarget;

  return (
    <Screen scroll edges={[]}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm }}>
        <ScreenTitle>Statistics</ScreenTitle>
        <Muted>
          {count} solve{count === 1 ? '' : 's'}
        </Muted>
      </View>

      <StatRows
        solves={solves}
        event={event}
        onOpenAverage={setAvgView}
        onOpenSolve={setDetailIndex}
      />

      {solves.length > 0 && (
        <Muted>
          Tap a current or best figure to see the solves behind it.
          {anyProjections
            ? ' BPA and WPA are the best and worst possible averages given the solves so far; Target is the slowest next solve that would still set a new best.'
            : ''}
        </Muted>
      )}

      <AverageDetailSheet
        view={avgView}
        event={event}
        visible={avgView !== null}
        onClose={() => setAvgView(null)}
      />
      <SolveDetailSheet
        solves={solves}
        index={detailIndex}
        event={event}
        visible={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        onUpdatePenalty={data.updatePenalty}
        onUpdateTime={data.updateTime}
        onUpdateComment={data.updateComment}
        onDelete={data.deleteSolve}
        onOpenAverage={(v) => {
          setDetailIndex(null);
          setAvgView(v);
        }}
      />
    </Screen>
  );
}
