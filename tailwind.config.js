/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      colors: {
        bg: '#0a0a0f',
        surface: '#111118',
        surface2: '#18181f',
        border: '#2a2a35',
        accent: '#e8ff4a',
        accent2: '#4aff9e',
        warn: '#ffaa2e',
        danger: '#ff4a6b',
        text: '#e8e8f0',
        muted: '#6b6b80',
      },
      animation: {
        'pulse-dot': 'pulse-dot 1s ease-in-out infinite',
        'fade-up': 'fade-up 0.4s ease forwards',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.6)', opacity: '0.5' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
