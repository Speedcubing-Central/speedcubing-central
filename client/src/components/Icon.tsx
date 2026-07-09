import type { SVGProps } from 'react';

// A small hand-built line-icon set (no emoji). All icons share a 24x24 viewBox,
// use currentColor, and inherit size from the `size` prop. Most are stroked;
// a few (play, pause, etc.) use fills where that reads better.

export type IconName =
  | 'home'
  | 'timer'
  | 'calculator'
  | 'cube'
  | 'trophy'
  | 'calendar'
  | 'swords'
  | 'film'
  | 'brain'
  | 'book'
  | 'user'
  | 'gear'
  | 'sun'
  | 'moon'
  | 'logout'
  | 'trash'
  | 'refresh'
  | 'play'
  | 'pause'
  | 'skipBack'
  | 'skipForward'
  | 'check'
  | 'x'
  | 'plus'
  | 'search'
  | 'pin'
  | 'globe'
  | 'external'
  | 'target'
  | 'sparkle'
  | 'arrowRight'
  | 'arrowLeft'
  | 'circle'
  | 'panel'
  | 'copy'
  | 'pencil'
  | 'upload';

const PATHS: Record<IconName, JSX.Element> = {
  home: (
    <>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
    </>
  ),
  timer: (
    <>
      <path d="M9 2.5h6" />
      <path d="M12 5v0" />
      <circle cx="12" cy="14" r="7.5" />
      <path d="M12 14V9.5" />
      <path d="m17.5 8.5 1.5-1.5" />
    </>
  ),
  calculator: (
    <>
      <rect x="5" y="2.5" width="14" height="19" rx="2" />
      <rect x="8" y="5.5" width="8" height="3" rx="0.6" />
      <path d="M8.5 13h.01M12 13h.01M15.5 13h.01M8.5 17h.01M12 17h.01M15.5 17h.01" />
    </>
  ),
  cube: (
    <>
      <path d="M12 2.5 21 7v10l-9 4.5L3 17V7l9-4.5Z" />
      <path d="m3 7 9 4.5L21 7" />
      <path d="M12 11.5V21.5" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1.5A3 3 0 0 0 7 10M17 6h3v1.5A3 3 0 0 1 17 10" />
      <path d="M12 14v3M9 21h6M10 21l.5-4h3l.5 4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M7.5 13h.01M12 13h.01M16.5 13h.01M7.5 16.5h.01M12 16.5h.01" />
    </>
  ),
  swords: (
    <>
      <path d="M14.5 3H20v5.5L9 19.5l-4.5.5.5-4.5L14.5 3Z" />
      <path d="M9.5 3H4v5.5L15 19.5l4.5.5-.5-4.5L9.5 3Z" />
    </>
  ),
  film: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <path d="M3 9h18M3 15h18M8 4.5v15M16 4.5v15" />
    </>
  ),
  brain: (
    <>
      <path d="M12 5.5a3 3 0 0 0-5.5 1.7A3 3 0 0 0 5 12a3 3 0 0 0 2 4.5A2.5 2.5 0 0 0 12 17.5Z" />
      <path d="M12 5.5a3 3 0 0 1 5.5 1.7A3 3 0 0 1 19 12a3 3 0 0 1-2 4.5A2.5 2.5 0 0 1 12 17.5Z" />
      <path d="M12 5.5v12" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4.5 4.7V18c3.5-.2 6 .3 7.5 1.8 1.5-1.5 4-2 7.5-1.8V4.7C16 4.5 13.5 5 12 6.5Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.8" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  gear: (
    <>
      <path d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.094c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.764-.384.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
      <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M21.5 12H19M5 12H2.5M18.4 5.6 16.6 7.4M7.4 16.6l-1.8 1.8M18.4 18.4 16.6 16.6M7.4 7.4 5.6 5.6" />
    </>
  ),
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z" />,
  logout: (
    <>
      <path d="M15 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H15" />
      <path d="M10.5 12H21M17.5 8.5 21 12l-3.5 3.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9 6.5V4.5h6v2M6 6.5 7 20a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 17 20l1-13.5" />
      <path d="M10 10.5v7M14 10.5v7" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11.5A8 8 0 1 0 18.5 16" />
      <path d="M20 5.5v6h-6" />
    </>
  ),
  play: <path d="M7 4.5v15l13-7.5L7 4.5Z" fill="currentColor" stroke="none" />,
  pause: (
    <>
      <rect x="6.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  skipBack: (
    <>
      <path d="M18 5v14l-11-7 11-7Z" fill="currentColor" stroke="none" />
      <rect x="4" y="5" width="2.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  skipForward: (
    <>
      <path d="M6 5v14l11-7L6 5Z" fill="currentColor" stroke="none" />
      <rect x="17.5" y="5" width="2.5" height="14" rx="1" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17" />
    </>
  ),
  external: (
    <>
      <path d="M14 4.5h5.5V10" />
      <path d="M19.5 4.5 11 13" />
      <path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  sparkle: <path d="M12 3c.6 4.4 1.6 5.4 6 6-4.4.6-5.4 1.6-6 6-.6-4.4-1.6-5.4-6-6 4.4-.6 5.4-1.6 6-6Z" />,
  arrowRight: <path d="M5 12h14M13 6l6 6-6 6" />,
  arrowLeft: <path d="M19 12H5M11 6l-6 6 6 6" />,
  circle: <circle cx="12" cy="12" r="7.5" />,
  panel: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M5.5 15.5H4.5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2H13a2 2 0 0 1 2 2v1" />
    </>
  ),
  pencil: <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z" />,
  upload: (
    <>
      <path d="M12 15.5V4M8 8l4-4 4 4" />
      <path d="M4.5 15v3A2.5 2.5 0 0 0 7 20.5h10a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
  ...rest
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
