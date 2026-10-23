import type { Config } from 'tailwindcss'

// Palette "chantier" : béton clair, ardoise, jaune haute visibilité.
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        concrete: '#EEF0EC',
        ink: '#1D2733',
        mute: '#5E6B78',
        line: '#D5D9D2',
        hiviz: '#F5C400',
        plaster: '#3A6EA5',
        ok: '#2E7D4F',
        alert: '#B3261E',
      },
      fontFamily: {
        sans: ['var(--font-archivo)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
