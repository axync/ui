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
        bg: '#0A0A0F',
        bg2: '#12121A',
        bg3: '#1A1A26',
        bg4: '#22222E',
        brd: '#2A2A38',
        brd2: '#3A3A4A',
        tx: '#E8E8E8',
        tx2: '#9A9AB0',
        tx3: '#6A6A80',
        lav: '#CCCCFF',
        ice: '#7DD3FC',
        green: '#4ADE80',
        red: '#F87171',
        amber: '#FBBF24',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'grad': 'linear-gradient(135deg, #CCCCFF, #7DD3FC)',
        'grad2': 'linear-gradient(135deg, rgba(204,204,255,0.12), rgba(125,211,252,0.12))',
      },
      boxShadow: {
        'elevation-1': '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
        'elevation-2': '0 4px 16px rgba(0,0,0,0.4), 0 2px 4px rgba(0,0,0,0.2)',
        'glow-lav': '0 0 20px rgba(204,204,255,0.08)',
        'glow-lav-lg': '0 0 24px rgba(204,204,255,0.2)',
      },
      borderRadius: {
        'card': '14px',
      },
      animation: {
        'fade-in': 'fadeIn 0.35s ease forwards',
        'fade-in-1': 'fadeIn 0.35s ease 0.05s forwards',
        'fade-in-2': 'fadeIn 0.35s ease 0.1s forwards',
        'fade-in-3': 'fadeIn 0.35s ease 0.15s forwards',
        'fade-in-4': 'fadeIn 0.35s ease 0.2s forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
