import { useWindowDimensions } from 'react-native';

// Type and spacing scaled to the screen it's actually on.
//
// Every size in this app was a fixed point value tuned against one phone, which
// is why the Timer kept breaking in a different place on each report: a layout
// that exactly fits a 6.1" screen has nothing left to give on a 4.7" one, so
// whichever element happened to be last in the column got clipped. Scaling the
// type moves that from a per-symptom fix to a property of the screen.
//
// The baseline is the iPhone 14/15 Pro, which is what the layout was designed
// against. An iPhone SE is about 78% of its height; a Pro Max about 109%.
const BASE_HEIGHT = 852;
const BASE_WIDTH = 393;

// Bounds, because neither direction should run away: below ~0.82 text stops
// being comfortably readable at arm's length, and above ~1.1 a big screen just
// looks like a zoomed-in small one rather than showing more.
const MIN_SCALE = 0.82;
const MAX_SCALE = 1.1;

// Below this the screen is short enough that vertical budget, not readability,
// is the binding constraint (iPhone SE and the older 4.7" bodies).
const SHORT_SCREEN_HEIGHT = 700;

export interface ScreenScale {
  /** Multiplier for type and spacing on this screen. */
  scale: number;
  /** Scale a point value designed at the baseline, rounded to whole points. */
  s: (n: number) => number;
  /** Scale a value but never below `min`, for things with a legibility floor. */
  sMin: (n: number, min: number) => number;
  /** True on a short screen, where the column has to give something up. */
  isShort: boolean;
  width: number;
  height: number;
  /** The OS text-size setting, 1 at default. Layout has to account for it. */
  fontScale: number;
  /**
   * Cap for text whose size the layout depends on. Body copy should still grow
   * with the user's setting; a number sized to fit a fixed box cannot, and
   * letting it grow only trades a small font for a clipped one.
   */
  maxFontMultiplier: number;
}

export function useScreenScale(): ScreenScale {
  // useWindowDimensions, not Dimensions.get: this re-renders on rotation, on an
  // iPad split view, and on a foldable, where a value read once at module load
  // would be silently wrong for the rest of the session.
  const { width, height, fontScale } = useWindowDimensions();
  // The smaller of the two ratios, so scaled text never outgrows the axis that
  // is actually tight. Taking height alone would overscale a tall narrow screen
  // and push wide rows (the stats tile, the header) back into truncation.
  const raw = Math.min(height / BASE_HEIGHT, width / BASE_WIDTH);
  const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, raw));
  return {
    scale,
    s: (n: number) => Math.round(n * scale),
    sMin: (n: number, min: number) => Math.max(min, Math.round(n * scale)),
    isShort: height < SHORT_SCREEN_HEIGHT,
    width,
    height,
    fontScale,
    // 1.3 rather than 1.0: accessibility text sizes still take effect, they
    // just stop short of the point where a stats row cannot hold two figures.
    maxFontMultiplier: 1.3,
  };
}

// ── Layout density ────────────────────────────────────────────────────────
//
// The Timer column has to hold a header, a scramble of unpredictable depth, the
// timer itself, penalties and a stats footer, on screens that differ by 40% in
// height, at font sizes the user controls. Shrinking everything until it fits is
// what produced five rounds of "one more thing is clipped": there is a point
// past which the scramble is unreadable and the digits are pointless.
//
// So past that point elements are *dropped*, in a fixed order, instead. Density
// is that decision, made once from the space actually available, so every part
// of the screen agrees on which tier it is in.
export type Density = 'comfortable' | 'compact' | 'minimal';

/**
 * @param available Height the column actually got, measured, not assumed.
 * @param fontScale The OS text-size multiplier: a user at the largest
 *   accessibility size needs the same relief a small screen does, because the
 *   text is what grew.
 */
export function densityFor(available: number, fontScale: number): Density {
  // Normalise: a 1.3x font on a 800pt screen is about as tight as a 615pt one.
  const effective = available / Math.max(1, fontScale);
  if (effective < 520) return 'minimal';
  if (effective < 640) return 'compact';
  return 'comfortable';
}

// ── Vertical rhythm ───────────────────────────────────────────────────────
//
// Every gap in this app was `space.sm` (8). A single repeated gap is the reason
// the Timer read as cluttered even when nothing on it was wrong: if the space
// between the header and the scramble equals the space between a label and its
// own value, nothing groups, and the eye has to read all of it to find out what
// belongs to what. Grouping is done with space or it is not done at all.
//
// So these are named by *relationship*, not by size, and a caller picks the one
// that describes what the two things are to each other. That way a later edit
// changes one number here rather than guessing at a literal on the spot.
export interface Rhythm {
  /** Inside one cell: a label sitting directly above its own value. */
  hair: number;
  /** Parts of a single control: an icon beside its text. */
  tight: number;
  /** Siblings in a list or a row of figures. */
  item: number;
  /** Between groups that still belong to the same block. */
  group: number;
  /** Between the major blocks of a screen. */
  section: number;
}

// The two larger steps compress by density, the three smaller ones don't: below
// about 8pt a gap stops reading as separation at all, so shrinking `hair` and
// `tight` would cost legibility and buy back almost no height. What actually
// buys height on a short screen is `group` and `section`, which are also the
// two that can afford it.
const RHYTHM_GROUP: Record<Density, number> = { comfortable: 14, compact: 10, minimal: 8 };
const RHYTHM_SECTION: Record<Density, number> = { comfortable: 22, compact: 14, minimal: 10 };
const RHYTHM_ITEM: Record<Density, number> = { comfortable: 8, compact: 8, minimal: 6 };

/**
 * Vertical rhythm for this screen, scaled by `useScreenScale`.
 *
 * Budget, load bearing on the Timer column: the sum of every inter-element
 * margin must stay under sc(48) at comfortable, sc(28) at compact and sc(16) at
 * minimal. Each point of gap is a point the timer digits do not get, and the
 * Yoga harness asserts the timer's resulting height rather than this sum, so an
 * edit that blows the budget shows up there as a failure and not here.
 *
 * @param density Pass the tier when the caller has already computed one (the
 *   Timer does, from its measured column height). Screens that scroll can
 *   ignore it: they have no fixed budget to blow.
 */
export function useRhythm(density: Density = 'comfortable'): Rhythm {
  const { s } = useScreenScale();
  return {
    hair: s(2),
    tight: s(4),
    item: s(RHYTHM_ITEM[density]),
    group: s(RHYTHM_GROUP[density]),
    section: s(RHYTHM_SECTION[density]),
  };
}
