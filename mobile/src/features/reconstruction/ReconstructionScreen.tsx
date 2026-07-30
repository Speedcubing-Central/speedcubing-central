import { StubScreen } from '../../components/StubScreen';

export default function ReconstructionScreen() {
  return (
    <StubScreen
      title="Reconstruction"
      summary="3D scramble and solution playback, shareable by link."
      notes={[
        'Reconstruction viewing and editing are not built for mobile yet.',
        'The 3D player is cubing.js’s <twisty-player> web component, which has no React Native equivalent. This needs a genuinely different rendering approach (a WebView, or a native renderer), not a port.',
        'Reconstructions saved from the web app are stored server-side and will be readable here once a player exists.',
      ]}
    />
  );
}
