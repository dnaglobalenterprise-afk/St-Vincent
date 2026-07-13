import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        svgblue: {
          50: '#F0F8FF',
          100: '#D6EBFA',
          500: '#0072C6', // PRIMARY: buttons, links, active states
          700: '#0059A8', // hover state of primary
          900: '#0B2540', // deep navy: TEXT ONLY, never backgrounds
        },
        svggold: {
          100: '#FEF6D0',
          500: '#FCD116', // accent: badges, streaks, highlights, celebration
          600: '#E0B500',
        },
        svggreen: {
          100: '#D9F2E2',
          500: '#009639', // success, completion, deployed states
          700: '#007A2F',
        },
        surface: {
          page: '#FFFFFF',
          alt: '#F5F9FC',
        },
        line: '#E2ECF4',
        ink: {
          DEFAULT: '#0B2540',
          muted: '#5A7184',
        },
        danger: '#D64545',
        warning: '#E8890C',
      },
      fontFamily: {
        heading: ['Sora', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      fontSize: {
        // Design scale (Section 4.4): 40/32/24/20/16/14
        '4xl': ['40px', { lineHeight: '1.2' }],
        '3xl': ['32px', { lineHeight: '1.2' }],
        '2xl': ['24px', { lineHeight: '1.2' }],
        xl: ['20px', { lineHeight: '1.2' }],
        base: ['16px', { lineHeight: '1.6' }],
        sm: ['14px', { lineHeight: '1.6' }],
      },
      borderRadius: { xl: '12px' },
      boxShadow: { card: '0 2px 8px rgba(11,37,64,0.06)' },
    },
  },
  plugins: [],
} satisfies Config
