// Isometric-cube mark: three rhombi (top/left/right faces) with a small gap
// between them, matching the uploaded client/public/Logo.svg's geometry
// (rescaled from its 1500x1500 source into this component's 0-200 viewBox).
// Solid fill via currentColor rather than fixed per-face colors — unlike
// the previous white/green/red version, this mark is monochrome by design,
// so it inherits whatever text color the surrounding context already uses
// (light mode: near-black; dark mode: near-white — see index.css's body
// text colors), the same way plain text does. No color prop needed as a
// result; every call site already sits somewhere with theme-aware text.
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className={className} fill="currentColor">
      <path d="M100,31.25 L142.84,74.08 L100,116.92 L57.16,74.08 Z" />
      <path d="M48.16,83.08 L91,125.92 L48.16,168.75 L5.33,125.92 Z" />
      <path d="M151.84,83.08 L194.67,125.92 L151.84,168.75 L109,125.92 Z" />
    </svg>
  );
}
