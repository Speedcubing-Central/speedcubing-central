// Isometric cube mark used as the sidebar logo and (via public/favicon.svg,
// which mirrors this geometry) the browser tab icon.
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M100,8 L185,54 L100,100 L15,54 Z" fill="#FFFFFF" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
      <path d="M15,54 L100,100 L100,192 L15,146 Z" fill="#009E60" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
      <path d="M185,54 L100,100 L100,192 L185,146 Z" fill="#A6031C" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
    </svg>
  );
}
