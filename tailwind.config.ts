import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Brand silver palette
        silver: {
          hi: '#F1F5F9',
          mid: '#E2E8F0',
          lo: '#CBD5E1',
        },
        // Dark backgrounds
        base: '#08080C',
        surface: '#111118',
        elevated: '#1A1A24',
        // Borders
        edge: '#2A2A38',
        // Text
        bright: '#F8FAFC',
        dim: '#A1A1AA',
        muted: '#71717A',
        // Semantic
        success: '#34D399',
        danger: '#F87171',
        warning: '#FBBF24',
        info: '#60A5FA',
      },
      fontFamily: {
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'silver-gradient': 'linear-gradient(135deg, #E2E8F0, #CBD5E1, #94A3B8)',
      },
    },
  },
  plugins: [],
}
export default config
