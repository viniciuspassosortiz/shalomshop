// Ilustração neutra usada quando o produto ainda não tem foto.
export default function ProductArt(_: { category: string }) {
  return (
    <svg viewBox="0 0 100 100" className="art" aria-hidden>
      <rect x="24" y="30" width="52" height="44" rx="6" fill="none" stroke="#1d4f8a" strokeWidth="3" />
      <path d="M24 44 H76" stroke="#1d4f8a" strokeWidth="3" strokeOpacity=".35" />
      <path d="M40 30 V22 H60 V30" fill="none" stroke="#1d4f8a" strokeWidth="3" strokeOpacity=".6" strokeLinejoin="round" />
    </svg>
  );
}
