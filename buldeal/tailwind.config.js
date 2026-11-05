/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Heebo', 'system-ui', 'sans-serif'],
        display: ['"Secular One"', 'Rubik', 'sans-serif'],
        rounded: ['"Varela Round"', 'Rubik', 'sans-serif'],
        serif: ['"Frank Ruhl Libre"', 'serif'],
      },
      colors: {
        lime: {
          50: '#f6fbe8', 100: '#ebf6cc', 200: '#d6ee9c', 300: '#bde262', 400: '#a3d520', 500: '#8cc10a', 600: '#6f9e0b', 700: '#557a0c', 800: '#445f10', 900: '#384f12',
        },
        leaf: {
          50: '#effaf0', 100: '#d8f2da', 200: '#b3e4b8', 300: '#82cf8b', 400: '#4fb15c', 500: '#2f8f3c', 600: '#22722f', 700: '#1e5c2e', 800: '#184826', 900: '#123a1f', 950: '#08200f',
        },
        wood: {
          50: '#fbf3ec', 100: '#f4e0cf', 200: '#e8bf9d', 300: '#d99a6b', 400: '#c47643', 500: '#a8592a', 600: '#8c3f18', 700: '#6e3013', 800: '#512002', 900: '#3a1702',
        },
        ink: { 50: '#f6f8f5', 100: '#e9eee7', 200: '#d3dccf', 300: '#aebba8', 400: '#81917b', 500: '#5f6f5a', 600: '#4a5846', 700: '#374234', 800: '#232b21', 900: '#141a13', 950: '#0b100a' },
        cream: '#fbfaf3',
      },
      boxShadow: {
        'soft': '0 1px 2px rgba(16,40,16,.06), 0 8px 24px -8px rgba(16,40,16,.12)',
        'lift': '0 2px 4px rgba(16,40,16,.06), 0 18px 40px -12px rgba(16,40,16,.28)',
        'deep': '0 30px 60px -20px rgba(8,32,15,.45), 0 12px 24px -12px rgba(8,32,15,.25)',
        'glow': '0 0 0 1px rgba(140,193,10,.35), 0 10px 40px -8px rgba(140,193,10,.55)',
        'inner-top': 'inset 0 1px 0 rgba(255,255,255,.55)',
        '3d': '0 1px 0 rgba(255,255,255,.4) inset, 0 -3px 0 rgba(0,0,0,.18) inset, 0 10px 24px -10px rgba(0,0,0,.45)',
      },
      borderRadius: { '4xl': '2rem', '5xl': '2.5rem' },
      keyframes: {
        floaty: { '0%,100%': { transform: 'translateY(0) rotate(0)' }, '50%': { transform: 'translateY(-10px) rotate(1.5deg)' } },
        shine: { '0%': { transform: 'translateX(-130%) skewX(-20deg)' }, '60%,100%': { transform: 'translateX(230%) skewX(-20deg)' } },
        pulsebig: { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.06)' } },
        glow: { '0%,100%': { boxShadow: '0 0 0 0 rgba(255,255,255,0)' }, '50%': { boxShadow: '0 0 34px 4px rgba(255,255,255,.35)' } },
        marquee: { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(50%)' } },
        rise: { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        spin_slow: { to: { transform: 'rotate(360deg)' } },
        blob: { '0%,100%': { borderRadius: '42% 58% 70% 30% / 45% 45% 55% 55%' }, '50%': { borderRadius: '70% 30% 46% 54% / 30% 29% 71% 70%' } },
      },
      animation: {
        floaty: 'floaty 5s ease-in-out infinite',
        shine: 'shine 3.2s ease-in-out infinite',
        pulsebig: 'pulsebig 1.8s ease-in-out infinite',
        glow: 'glow 2.4s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        rise: 'rise .6s cubic-bezier(.2,.8,.2,1) both',
        'spin-slow': 'spin_slow 18s linear infinite',
        blob: 'blob 12s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
