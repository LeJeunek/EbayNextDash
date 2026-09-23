// src/components/ResoldMark.tsx
// The Resold "Loop" emblem: a circular arrow around a dot, for an item
// coming back around to its next owner. Colors follow the theme tokens,
// so it reads ink-on-paper in light mode and inverts in dark mode.
export function ResoldMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="11" fill="var(--accent)" />
      <path d="M24 12a12 12 0 1 1-12 12" fill="none" stroke="var(--accent-fg)" strokeWidth="4" strokeLinecap="round" />
      <path d="M6.5 25.5 12 18l5.5 7.5z" fill="var(--accent-fg)" />
      <circle cx="24" cy="24" r="3.5" fill="var(--accent-fg)" />
    </svg>
  );
}
