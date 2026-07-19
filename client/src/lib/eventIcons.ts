// @cubing/icons doesn't use a single "event-<id>" class for every event —
// a few unofficial extras have their own differently-suffixed glyphs (its
// redi cube glyph is "unofficial-redi", not "unofficial-redi_cube"). Lifted
// out of LandingPage.tsx (the original sole consumer) since Relays is now a
// second one.
const UNOFFICIAL_ICON_CLASS: Record<string, string> = {
  kilominx: 'unofficial-kilominx',
  fto: 'unofficial-fto',
  redi_cube: 'unofficial-redi',
};

export function eventIconClass(eventId: string): string {
  return UNOFFICIAL_ICON_CLASS[eventId] ?? `event-${eventId}`;
}
