function KoyaMark({ size = 48 }: { size?: number }) {
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
        <linearGradient id="gGold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F0D060" />
          <stop offset="35%" stopColor="#D4AF37" />
          <stop offset="70%" stopColor="#A88520" />
          <stop offset="100%" stopColor="#C9A030" />
        </linearGradient>
        <linearGradient id="gGoldBack" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#C9A030" />
          <stop offset="60%" stopColor="#8B6500" />
          <stop offset="100%" stopColor="#6B4F00" />
        </linearGradient>
        <mask id="mFront">
          <circle cx="38" cy="42" r="22" fill="white" />
          <circle cx="48" cy="42" r="15" fill="black" />
        </mask>
        <mask id="mBack">
          <circle cx="46" cy="42" r="20" fill="white" />
          <circle cx="55" cy="37" r="14" fill="black" />
        </mask>
      </defs>
      <circle
        cx="46"
        cy="42"
        r="20"
        fill="url(#gGoldBack)"
        mask="url(#mBack)"
      />
      <circle
        cx="38"
        cy="42"
        r="22"
        fill="url(#gGold)"
        mask="url(#mFront)"
      />
    </svg>
  );
}

export default function LandingPage() {
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center px-6">
      {/* Ambient background glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
        style={{
          background:
            'radial-gradient(circle, rgba(212,175,55,0.2) 0%, transparent 70%)',
        }}
      />

      {/* Main content card */}
      <div className="glass-strong flex max-w-md flex-col items-center gap-8 rounded-2xl p-12 text-center animate-fade-in">
        {/* Logo mark */}
        <KoyaMark size={64} />

        {/* Wordmark */}
        <h1 className="font-display text-5xl font-extrabold tracking-tight text-gradient-gold">
          koya
        </h1>

        {/* Tagline */}
        <p className="text-sm font-medium tracking-[0.24em] uppercase text-white-40">
          Borderless Finance
        </p>

        {/* Description */}
        <p className="text-white-60 max-w-sm text-base leading-relaxed">
          The financial operating system for Africa and beyond. Convert, hold,
          and move money across currencies and borders — instantly.
        </p>

        {/* CTA */}
        <button className="mt-2 rounded-lg bg-gold px-8 py-3 text-sm font-semibold text-vault-black transition-all duration-200 hover:bg-gold-light hover:shadow-gold active:scale-[0.98]">
          Get Early Access
        </button>

        {/* Status indicator */}
        <div className="flex items-center gap-2 text-xs text-white-40">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
          Building in public
        </div>
      </div>
    </main>
  );
}
