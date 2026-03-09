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
          hi: '#E2E8F0',
          mid: '#CBD5E1',
          lo: '#94A3B8',
        },
        // Dark backgrounds
        base: '#09090B',
        surface: '#0F0F12',
        elevated: '#18181B',
        // Borders
        edge: '#1C1C22',
        // Text
        bright: '#FAFAFA',
        dim: '#71717A',
        muted: '#3F3F46',
        // Semantic
        success: '#22C55E',
        danger: '#EF4444',
        warning: '#F59E0B',
        info: '#3B82F6',
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
