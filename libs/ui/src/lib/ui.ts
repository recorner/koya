/** Koya brand color tokens — framework-agnostic */
export const colors = {
  vaultBlack: '#070708',
  navy: '#0A0E27',
  cell: '#0F0F10',
  surface: '#0A0A0A',
  surfaceRaised: '#141415',
  surfaceOverlay: '#1C1C1E',

  gold: {
    light: '#F0D060',
    default: '#D4AF37',
    deep: '#A88520',
    muted: '#C9A030',
    dark: '#8B6914',
    darker: '#6B4F00',
  },

  cyan: '#00E5FF',
  emerald: '#10B981',
  red: '#EF4444',
  amber: '#F59E0B',
} as const;

/** Brand fonts — names match CSS custom properties */
export const fonts = {
  display: 'Syne',
  body: 'DM Sans',
  mono: 'JetBrains Mono',
} as const;
