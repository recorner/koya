import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#070708',
          borderRadius: 36,
        }}
      >
        {/* Stylised "K" mark in gold gradient */}
        <svg
          width="110"
          height="110"
          viewBox="0 0 84 84"
          fill="none"
        >
          <defs>
            <linearGradient
              id="gGold"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#F0D060" />
              <stop offset="35%" stopColor="#D4AF37" />
              <stop offset="70%" stopColor="#A88520" />
              <stop offset="100%" stopColor="#C9A030" />
            </linearGradient>
            <linearGradient
              id="gGoldBack"
              x1="100%"
              y1="0%"
              x2="0%"
              y2="100%"
            >
              <stop offset="0%" stopColor="#C9A030" />
              <stop offset="60%" stopColor="#8B6500" />
              <stop offset="100%" stopColor="#6B4F00" />
            </linearGradient>
          </defs>
          <circle cx="46" cy="42" r="20" fill="url(#gGoldBack)" />
          <circle cx="38" cy="42" r="22" fill="url(#gGold)" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
