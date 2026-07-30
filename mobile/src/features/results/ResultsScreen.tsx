import { StubScreen } from '../../components/StubScreen';

export default function ResultsScreen() {
  return (
    <StubScreen
      title="Results"
      summary="WCA competitor lookup, results history, and unofficial results."
      notes={[
        'Competitor search and results history are not built for mobile yet.',
        'Both the WCA and CubingContests APIs are proxied and cached server-side (/api/wca/*, /api/cc/*) and are never called directly from a client, so this screen is presentation work against endpoints that already exist.',
      ]}
    />
  );
}
