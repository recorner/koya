export function KoyaMark({ size = 48, id = '' }: { size?: number; id?: string }) {
  const suffix = id ? `-${id}` : '';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 84 84"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Koya logo"
    >
      <defs>
        <linearGradient id={`gGold${suffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0D060" />
          <stop offset="35%" stopColor="#D4AF37" />
          <stop offset="70%" stopColor="#A88520" />
          <stop offset="100%" stopColor="#C9A030" />
        </linearGradient>
        <linearGradient id={`gGoldBack${suffix}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C9A030" />
          <stop offset="60%" stopColor="#8B6500" />
          <stop offset="100%" stopColor="#6B4F00" />
        </linearGradient>
        <mask id={`mFront${suffix}`}>
          <circle cx="38" cy="42" r="22" fill="white" />
          <circle cx="48" cy="42" r="15" fill="black" />
        </mask>
        <mask id={`mBack${suffix}`}>
          <circle cx="46" cy="42" r="20" fill="white" />
          <circle cx="55" cy="37" r="14" fill="black" />
        </mask>
      </defs>
      <circle cx="46" cy="42" r="20" fill={`url(#gGoldBack${suffix})`} mask={`url(#mBack${suffix})`} />
      <circle cx="38" cy="42" r="22" fill={`url(#gGold${suffix})`} mask={`url(#mFront${suffix})`} />
    </svg>
  );
}

export function KoyaWordmark({
  markSize = 28,
  textSize = 'text-2xl',
  id = '',
}: {
  markSize?: number;
  textSize?: string;
  id?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <KoyaMark size={markSize} id={id} />
      <span className={`font-display font-extrabold tracking-tight text-gradient-gold ${textSize}`}>
        koya
      </span>
    </div>
  );
}
