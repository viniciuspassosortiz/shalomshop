// Logo da ShalomShop: um "S" branco sobre quadrado azul-marinho.
export default function Mark({ size = 96, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} role="img" aria-label="ShalomShop">
      <defs>
        <linearGradient id="ss-navy" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1d4f8a" />
          <stop offset="1" stopColor="#0b2a4a" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="96" height="96" rx="26" fill="url(#ss-navy)" />
      <path
        d="M68 32 C 62 24, 36 22, 34 38 C 32 52, 66 50, 66 66 C 66 82, 38 82, 32 70"
        fill="none"
        stroke="#ffffff"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}
