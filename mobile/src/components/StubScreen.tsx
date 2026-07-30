import { Text, View } from 'react-native';
import { usePalette } from '../store/settings';
import { Muted, Screen } from './ui';
import { radius, space } from '../theme';

// A screen that exists in the tab structure but whose feature isn't built for
// mobile yet.
//
// Deliberately explicit about what's missing and why, rather than a blank "coming
// soon". This is a foundation pass, and the honest state of each tab is useful
// information both to whoever picks the work up and to anyone running the build.
export function StubScreen({
  title,
  summary,
  notes,
}: {
  title: string;
  summary: string;
  notes: string[];
}) {
  const p = usePalette();
  return (
    <Screen scroll>
      <View>
        <Text style={{ color: p.text, fontSize: 22, fontWeight: '800' }}>{title}</Text>
        <Muted>{summary}</Muted>
      </View>
      <View
        style={{
          borderWidth: 1,
          borderColor: p.border,
          borderRadius: radius.md,
          padding: space.md,
          gap: space.sm,
        }}
      >
        <Text style={{ color: p.text, fontWeight: '700', fontSize: 14 }}>Not in this build yet</Text>
        {notes.map((note) => (
          <Muted key={note}>• {note}</Muted>
        ))}
      </View>
      <Muted>
        Everything this feature reads and writes lives on the server, shared with the web app. Nothing needs
        migrating when it lands here.
      </Muted>
    </Screen>
  );
}
