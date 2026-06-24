/** diem mark — a minimal sunrise arc (diem = "day"; the app is about your day). */
export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 17.5h18"
        stroke="var(--c-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M6.5 17.5a5.5 5.5 0 0 1 11 0"
        stroke="var(--c-text)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 3v2.5M4.7 6.7l1.6 1.6M19.3 6.7l-1.6 1.6"
        stroke="var(--c-accent)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
