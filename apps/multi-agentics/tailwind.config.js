/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Heebo', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      colors: {
        // GreenBook AI brand — emerald/green primary over a deep slate canvas.
        brand: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857',
          800: '#065f46', 900: '#064e3b', 950: '#022c22',
        },
        // Architecture-diagram blue accent (used for orchestration nodes).
        node: {
          50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd',
          400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8',
          800: '#1e40af', 900: '#1e3a8a',
        },
        canvas: {
          DEFAULT: '#060b16',
          soft: '#0a1120',
          raised: '#0f1a2e',
          line: '#1c2a44',
        },
      },
      boxShadow: {
        glow: '0 0 24px rgba(16, 185, 129, 0.22)',
        'glow-node': '0 0 24px rgba(59, 130, 246, 0.22)',
        'glow-amber': '0 0 24px rgba(245, 158, 11, 0.20)',
        panel: '0 12px 40px -12px rgba(0, 0, 0, 0.6)',
      },
      keyframes: {
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        'flow-dash': {
          to: { strokeDashoffset: '-16' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'flow-dash': 'flow-dash 0.6s linear infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
