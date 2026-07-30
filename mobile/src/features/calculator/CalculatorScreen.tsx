import { StubScreen } from '../../components/StubScreen';

export default function CalculatorScreen() {
  return (
    <StubScreen
      title="Calculator"
      summary="Average and mean calculator, plus the target-time solver."
      notes={[
        'The Ao5…Ao100 / Mo3 / MoX calculator and target-time solver are not built for mobile yet.',
        'The maths itself is already shared (@scc/shared trimmedAverage / mean), so this screen is presentation work only.',
      ]}
    />
  );
}
