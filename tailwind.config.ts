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
        silver: {
          hi: '#F1F5F9',
          mid: '#E2E8F0',
          lo: '#CBD5E1',
        },
        base: '#08080C',
        surface: '#12121A',
        elevated: '#1C1C28',
        edge: '#252535',
        bright: '#F8FAFC',
        dim: '#A1A1AA',
        muted: '#71717A',
        accent: '#60A5FA',
        success: '#34D399',
        danger: '#F87171',
        warning: '#FBBF24',
        info: '#60A5FA',
      },
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'silver-gradient': 'linear-gradient(135deg, #E2E8F0, #CBD5E1, #94A3B8)',
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'elevation-2': '0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
        'elevation-3': '0 8px 32px rgba(0,0,0,0.5), 0 4px 8px rgba(0,0,0,0.3)',
        'glow-accent': '0 0 0 1px rgba(96,165,250,0.3), 0 0 12px rgba(96,165,250,0.1)',
      },
    },
  },
  plugins: [],
}
export default config
